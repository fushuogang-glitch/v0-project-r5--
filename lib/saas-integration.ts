import 'server-only'

import { db } from '@/lib/db'
import { saasConfig, saasEntityMap } from '@/lib/db/schema'
import { eq } from 'drizzle-orm'
import { decryptSecret } from '@/lib/crypto'

/**
 * 统一 SaaS 对接层(BA-CRM 门店运营系统)。
 *
 * 设计原则:契约固定,数据源可切换(live 真实接口 / mock 模拟)。
 * 配置优先级:数据库 saas_config(用户在设置页填写) > 环境变量 > 无(mock)。
 * 鉴权:集团在 SaaS 侧申请的 API Key,通过 X-Api-Key 头传递。
 *
 * 接口路径契约(路径可随 BA-CRM 实际调整):
 *   GET {base}/api/agent/ping
 *   GET {base}/api/agent/members/topups?storeCode=&from=&to=
 *   GET {base}/api/agent/members/consumes?storeCode=&from=&to=
 *   GET {base}/api/agent/store/daily-revenue?storeCode=&from=&to=
 *   GET {base}/api/agent/payroll?storeCode=&period=
 *   GET {base}/api/agent/purchases?storeCode=&from=&to=
 */

export type SaasSource = 'live' | 'mock'

// ---------------------------------------------------------------------------
// 5 类拉数数据契约
// ---------------------------------------------------------------------------

/** 1. 会员储值充值流水 */
export type TopUp = {
  id: string
  memberNo: string
  memberName: string
  amount: number
  bonus: number
  channel: string
  date: string
  storeCode: string
}

/** 2. 会员消费核销 */
export type Consume = {
  id: string
  memberNo: string
  memberName: string
  amount: number
  item: string
  technician: string
  date: string
  storeCode: string
  serviceRecordId: string
}

/** 3. 门店日营业流水 */
export type DailyRevenue = {
  date: string
  storeCode: string
  cash: number
  card: number
  wechat: number
  alipay: number
  storedValue: number
  total: number
}

/** 4. 工资薪酬 */
export type PayrollItem = {
  period: string
  storeCode: string
  employeeName: string
  position: string
  base: number
  commission: number
  bonus: number
  insurance: number
  gross: number
  tax: number
  net: number
}

/** 5. 采购成本 / 进项 */
export type Purchase = {
  id: string
  date: string
  storeCode: string
  supplier: string
  product: string
  qty: number
  amount: number
  taxAmount: number
  invoiceNo: string
}

/** 拉取范围参数 */
export type PullRange = { from?: string; to?: string; period?: string }

/** 单门店全量拉数结果 */
export type SaasStorePull = {
  source: SaasSource
  storeCode: string
  topUps: TopUp[]
  consumes: Consume[]
  dailyRevenue: DailyRevenue[]
  payroll: PayrollItem[]
  purchases: Purchase[]
}

// ---------------------------------------------------------------------------
// 配置解析
// ---------------------------------------------------------------------------

export type ResolvedConfig = {
  source: 'db' | 'env'
  baseUrl: string
  apiKey: string
}

/** 解析当前集团的 SaaS 配置:DB 优先,其次环境变量,均无返回 null(走 mock) */
export async function resolveSaasConfig(userId: string): Promise<ResolvedConfig | null> {
  const [cfg] = await db
    .select()
    .from(saasConfig)
    .where(eq(saasConfig.userId, userId))
    .limit(1)

  if (cfg?.baseUrl && cfg.apiKeyEnc) {
    const key = decryptSecret(cfg.apiKeyEnc)
    if (key) return { source: 'db', baseUrl: cfg.baseUrl.replace(/\/$/, ''), apiKey: key }
  }

  const envBase = process.env.SAAS_API_BASE_URL
  const envKey = process.env.SAAS_API_KEY
  if (envBase && envKey) {
    return { source: 'env', baseUrl: envBase.replace(/\/$/, ''), apiKey: envKey }
  }
  return null
}

/** 取某主体对应的 SaaS storeCode:映射表优先,默认用主体 code */
export async function resolveStoreCode(
  userId: string,
  entityId: number,
  fallbackCode: string,
): Promise<string> {
  const [m] = await db
    .select({ storeCode: saasEntityMap.storeCode })
    .from(saasEntityMap)
    .where(eq(saasEntityMap.entityId, entityId))
    .limit(1)
  return m?.storeCode || fallbackCode
}

