'use server'

import { db } from '@/lib/db'
import {
  entities,
  transactions,
  saasConfig,
  saasEntityMap,
  orgProfile,
} from '@/lib/db/schema'
import { getScope } from '@/lib/scope'
import { getTaxProfile, calcTax } from '@/lib/tax-policy'
import { encryptSecret, decryptSecret, maskSecret } from '@/lib/crypto'
import {
  pingSaas,
  pullStore,
  resolveStoreCode,
  type PingResult,
} from '@/lib/saas-integration'
import { and, eq } from 'drizzle-orm'
import { revalidatePath } from 'next/cache'

// ---------------------------------------------------------------------------
// 读取设置:配置 + 主体映射表 + 同步状态
// ---------------------------------------------------------------------------
export type SaasEntityMapRow = {
  entityId: number
  name: string
  code: string
  storeCode: string
  isDefault: boolean
}

export type SaasSyncReport = {
  at: string
  trigger?: 'manual' | 'auto' | 'repair'
  byType: { topUps: number; consumes: number; dailyRevenue: number; payroll: number; purchases: number }
  added: number
  skipped: number
  storeResults: { entityName: string; storeCode: string; source: 'live' | 'mock'; added: number; skipped: number }[]
}

export type SaasSettings = {
  baseUrl: string
  apiKeyMasked: string
  hasKey: boolean
  status: string
  lastTestedAt: string | null
  lastSyncedAt: string | null
  lastSyncReport: SaasSyncReport | null
  envConfigured: boolean
  mappings: SaasEntityMapRow[]
}

export async function getSaasSettings(): Promise<SaasSettings> {
  const scope = await getScope()
  if (scope.role !== 'group') throw new Error('仅集团管理员可访问')

  const [cfg] = await db
    .select()
    .from(saasConfig)
    .where(eq(saasConfig.userId, scope.ownerId))
    .limit(1)

  const ents = await db
    .select({ id: entities.id, name: entities.name, code: entities.code })
    .from(entities)
    .where(eq(entities.userId, scope.ownerId))
    .orderBy(entities.code)

  const maps = await db
    .select({ entityId: saasEntityMap.entityId, storeCode: saasEntityMap.storeCode })
    .from(saasEntityMap)
    .where(eq(saasEntityMap.userId, scope.ownerId))
  const mapByEntity = new Map(maps.map((m) => [m.entityId, m.storeCode]))

  const decKey = decryptSecret(cfg?.apiKeyEnc)

  return {
    baseUrl: cfg?.baseUrl ?? '',
    apiKeyMasked: maskSecret(decKey),
    hasKey: !!decKey,
    status: cfg?.status ?? 'unconfigured',
    lastTestedAt: cfg?.lastTestedAt ? cfg.lastTestedAt.toISOString() : null,
    lastSyncedAt: cfg?.lastSyncedAt ? cfg.lastSyncedAt.toISOString() : null,
    lastSyncReport: (cfg?.lastSyncReport as SaasSyncReport | null) ?? null,
    envConfigured: !!(process.env.SAAS_API_BASE_URL && process.env.SAAS_API_KEY),
    mappings: ents.map((e) => ({
      entityId: e.id,
      name: e.name,
      code: e.code,
      storeCode: mapByEntity.get(e.id) ?? e.code,
      isDefault: !mapByEntity.has(e.id),
    })),
  }
}

// ---------------------------------------------------------------------------
// 保存对接配置(接口地址 + API Key 加密存)
// ---------------------------------------------------------------------------
export type SaveResult = { ok: true } | { ok: false; error: string }

