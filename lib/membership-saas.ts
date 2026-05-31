import 'server-only'

/**
 * 会员 SaaS 对接层(REST + API Key)。
 *
 * 设计原则:接口契约固定,数据来源可切换。
 * - 当配置了环境变量 SAAS_API_BASE_URL + SAAS_API_KEY 时,走真实 REST 接口;
 * - 未配置时回退到内置模拟数据,保证 UI 可跑通,接入真实接口时无需改 UI。
 *
 * 真实接入只需在 Vercel 项目 Vars 中填入:
 *   SAAS_API_BASE_URL  例如 https://api.your-saas.com
 *   SAAS_API_KEY       会员系统下发的 API 密钥
 * 若你的接口路径/字段与默认契约不同,只需调整本文件的 fetch 路径与字段映射。
 */

// ---------------------------------------------------------------------------
// 对账数据契约(UI 与上层依赖这些类型,保持稳定)
// ---------------------------------------------------------------------------

/** 会员储值充值流水 */
export type TopUpRecord = {
  id: string
  memberName: string
  memberNo: string
  amount: number // 充值金额
  bonus: number // 赠送金额
  channel: string // 充值渠道
  date: string // YYYY-MM-DD
}

/** 会员消费核销明细 */
export type ConsumeRecord = {
  id: string
  memberName: string
  memberNo: string
  amount: number // 核销金额(扣减储值)
  item: string // 消费项目
  date: string
}

/** 门店会员对账汇总 */
export type MembershipReconciliation = {
  /** 数据来源:live=真实接口,mock=模拟数据 */
  source: 'live' | 'mock'
  memberCount: number
  totalTopUp: number // 累计充值
  totalBonus: number // 累计赠送
  totalConsumed: number // 累计核销
  /** 预收负债余额 = 充值+赠送-核销 */
  deferredLiability: number
  topUps: TopUpRecord[]
  consumes: ConsumeRecord[]
}

// ---------------------------------------------------------------------------
// 真实接口调用(env 配置后启用)
// ---------------------------------------------------------------------------

function getConfig() {
  const baseUrl = process.env.SAAS_API_BASE_URL
  const apiKey = process.env.SAAS_API_KEY
  if (baseUrl && apiKey) return { baseUrl, apiKey }
  return null
}

async function saasFetch<T>(
  baseUrl: string,
  apiKey: string,
  path: string,
  storeCode: string,
): Promise<T> {
  const url = new URL(path, baseUrl)
  url.searchParams.set('storeCode', storeCode)
  const res = await fetch(url.toString(), {
    headers: {
      // REST + API Key:按你的会员系统约定的 header 名传递
      'X-Api-Key': apiKey,
      Accept: 'application/json',
    },
    // 对账数据有时效性,缓存 60s
    next: { revalidate: 60 },
  })
  if (!res.ok) {
    throw new Error(`SaaS API ${path} 返回 ${res.status}`)
  }
  return (await res.json()) as T
}

/**
 * 拉取某门店的会员对账数据。
 * @param storeCode 门店在 SaaS 中的编码(此处用主体 code)
 */
export async function getMembershipReconciliation(
  storeCode: string,
): Promise<MembershipReconciliation> {
  const config = getConfig()
  if (!config) {
    return buildMockReconciliation(storeCode)
  }

  try {
    // 真实接口契约(可按实际调整路径/字段):
    //   GET {base}/v1/members/topups?storeCode=...   -> TopUpRecord[]
    //   GET {base}/v1/members/consumes?storeCode=...  -> ConsumeRecord[]
    const [topUps, consumes] = await Promise.all([
      saasFetch<TopUpRecord[]>(config.baseUrl, config.apiKey, '/v1/members/topups', storeCode),
      saasFetch<ConsumeRecord[]>(config.baseUrl, config.apiKey, '/v1/members/consumes', storeCode),
    ])
    return summarize('live', topUps, consumes)
  } catch (err) {
    console.log('[v0] SaaS 会员接口调用失败,回退模拟数据:', (err as Error).message)
    return buildMockReconciliation(storeCode)
  }
}

// ---------------------------------------------------------------------------
// 汇总计算
// ---------------------------------------------------------------------------

function summarize(
  source: 'live' | 'mock',
  topUps: TopUpRecord[],
  consumes: ConsumeRecord[],
): MembershipReconciliation {
  const totalTopUp = topUps.reduce((s, r) => s + r.amount, 0)
  const totalBonus = topUps.reduce((s, r) => s + r.bonus, 0)
  const totalConsumed = consumes.reduce((s, r) => s + r.amount, 0)
  const memberNos = new Set([
    ...topUps.map((r) => r.memberNo),
    ...consumes.map((r) => r.memberNo),
  ])
  return {
    source,
    memberCount: memberNos.size,
    totalTopUp,
    totalBonus,
    totalConsumed,
    deferredLiability: totalTopUp + totalBonus - totalConsumed,
    topUps,
    consumes,
  }
}

// ---------------------------------------------------------------------------
// 模拟数据(接入真实接口前用于跑通 UI)
// ---------------------------------------------------------------------------

function buildMockReconciliation(seed: string): MembershipReconciliation {
  // 基于 storeCode 生成稳定的伪随机,保证刷新数据不跳变
  let h = 0
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) % 100000
  const rnd = (n: number) => {
    // LCG 低位比特随机性差,取高位比特再取模,避免 % n 结果固定
    h = (h * 1103515245 + 12345) % 2147483648
    return Math.floor(h / 0x10000) % n
  }

  const names = ['王雅琴', '李梦洁', '陈思远', '赵敏', '周慧', '孙佳', '吴婷', '郑爽']
  const topChannels = ['微信', '支付宝', '对公转账', '现金']
  const items = ['面部护理', '美甲套餐', '身体SPA', '皮肤管理', '头疗养护']

  const topUps: TopUpRecord[] = Array.from({ length: 8 }).map((_, i) => {
    const amount = (rnd(20) + 5) * 500
    return {
      id: `T${seed}-${i}`,
      memberName: names[rnd(names.length)],
      memberNo: `M${10000 + rnd(8999)}`,
      amount,
      bonus: Math.round(amount * 0.1),
      channel: topChannels[rnd(topChannels.length)],
      date: `2026-0${1 + rnd(5)}-${String(1 + rnd(27)).padStart(2, '0')}`,
    }
  })

  const consumes: ConsumeRecord[] = Array.from({ length: 10 }).map((_, i) => ({
    id: `C${seed}-${i}`,
    memberName: names[rnd(names.length)],
    memberNo: `M${10000 + rnd(8999)}`,
    amount: (rnd(8) + 1) * 280,
    item: items[rnd(items.length)],
    date: `2026-0${1 + rnd(5)}-${String(1 + rnd(27)).padStart(2, '0')}`,
  }))

  return summarize('mock', topUps, consumes)
}