// ---------------------------------------------------------------------------
// 真实接口调用
// ---------------------------------------------------------------------------

async function saasGet<T>(
  cfg: ResolvedConfig,
  path: string,
  params: Record<string, string | undefined>,
): Promise<T> {
  const url = new URL(cfg.baseUrl + path)
  for (const [k, v] of Object.entries(params)) {
    if (v != null && v !== '') url.searchParams.set(k, v)
  }
  const res = await fetch(url.toString(), {
    headers: { 'X-Api-Key': cfg.apiKey, Accept: 'application/json' },
    next: { revalidate: 60 },
  })
  if (!res.ok) throw new Error(`SaaS ${path} 返回 ${res.status}`)
  return (await res.json()) as T
}

export type PingResult = {
  ok: boolean
  source: SaasSource
  storeCount?: number
  message: string
}

/** 测试连接:调用 ping 接口,返回成功 / 失败 + 门店数 */
export async function pingSaas(baseUrl: string, apiKey: string): Promise<PingResult> {
  const base = baseUrl.replace(/\/$/, '')
  try {
    const res = await fetch(base + '/api/agent/ping', {
      headers: { 'X-Api-Key': apiKey, Accept: 'application/json' },
      cache: 'no-store',
    })
    if (!res.ok) {
      return { ok: false, source: 'live', message: `连接失败:HTTP ${res.status}` }
    }
    const data = (await res.json().catch(() => ({}))) as { storeCount?: number }
    return {
      ok: true,
      source: 'live',
      storeCount: data.storeCount,
      message: `连接成功${data.storeCount != null ? `,共 ${data.storeCount} 家门店` : ''}`,
    }
  } catch (err) {
    return { ok: false, source: 'live', message: `连接异常:${(err as Error).message}` }
  }
}

// ---------------------------------------------------------------------------
// 单门店全量拉数(真实接口失败自动降级 mock)
// ---------------------------------------------------------------------------

export async function pullStore(
  userId: string,
  storeCode: string,
  range: PullRange = {},
): Promise<SaasStorePull> {
  const cfg = await resolveSaasConfig(userId)
  if (!cfg) return buildMockPull(storeCode)

  try {
    const [topUps, consumes, dailyRevenue, payroll, purchases] = await Promise.all([
      saasGet<TopUp[]>(cfg, '/api/agent/members/topups', { storeCode, from: range.from, to: range.to }),
      saasGet<Consume[]>(cfg, '/api/agent/members/consumes', { storeCode, from: range.from, to: range.to }),
      saasGet<DailyRevenue[]>(cfg, '/api/agent/store/daily-revenue', { storeCode, from: range.from, to: range.to }),
      saasGet<PayrollItem[]>(cfg, '/api/agent/payroll', { storeCode, period: range.period }),
      saasGet<Purchase[]>(cfg, '/api/agent/purchases', { storeCode, from: range.from, to: range.to }),
    ])
    return { source: 'live', storeCode, topUps, consumes, dailyRevenue, payroll, purchases }
  } catch (err) {
    console.log('[v0] SaaS 拉数失败,降级 mock:', (err as Error).message)
    return buildMockPull(storeCode)
  }
}

// ---------------------------------------------------------------------------
// 兼容旧会员对账契约(membership-panel 使用)
// ---------------------------------------------------------------------------

export type MembershipReconciliation = {
  source: SaasSource
  memberCount: number
  totalTopUp: number
  totalBonus: number
  totalConsumed: number
  deferredLiability: number
  topUps: TopUp[]
  consumes: Consume[]
}

export async function getMembershipReconciliation(
  userId: string,
  storeCode: string,
): Promise<MembershipReconciliation> {
  const pull = await pullStore(userId, storeCode)
  const totalTopUp = pull.topUps.reduce((s, r) => s + r.amount, 0)
  const totalBonus = pull.topUps.reduce((s, r) => s + r.bonus, 0)
  const totalConsumed = pull.consumes.reduce((s, r) => s + r.amount, 0)
  const memberNos = new Set([
    ...pull.topUps.map((r) => r.memberNo),
    ...pull.consumes.map((r) => r.memberNo),
  ])
  return {
    source: pull.source,
    memberCount: memberNos.size,
    totalTopUp,
    totalBonus,
    totalConsumed,
    deferredLiability: totalTopUp + totalBonus - totalConsumed,
    topUps: pull.topUps,
    consumes: pull.consumes,
  }
}