export async function saveSaasConfig(input: {
  baseUrl: string
  apiKey?: string // 留空表示不修改已存密钥
}): Promise<SaveResult> {
  const scope = await getScope()
  if (scope.role !== 'group') return { ok: false, error: '仅集团管理员可配置' }

  const baseUrl = input.baseUrl.trim()
  if (baseUrl && !/^https?:\/\//i.test(baseUrl)) {
    return { ok: false, error: '接口地址需以 http:// 或 https:// 开头' }
  }

  const [existing] = await db
    .select()
    .from(saasConfig)
    .where(eq(saasConfig.userId, scope.ownerId))
    .limit(1)

  const apiKeyEnc =
    input.apiKey && input.apiKey.trim()
      ? encryptSecret(input.apiKey.trim())
      : existing?.apiKeyEnc ?? null

  const status = baseUrl && apiKeyEnc ? 'connected' : 'unconfigured'

  if (existing) {
    await db
      .update(saasConfig)
      .set({ baseUrl: baseUrl || null, apiKeyEnc, status, updatedAt: new Date() })
      .where(eq(saasConfig.userId, scope.ownerId))
  } else {
    await db.insert(saasConfig).values({
      userId: scope.ownerId,
      baseUrl: baseUrl || null,
      apiKeyEnc,
      status,
    })
  }

  revalidatePath('/settings')
  return { ok: true }
}

// ---------------------------------------------------------------------------
// 测试连接:用传入或已存配置 ping
// ---------------------------------------------------------------------------
export async function testSaasConnection(input?: {
  baseUrl?: string
  apiKey?: string
}): Promise<PingResult> {
  const scope = await getScope()
  if (scope.role !== 'group') return { ok: false, source: 'live', message: '无权限' }

  let baseUrl = input?.baseUrl?.trim()
  let apiKey = input?.apiKey?.trim()

  if (!baseUrl || !apiKey) {
    const [cfg] = await db
      .select()
      .from(saasConfig)
      .where(eq(saasConfig.userId, scope.ownerId))
      .limit(1)
    baseUrl = baseUrl || cfg?.baseUrl || process.env.SAAS_API_BASE_URL || ''
    apiKey = apiKey || decryptSecret(cfg?.apiKeyEnc) || process.env.SAAS_API_KEY || ''
  }

  if (!baseUrl || !apiKey) {
    return { ok: false, source: 'live', message: '请先填写接口地址与 API Key' }
  }

  const result = await pingSaas(baseUrl, apiKey)
  await db
    .update(saasConfig)
    .set({ lastTestedAt: new Date(), status: result.ok ? 'connected' : 'error' })
    .where(eq(saasConfig.userId, scope.ownerId))
  revalidatePath('/settings')
  return result
}

// ---------------------------------------------------------------------------
// 保存主体 → storeCode 映射
// ---------------------------------------------------------------------------
export async function saveEntityMapping(input: {
  entityId: number
  storeCode: string
}): Promise<SaveResult> {
  const scope = await getScope()
  if (scope.role !== 'group') return { ok: false, error: '无权限' }

  const [e] = await db
    .select({ id: entities.id, code: entities.code })
    .from(entities)
    .where(and(eq(entities.id, input.entityId), eq(entities.userId, scope.ownerId)))
    .limit(1)
  if (!e) return { ok: false, error: '主体不存在' }

  const code = input.storeCode.trim()
  const [existing] = await db
    .select({ id: saasEntityMap.id })
    .from(saasEntityMap)
    .where(and(eq(saasEntityMap.userId, scope.ownerId), eq(saasEntityMap.entityId, input.entityId)))
    .limit(1)

  // 与默认 code 相同则删除映射(回到默认)
  if (!code || code === e.code) {
    if (existing) {
      await db.delete(saasEntityMap).where(eq(saasEntityMap.id, existing.id))
    }
  } else if (existing) {
    await db.update(saasEntityMap).set({ storeCode: code }).where(eq(saasEntityMap.id, existing.id))
  } else {
    await db.insert(saasEntityMap).values({ userId: scope.ownerId, entityId: input.entityId, storeCode: code })
  }

  revalidatePath('/settings')
  return { ok: true }
}

// ---------------------------------------------------------------------------
// 立即同步:从 SaaS 拉取 → 写入/跳过本地流水(标记 source='saas')
// ---------------------------------------------------------------------------
const CHANNEL_FIELDS: { field: keyof import('@/lib/saas-integration').DailyRevenue; channel: string }[] = [
  { field: 'cash', channel: '现金' },
  { field: 'card', channel: '银行卡' },
  { field: 'wechat', channel: '微信' },
  { field: 'alipay', channel: '支付宝' },
  { field: 'storedValue', channel: '储值余额' },
]

/** 从 summary 中解析嵌入的同步去重键 [SAAS:...] */
function parseKey(summary: string | null): string | null {
  if (!summary) return null
  const m = summary.match(/\[(SAAS:[^\]]+)\]/)
  return m ? m[1] : null
}

export async function syncNow(): Promise<
  { ok: true; report: SaasSyncReport } | { ok: false; error: string }
> {
  const scope = await getScope()
  if (scope.role !== 'group') return { ok: false, error: '仅集团管理员可同步' }
  const report = await runSyncForOwner(scope.ownerId, 'manual')
  revalidatePath('/settings')
  revalidatePath('/')
  revalidatePath('/reports')
  revalidatePath('/tax-alerts')
  return { ok: true, report }
}

/**
 * 双架构同步核心:对某集团执行一次全量拉取 → 入库。
 * trigger 标识触发来源(manual 手动 / auto 自动补 / agent Agent回填后校验)。
 * pullStore 内部已实现「真实接口失败自动降级 mock」,即一条通道异常时仍能产出数据。
 */
async function runSyncForOwner(
  ownerId: string,
  trigger: 'manual' | 'auto' | 'repair',
): Promise<SaasSyncReport> {
  const ents = await db
    .select()
    .from(entities)
    .where(eq(entities.userId, ownerId))

  const report: SaasSyncReport = {
    at: new Date().toISOString(),
    trigger,
    byType: { topUps: 0, consumes: 0, dailyRevenue: 0, payroll: 0, purchases: 0 },
    added: 0,
    skipped: 0,
    storeResults: [],
  }
  const scope = { ownerId }

  for (const e of ents) {
    const storeCode = await resolveStoreCode(scope.ownerId, e.id, e.code)
    const pull = await pullStore(scope.ownerId, storeCode)
    const profile = getTaxProfile(e.entityType, e.taxpayerType)

    report.byType.topUps += pull.topUps.length
    report.byType.consumes += pull.consumes.length
    report.byType.dailyRevenue += pull.dailyRevenue.length
    report.byType.payroll += pull.payroll.length
    report.byType.purchases += pull.purchases.length

    // 已有的 saas 流水去重键
    const existingRows = await db
      .select({ summary: transactions.summary })
      .from(transactions)
      .where(
        and(
          eq(transactions.userId, scope.ownerId),
          eq(transactions.entityId, e.id),
          eq(transactions.source, 'saas'),
        ),
      )
    const existingKeys = new Set(
      existingRows.map((r) => parseKey(r.summary)).filter((k): k is string => !!k),
    )

    const inserts: (typeof transactions.$inferInsert)[] = []
    let storeAdded = 0
    let storeSkipped = 0

    // 门店日营业流水 → 收入(按渠道拆分)
    for (const dr of pull.dailyRevenue) {
      for (const cf of CHANNEL_FIELDS) {
        const amt = Number(dr[cf.field] ?? 0)
        if (!(amt > 0)) continue
        const key = `SAAS:dr:${storeCode}:${dr.date}:${cf.field}`
        if (existingKeys.has(key)) {
          storeSkipped++
          continue
        }
        existingKeys.add(key)
        const calc = calcTax(amt, profile.vatRate, profile.surtaxRate)
        inserts.push({
          userId: scope.ownerId,
          entityId: e.id,
          bizDate: dr.date,
          bizType: 'income',
          category: '门店营业',
          channel: cf.channel,
          amount: String(calc.gross),
          taxRate: String(profile.vatRate),
          taxAmount: String(calc.vat),
          surtaxAmount: String(calc.surtax),
          netAmount: String(calc.net),
          invoiced: false,
          summary: `门店营业·${cf.channel} [${key}]`,
          source: 'saas',
          status: 'posted',
        })
        storeAdded++
      }
    }

    // 采购 → 支出(进项)
    for (const p of pull.purchases) {
      const key = `SAAS:pur:${storeCode}:${p.id}`
      if (existingKeys.has(key)) {
        storeSkipped++
        continue
      }
      existingKeys.add(key)
      const gross = Number(p.amount)
      const tax = Number(p.taxAmount) || 0
      const net = Number((gross - tax).toFixed(2))
      inserts.push({
        userId: scope.ownerId,
        entityId: e.id,
        bizDate: p.date,
        bizType: 'expense',
        category: '产品采购',
        channel: '银行卡',
        amount: String(gross),
        taxRate: gross > 0 ? String(Number((tax / (gross - tax)).toFixed(4))) : '0',
        taxAmount: String(tax),
        surtaxAmount: '0',
        netAmount: String(net),
        invoiced: !!p.invoiceNo,
        invoiceMedium: p.invoiceNo ? 'electronic' : 'none',
        invoiceKind: p.invoiceNo ? 'special' : 'none',
        invoiceNo: p.invoiceNo || null,
        summary: `采购·${p.supplier}·${p.product} [${key}]`,
        source: 'saas',
        status: 'posted',
      })
      storeAdded++
    }

    if (inserts.length > 0) {
      await db.insert(transactions).values(inserts)
    }

    report.added += storeAdded
    report.skipped += storeSkipped
    report.storeResults.push({
      entityName: e.name,
      storeCode,
      source: pull.source,
      added: storeAdded,
      skipped: storeSkipped,
    })
  }

  // 确保有一行 saas_config 记录承载同步状态(自动通道下用户可能未手填配置)
  const [cfgRow] = await db
    .select({ id: saasConfig.id })
    .from(saasConfig)
    .where(eq(saasConfig.userId, ownerId))
    .limit(1)
  if (cfgRow) {
    await db
      .update(saasConfig)
      .set({ lastSyncedAt: new Date(), lastSyncReport: report })
      .where(eq(saasConfig.userId, ownerId))
  } else {
    await db.insert(saasConfig).values({
      userId: ownerId,
      lastSyncedAt: new Date(),
      lastSyncReport: report,
      status: 'connected',
    })
  }

  return report
}