// ---------------------------------------------------------------------------
// 模拟数据(接入真实接口前用于跑通)
// ---------------------------------------------------------------------------

function buildMockPull(seed: string): SaasStorePull {
  let h = 0
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) % 100000
  const rnd = (n: number) => {
    h = (h * 1103515245 + 12345) % 2147483648
    return Math.floor(h / 0x10000) % n
  }
  const names = ['王雅琴', '李梦洁', '陈思远', '赵敏', '周慧', '孙佳', '吴婷', '郑爽']
  const techs = ['林夕', '苏晴', '何雨', '柳青']
  const channels = ['微信', '支付宝', '对公转账', '现金']
  const items = ['面部护理', '美甲套餐', '身体SPA', '皮肤管理', '头疗养护']
  const suppliers = ['雅美供应链', '丽人耗材', '美域生物', '正和医疗器械']
  const products = ['精华原液', '面膜', '一次性耗材', '护理套盒']
  const month = () => `2026-0${1 + rnd(5)}-${String(1 + rnd(27)).padStart(2, '0')}`

  const topUps: TopUp[] = Array.from({ length: 8 }).map((_, i) => {
    const amount = (rnd(20) + 5) * 500
    return {
      id: `T${seed}-${i}`,
      memberNo: `M${10000 + rnd(8999)}`,
      memberName: names[rnd(names.length)],
      amount,
      bonus: Math.round(amount * 0.1),
      channel: channels[rnd(channels.length)],
      date: month(),
      storeCode: seed,
    }
  })
  const consumes: Consume[] = Array.from({ length: 10 }).map((_, i) => ({
    id: `C${seed}-${i}`,
    memberNo: `M${10000 + rnd(8999)}`,
    memberName: names[rnd(names.length)],
    amount: (rnd(8) + 1) * 280,
    item: items[rnd(items.length)],
    technician: techs[rnd(techs.length)],
    date: month(),
    storeCode: seed,
    serviceRecordId: `SR${seed}-${100 + i}`,
  }))
  const dailyRevenue: DailyRevenue[] = Array.from({ length: 6 }).map(() => {
    const cash = rnd(8) * 300
    const card = rnd(20) * 300
    const wechat = rnd(30) * 300
    const alipay = rnd(15) * 300
    const storedValue = rnd(25) * 300
    return {
      date: month(),
      storeCode: seed,
      cash,
      card,
      wechat,
      alipay,
      storedValue,
      total: cash + card + wechat + alipay + storedValue,
    }
  })
  const positions = ['店长', '美容顾问', '技师', '前台']
  const payroll: PayrollItem[] = Array.from({ length: 4 }).map((_, i) => {
    const base = 4000 + rnd(40) * 100
    const commission = rnd(60) * 100
    const bonus = rnd(20) * 100
    const insurance = Math.round(base * 0.105)
    const gross = base + commission + bonus
    const tax = Math.max(0, Math.round((gross - insurance - 5000) * 0.03))
    return {
      period: '2026-05',
      storeCode: seed,
      employeeName: names[(i + rnd(4)) % names.length],
      position: positions[i % positions.length],
      base,
      commission,
      bonus,
      insurance,
      gross,
      tax,
      net: gross - insurance - tax,
    }
  })
  const purchases: Purchase[] = Array.from({ length: 5 }).map((_, i) => {
    const amount = (rnd(30) + 3) * 200
    return {
      id: `P${seed}-${i}`,
      date: month(),
      storeCode: seed,
      supplier: suppliers[rnd(suppliers.length)],
      product: products[rnd(products.length)],
      qty: 1 + rnd(20),
      amount,
      taxAmount: Math.round((amount / 1.13) * 0.13),
      invoiceNo: `04${rnd(99999999)}`,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as Purchase
  })

  return { source: 'mock', storeCode: seed, topUps, consumes, dailyRevenue, payroll, purchases }
}