// ---------------------------------------------------------------------------
// 双架构自动化同步:进入系统时自动补同步
// ---------------------------------------------------------------------------
// 架构说明(互为备份):
//   通道 A(Agent 推送):公司侧财务 Agent 凭 NOTA API 密钥主动回填流水(实时)。
//   通道 B(自动拉取):本系统按间隔主动从 SaaS 拉取并入库(兜底)。
// 当某条通道异常,另一条仍保证数据不断流;两者写入同一去重键,天然幂等不会重复。
//
// autoSyncIfDue:在布局渲染时被调用,若开启自动同步且距上次超过设定间隔,
// 则静默执行一次拉取补齐。失败不抛出,避免影响页面渲染。

export type AutoSyncResult =
  | { ran: true; report: SaasSyncReport }
  | { ran: false; reason: string }

export async function autoSyncIfDue(): Promise<AutoSyncResult> {
  let scope
  try {
    scope = await getScope()
  } catch {
    return { ran: false, reason: 'no-session' }
  }
  if (scope.role !== 'group') return { ran: false, reason: 'not-group' }

  const [profile] = await db
    .select()
    .from(orgProfile)
    .where(eq(orgProfile.userId, scope.ownerId))
    .limit(1)

  if (!profile?.autoSyncEnabled) return { ran: false, reason: 'disabled' }

  const intervalMs = (profile.autoSyncIntervalMin || 360) * 60 * 1000
  const last = profile.lastAutoSyncAt ? profile.lastAutoSyncAt.getTime() : 0
  if (Date.now() - last < intervalMs) return { ran: false, reason: 'not-due' }

  try {
    const report = await runSyncForOwner(scope.ownerId, 'auto')
    await db
      .update(orgProfile)
      .set({ lastAutoSyncAt: new Date() })
      .where(eq(orgProfile.userId, scope.ownerId))
    return { ran: true, report }
  } catch (e) {
    console.log('[v0] 自动补同步失败:', (e as Error).message)
    return { ran: false, reason: 'error' }
  }
}

// ---------------------------------------------------------------------------
// 双通道健康状态:供设置页健康面板展示
// ---------------------------------------------------------------------------
export type ChannelHealth = {
  agent: {
    configured: boolean // 是否已生成 NOTA API 密钥
    lastInboundAt: string | null // 最近一条 Agent 回填流水时间
    recentCount: number // 近 30 天 Agent 回填条数
    status: 'healthy' | 'idle' | 'down'
  }
  auto: {
    enabled: boolean
    configured: boolean // 是否已配置 SaaS 接口或环境变量
    lastSyncedAt: string | null
    intervalMin: number
    primary: boolean
    status: 'healthy' | 'idle' | 'down'
  }
  // 互备结论
  redundancy: 'dual' | 'single' | 'none'
}

export async function getChannelHealth(): Promise<ChannelHealth> {
  const scope = await getScope()
  if (scope.role !== 'group') throw new Error('仅集团管理员可访问')

  const { user: userTable } = await import('@/lib/db/schema')

  const [u] = await db
    .select({ key: userTable.agentApiKey })
    .from(userTable)
    .where(eq(userTable.id, scope.ownerId))
    .limit(1)

  const [profile] = await db
    .select()
    .from(orgProfile)
    .where(eq(orgProfile.userId, scope.ownerId))
    .limit(1)

  const [cfg] = await db
    .select()
    .from(saasConfig)
    .where(eq(saasConfig.userId, scope.ownerId))
    .limit(1)

  // Agent 通道:统计近 30 天 source='agent' 的回填流水
  const since = new Date()
  since.setDate(since.getDate() - 30)
  const agentRows = await db
    .select({ createdAt: transactions.createdAt })
    .from(transactions)
    .where(
      and(
        eq(transactions.userId, scope.ownerId),
        eq(transactions.source, 'agent'),
      ),
    )
  const recentAgent = agentRows.filter((r) => r.createdAt && r.createdAt >= since)
  const lastInbound = agentRows.reduce<Date | null>((max, r) => {
    if (r.createdAt && (!max || r.createdAt > max)) return r.createdAt
    return max
  }, null)

  const agentConfigured = !!u?.key
  const agentStatus: 'healthy' | 'idle' | 'down' = !agentConfigured
    ? 'down'
    : recentAgent.length > 0
      ? 'healthy'
      : 'idle'

  const autoConfigured = !!(
    (cfg?.baseUrl && cfg?.apiKeyEnc) ||
    (process.env.SAAS_API_BASE_URL && process.env.SAAS_API_KEY)
  )
  const autoEnabled = !!profile?.autoSyncEnabled
  const autoStatus: 'healthy' | 'idle' | 'down' = !autoEnabled
    ? 'down'
    : cfg?.lastSyncedAt
      ? 'healthy'
      : 'idle'

  const healthyChannels =
    (agentStatus !== 'down' ? 1 : 0) + (autoStatus !== 'down' ? 1 : 0)

  return {
    agent: {
      configured: agentConfigured,
      lastInboundAt: lastInbound ? lastInbound.toISOString() : null,
      recentCount: recentAgent.length,
      status: agentStatus,
    },
    auto: {
      enabled: autoEnabled,
      configured: autoConfigured,
      lastSyncedAt: cfg?.lastSyncedAt ? cfg.lastSyncedAt.toISOString() : null,
      intervalMin: profile?.autoSyncIntervalMin || 360,
      primary: profile?.primaryChannel === 'auto',
      status: autoStatus,
    },
    redundancy: healthyChannels >= 2 ? 'dual' : healthyChannels === 1 ? 'single' : 'none',
  }
}
