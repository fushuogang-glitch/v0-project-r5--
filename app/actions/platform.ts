'use server'

import { pool } from '@/lib/db'
import { requirePlatformAdmin } from '@/lib/platform'
import { notifyPlatform } from '@/lib/platform-notify'
import { revalidatePath } from 'next/cache'

// ---------------------------------------------------------------------------
// 阈值常量(天)
// ---------------------------------------------------------------------------
const OFFLINE_RISK_DAYS = 14 // 超过=实例离线(严重)
const OFFLINE_WARN_DAYS = 7
const DATA_RISK_DAYS = 7 // 超过无新流水=数据断流(严重)
const DATA_WARN_DAYS = 3
const SYNC_STALE_DAYS = 3 // 同步/Agent 双通道均停滞
const AUDIT_GRACE_DAY = 5 // 每月 5 号后仍未审计才告警
const SCAN_THROTTLE_MS = 2 * 60 * 60 * 1000 // 自动扫描节流:2 小时

function periodNow(): string {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}
function todayStr(): string {
  return new Date().toISOString().slice(0, 10)
}
function daysSince(d: Date | null): number | null {
  if (!d) return null
  return Math.floor((Date.now() - new Date(d).getTime()) / 86400000)
}

// ---------------------------------------------------------------------------
// 核心:跨全租户健康扫描(集合聚合,适配 500+ 租户)
// 幂等:tenant_health 按 (tenantId, snapshotDate) upsert;platform_alerts 按 (tenantId, code) upsert
// ---------------------------------------------------------------------------
type Agg = {
  tenantId: string
  tenantName: string
  entityCount: number
  txnCount30d: number
  lastTxnAt: Date | null
  lastLoginAt: Date | null
  lastSyncAt: Date | null
  agentCount30d: number
  revenue30d: number
  auditRan: boolean
}

export async function runPlatformHealthScan(): Promise<{ tenants: number; alerts: number }> {
  await requirePlatformAdmin()
  return scanAllTenants()
}

async function scanAllTenants(): Promise<{ tenants: number; alerts: number }> {
  const period = periodNow()
  const snapshot = todayStr()

  // 1) 租户主账号(= 软件实例):group 主账号、无财务岗位、无 ownerId
  const tenantsRes = await pool.query(
    `SELECT id, name, COALESCE("displayUsername", username, email) AS login
       FROM "user"
      WHERE role = 'group' AND "financeRole" IS NULL AND "ownerId" IS NULL`,
  )
  const tenants = tenantsRes.rows as { id: string; name: string; login: string }[]
  if (tenants.length === 0) return { tenants: 0, alerts: 0 }

  const agg = new Map<string, Agg>()
  for (const t of tenants) {
    agg.set(t.id, {
      tenantId: t.id,
      tenantName: t.name || t.login,
      entityCount: 0,
      txnCount30d: 0,
      lastTxnAt: null,
      lastLoginAt: null,
      lastSyncAt: null,
      agentCount30d: 0,
      revenue30d: 0,
      auditRan: false,
    })
  }

  // 2) 主体数(按 userId 分组)
  const ent = await pool.query(
    `SELECT "userId" AS id, COUNT(*)::int AS c FROM entities GROUP BY "userId"`,
  )
  for (const r of ent.rows) agg.get(r.id) && (agg.get(r.id)!.entityCount = r.c)

  // 3) 流水心跳 + 近 30 天笔数 + Agent 回填数(按 userId 分组,一次扫描)
  const txn = await pool.query(
    `SELECT "userId" AS id,
            MAX("createdAt") AS last_txn,
            COUNT(*) FILTER (WHERE "createdAt" >= now() - interval '30 days')::int AS c30,
            COUNT(*) FILTER (WHERE source = 'agent' AND "createdAt" >= now() - interval '30 days')::int AS agent30
       FROM transactions GROUP BY "userId"`,
  )
  for (const r of txn.rows) {
    const a = agg.get(r.id)
    if (!a) continue
    a.lastTxnAt = r.last_txn
    a.txnCount30d = r.c30
    a.agentCount30d = r.agent30
  }

  // 4) 近 30 天收入(聚合金额,按 bizDate)
  const rev = await pool.query(
    `SELECT "userId" AS id, COALESCE(SUM(amount), 0) AS rev
       FROM transactions
      WHERE "bizType" = 'income' AND "bizDate" >= (CURRENT_DATE - 30)
      GROUP BY "userId"`,
  )
  for (const r of rev.rows) agg.get(r.id) && (agg.get(r.id)!.revenue30d = Number(r.rev))

  // 5) 最近登录(session.createdAt 按 userId 分组),映射到租户主账号
  //    子账号登录也算该租户活跃,故按 user.ownerId/ id 归并
  const login = await pool.query(
    `SELECT COALESCE(u."ownerId", u.id) AS tenant, MAX(s."createdAt") AS last_login
       FROM session s JOIN "user" u ON u.id = s."userId"
      GROUP BY COALESCE(u."ownerId", u.id)`,
  )
  for (const r of login.rows) {
    const a = agg.get(r.tenant)
    if (a) a.lastLoginAt = r.last_login
  }

  // 6) 最近同步(saas_config.lastSyncedAt)
  const sync = await pool.query(`SELECT "userId" AS id, "lastSyncedAt" AS last_sync FROM saas_config`)
  for (const r of sync.rows) agg.get(r.id) && (agg.get(r.id)!.lastSyncAt = r.last_sync)

  // 7) 本月是否已审计
  const aud = await pool.query(
    `SELECT DISTINCT "userId" AS id FROM audit_findings WHERE period = $1`,
    [period],
  )
  for (const r of aud.rows) agg.get(r.id) && (agg.get(r.id)!.auditRan = true)

  // 8) 计算健康分 + 状态 + 告警,批量 upsert
  const dayOfMonth = new Date().getDate()
  const healthRows: unknown[][] = []
  const activeAlerts: {
    tenantId: string
    tenantName: string
    code: string
    dimension: string
    level: string
    title: string
    detail: string
    metric: number | null
  }[] = []

  for (const a of agg.values()) {
    let score = 100
    const loginDays = daysSince(a.lastLoginAt)
    const txnDays = daysSince(a.lastTxnAt)
    const syncDays = daysSince(a.lastSyncAt)
    const isNew = a.entityCount === 0 && a.txnCount30d === 0

    // 离线
    if (!isNew) {
      if (loginDays == null || loginDays >= OFFLINE_RISK_DAYS) {
        score -= 25
        activeAlerts.push({
          tenantId: a.tenantId, tenantName: a.tenantName, code: 'offline',
          dimension: 'offline', level: 'risk', title: '实例离线',
          detail: loginDays == null ? '从未登录或无登录记录' : `已 ${loginDays} 天无人登录`,
          metric: loginDays,
        })
      } else if (loginDays >= OFFLINE_WARN_DAYS) {
        score -= 10
        activeAlerts.push({
          tenantId: a.tenantId, tenantName: a.tenantName, code: 'offline',
          dimension: 'offline', level: 'warn', title: '登录活跃下降',
          detail: `已 ${loginDays} 天无人登录`, metric: loginDays,
        })
      }
    }

    // 数据断流
    if (!isNew) {
      if (txnDays == null || txnDays >= DATA_RISK_DAYS) {
        score -= 30
        activeAlerts.push({
          tenantId: a.tenantId, tenantName: a.tenantName, code: 'data',
          dimension: 'data', level: 'risk', title: '数据断流',
          detail: txnDays == null ? '无任何流水数据' : `已 ${txnDays} 天无新流水`,
          metric: txnDays,
        })
      } else if (txnDays >= DATA_WARN_DAYS) {
        score -= 10
        activeAlerts.push({
          tenantId: a.tenantId, tenantName: a.tenantName, code: 'data',
          dimension: 'data', level: 'warn', title: '数据上传放缓',
          detail: `已 ${txnDays} 天无新流水`, metric: txnDays,
        })
      }
    }

    // 同步停滞:无 Agent 回填且同步停滞
    if (!isNew && a.agentCount30d === 0 && (syncDays == null || syncDays >= SYNC_STALE_DAYS)) {
      score -= 15
      activeAlerts.push({
        tenantId: a.tenantId, tenantName: a.tenantName, code: 'sync',
        dimension: 'sync', level: 'warn', title: '同步通道停滞',
        detail: syncDays == null ? '无自动同步与 Agent 回填记录' : `同步已停滞 ${syncDays} 天且无 Agent 回填`,
        metric: syncDays,
      })
    }

    // 审计未运行
    if (!isNew && !a.auditRan && dayOfMonth >= AUDIT_GRACE_DAY) {
      score -= 10
      activeAlerts.push({
        tenantId: a.tenantId, tenantName: a.tenantName, code: 'audit',
        dimension: 'audit', level: 'warn', title: '本月未审计',
        detail: `已过 ${dayOfMonth} 号,本月尚未生成审计报告`, metric: dayOfMonth,
      })
    }

    score = Math.max(0, Math.min(100, score))
    const status = isNew ? 'ok' : score >= 80 ? 'ok' : score >= 50 ? 'risk' : 'down'

    healthRows.push([
      a.tenantId, snapshot, a.tenantName, a.entityCount, a.txnCount30d,
      a.lastTxnAt, a.lastLoginAt, a.lastSyncAt, a.agentCount30d, a.auditRan,
      a.revenue30d, score, status,
    ])
  }

  // 批量 upsert 健康快照(分批,每批 200 行)
  await batchUpsertHealth(healthRows)

  // 告警 upsert + 自动消解
  const alertCount = await reconcileAlerts(activeAlerts)

  return { tenants: tenants.length, alerts: alertCount }
}

async function batchUpsertHealth(rows: unknown[][]) {
  const BATCH = 200
  for (let i = 0; i < rows.length; i += BATCH) {
    const slice = rows.slice(i, i + BATCH)
    const values: string[] = []
    const params: unknown[] = []
    slice.forEach((r, idx) => {
      const b = idx * 13
      values.push(
        `($${b + 1},$${b + 2},$${b + 3},$${b + 4},$${b + 5},$${b + 6},$${b + 7},$${b + 8},$${b + 9},$${b + 10},$${b + 11},$${b + 12},$${b + 13})`,
      )
      params.push(...r)
    })
    await pool.query(
      `INSERT INTO tenant_health
         ("tenantId","snapshotDate","tenantName","entityCount","txnCount30d","lastTxnAt","lastLoginAt","lastSyncAt","agentCount30d","auditRan","revenue30d","healthScore",status)
       VALUES ${values.join(',')}
       ON CONFLICT ("tenantId","snapshotDate") DO UPDATE SET
         "tenantName"=EXCLUDED."tenantName","entityCount"=EXCLUDED."entityCount","txnCount30d"=EXCLUDED."txnCount30d",
         "lastTxnAt"=EXCLUDED."lastTxnAt","lastLoginAt"=EXCLUDED."lastLoginAt","lastSyncAt"=EXCLUDED."lastSyncAt",
         "agentCount30d"=EXCLUDED."agentCount30d","auditRan"=EXCLUDED."auditRan","revenue30d"=EXCLUDED."revenue30d",
         "healthScore"=EXCLUDED."healthScore",status=EXCLUDED.status,"createdAt"=now()`,
      params,
    )
  }
}

async function reconcileAlerts(
  active: {
    tenantId: string; tenantName: string; code: string; dimension: string
    level: string; title: string; detail: string; metric: number | null
  }[],
): Promise<number> {
  // 1) upsert 活动告警(已存在则更新内容并保持 open,首现时间不变)
  const BATCH = 150
  for (let i = 0; i < active.length; i += BATCH) {
    const slice = active.slice(i, i + BATCH)
    const values: string[] = []
    const params: unknown[] = []
    slice.forEach((a, idx) => {
      const b = idx * 8
      values.push(`($${b + 1},$${b + 2},$${b + 3},$${b + 4},$${b + 5},$${b + 6},$${b + 7},$${b + 8})`)
      params.push(a.tenantId, a.tenantName, a.code, a.dimension, a.level, a.title, a.detail, a.metric)
    })
    await pool.query(
      `INSERT INTO platform_alerts ("tenantId","tenantName",code,dimension,level,title,detail,metric)
       VALUES ${values.join(',')}
       ON CONFLICT ("tenantId",code) DO UPDATE SET
         "tenantName"=EXCLUDED."tenantName",dimension=EXCLUDED.dimension,level=EXCLUDED.level,
         title=EXCLUDED.title,detail=EXCLUDED.detail,metric=EXCLUDED.metric,
         status='open',"resolvedAt"=NULL,"updatedAt"=now()`,
      params,
    )
  }

  // 2) 自动消解:此前 open 但本轮已不再触发的告警 → resolved
  if (active.length === 0) {
    await pool.query(
      `UPDATE platform_alerts SET status='resolved',"resolvedAt"=now(),"updatedAt"=now() WHERE status='open'`,
    )
  } else {
    const pairs: string[] = []
    const params: unknown[] = []
    active.forEach((a, idx) => {
      pairs.push(`($${idx * 2 + 1},$${idx * 2 + 2})`)
      params.push(a.tenantId, a.code)
    })
    await pool.query(
      `UPDATE platform_alerts SET status='resolved',"resolvedAt"=now(),"updatedAt"=now()
        WHERE status='open' AND ("tenantId",code) NOT IN (${pairs.join(',')})`,
      params,
    )
  }

  // 3) 预留通知:对尚未通知的严重告警推送(stub,仅标记)
  const pending = await pool.query(
    `SELECT id, "tenantName", title, detail FROM platform_alerts
      WHERE status='open' AND level='risk' AND notified=false`,
  )
  for (const row of pending.rows) {
    await notifyPlatform({ title: `[严重] ${row.tenantName} · ${row.title}`, body: row.detail ?? '' })
    await pool.query(`UPDATE platform_alerts SET notified=true WHERE id=$1`, [row.id])
  }

  const { rows } = await pool.query(`SELECT COUNT(*)::int AS c FROM platform_alerts WHERE status='open'`)
  return rows[0]?.c ?? 0
}

// ---------------------------------------------------------------------------
// 自动扫描节流:进入中控台时若距上次扫描超过阈值则跑一次(失败不抛)
// ---------------------------------------------------------------------------
export async function autoRunPlatformScanIfDue(): Promise<{ ran: boolean }> {
  try {
    await requirePlatformAdmin()
  } catch {
    return { ran: false }
  }
  try {
    const { rows } = await pool.query(`SELECT MAX("createdAt") AS last FROM tenant_health`)
    const last = rows[0]?.last ? new Date(rows[0].last).getTime() : 0
    if (Date.now() - last < SCAN_THROTTLE_MS) return { ran: false }
    await scanAllTenants()
    return { ran: true }
  } catch (e) {
    console.log('[v0] 平台健康扫描失败:', (e as Error).message)
    return { ran: false }
  }
}

// ---------------------------------------------------------------------------
// 读取:中控台概览 KPI
// ---------------------------------------------------------------------------
export type PlatformOverview = {
  scannedAt: string | null
  totalTenants: number
  okTenants: number
  riskTenants: number
  downTenants: number
  onboardingTenants: number
  avgHealthScore: number
  totalEntities: number
  totalRevenue30d: number
  openAlerts: number
  riskAlerts: number
}

export async function getPlatformOverview(): Promise<PlatformOverview> {
  await requirePlatformAdmin()
  const { rows } = await pool.query(
    `SELECT
        MAX("createdAt") AS scanned_at,
        COUNT(*)::int AS total,
        COUNT(*) FILTER (WHERE status='ok' AND ("entityCount">0 OR "txnCount30d">0))::int AS ok,
        COUNT(*) FILTER (WHERE status='risk')::int AS risk,
        COUNT(*) FILTER (WHERE status='down')::int AS down,
        COUNT(*) FILTER (WHERE "entityCount"=0 AND "txnCount30d"=0)::int AS onboarding,
        COALESCE(ROUND(AVG("healthScore")),0)::int AS avg_score,
        COALESCE(SUM("entityCount"),0)::int AS entities,
        COALESCE(SUM("revenue30d"),0) AS revenue
       FROM tenant_health
      WHERE "snapshotDate" = (SELECT MAX("snapshotDate") FROM tenant_health)`,
  )
  const r = rows[0] ?? {}
  const alerts = await pool.query(
    `SELECT COUNT(*) FILTER (WHERE status='open')::int AS open,
            COUNT(*) FILTER (WHERE status='open' AND level='risk')::int AS risk
       FROM platform_alerts`,
  )
  const a = alerts.rows[0] ?? {}
  return {
    scannedAt: r.scanned_at ? new Date(r.scanned_at).toISOString() : null,
    totalTenants: r.total ?? 0,
    okTenants: r.ok ?? 0,
    riskTenants: r.risk ?? 0,
    downTenants: r.down ?? 0,
    onboardingTenants: r.onboarding ?? 0,
    avgHealthScore: r.avg_score ?? 0,
    totalEntities: r.entities ?? 0,
    totalRevenue30d: Number(r.revenue ?? 0),
    openAlerts: a.open ?? 0,
    riskAlerts: a.risk ?? 0,
  }
}

// ---------------------------------------------------------------------------
// 读取:实例健康矩阵(最新快照)
// ---------------------------------------------------------------------------
export type TenantHealthRow = {
  tenantId: string
  tenantName: string
  entityCount: number
  txnCount30d: number
  revenue30d: number
  healthScore: number
  status: string
  lastLoginAt: string | null
  lastTxnAt: string | null
  isOnboarding: boolean
}

export async function getTenantHealthList(filter?: 'all' | 'risk' | 'down' | 'ok'): Promise<TenantHealthRow[]> {
  await requirePlatformAdmin()
  const where: string[] = [`"snapshotDate" = (SELECT MAX("snapshotDate") FROM tenant_health)`]
  if (filter === 'risk') where.push(`status='risk'`)
  else if (filter === 'down') where.push(`status='down'`)
  else if (filter === 'ok') where.push(`status='ok' AND ("entityCount">0 OR "txnCount30d">0)`)
  const { rows } = await pool.query(
    `SELECT "tenantId","tenantName","entityCount","txnCount30d","revenue30d","healthScore",status,"lastLoginAt","lastTxnAt"
       FROM tenant_health
      WHERE ${where.join(' AND ')}
      ORDER BY CASE status WHEN 'down' THEN 0 WHEN 'risk' THEN 1 ELSE 2 END, "healthScore" ASC
      LIMIT 500`,
  )
  return rows.map((r) => ({
    tenantId: r.tenantId,
    tenantName: r.tenantName,
    entityCount: r.entityCount,
    txnCount30d: r.txnCount30d,
    revenue30d: Number(r.revenue30d),
    healthScore: r.healthScore,
    status: r.status,
    lastLoginAt: r.lastLoginAt ? new Date(r.lastLoginAt).toISOString() : null,
    lastTxnAt: r.lastTxnAt ? new Date(r.lastTxnAt).toISOString() : null,
    isOnboarding: r.entityCount === 0 && r.txnCount30d === 0,
  }))
}

// ---------------------------------------------------------------------------
// 读取:实时预警流
// ---------------------------------------------------------------------------
export type PlatformAlertRow = {
  id: number
  tenantId: string
  tenantName: string
  code: string
  dimension: string
  level: string
  title: string
  detail: string | null
  status: string
  firstSeenAt: string
  updatedAt: string
}

export async function getPlatformAlerts(
  scope: 'open' | 'all' = 'open',
): Promise<PlatformAlertRow[]> {
  await requirePlatformAdmin()
  const where = scope === 'open' ? `WHERE status='open'` : ''
  const { rows } = await pool.query(
    `SELECT id,"tenantId","tenantName",code,dimension,level,title,detail,status,"firstSeenAt","updatedAt"
       FROM platform_alerts ${where}
      ORDER BY CASE level WHEN 'risk' THEN 0 WHEN 'warn' THEN 1 ELSE 2 END, "updatedAt" DESC
      LIMIT 200`,
  )
  return rows.map((r) => ({
    id: r.id,
    tenantId: r.tenantId,
    tenantName: r.tenantName,
    code: r.code,
    dimension: r.dimension,
    level: r.level,
    title: r.title,
    detail: r.detail,
    status: r.status,
    firstSeenAt: new Date(r.firstSeenAt).toISOString(),
    updatedAt: new Date(r.updatedAt).toISOString(),
  }))
}

export async function resolvePlatformAlert(id: number): Promise<{ ok: boolean }> {
  await requirePlatformAdmin()
  await pool.query(
    `UPDATE platform_alerts SET status='resolved',"resolvedAt"=now(),"updatedAt"=now() WHERE id=$1`,
    [id],
  )
  revalidatePath('/platform')
  revalidatePath('/platform/alerts')
  return { ok: true }
}

// ---------------------------------------------------------------------------
// 读取:单租户健康详情(钻取)
// ---------------------------------------------------------------------------
export type TenantDetail = {
  row: TenantHealthRow | null
  lastSyncAt: string | null
  agentCount30d: number
  auditRan: boolean
  trend: { date: string; score: number }[]
  alerts: PlatformAlertRow[]
}

export async function getTenantHealthDetail(tenantId: string): Promise<TenantDetail> {
  await requirePlatformAdmin()
  const latest = await pool.query(
    `SELECT * FROM tenant_health WHERE "tenantId"=$1 ORDER BY "snapshotDate" DESC LIMIT 1`,
    [tenantId],
  )
  const l = latest.rows[0]
  const trendRes = await pool.query(
    `SELECT "snapshotDate" AS date, "healthScore" AS score FROM tenant_health
      WHERE "tenantId"=$1 ORDER BY "snapshotDate" DESC LIMIT 14`,
    [tenantId],
  )
  const alertRes = await pool.query(
    `SELECT id,"tenantId","tenantName",code,dimension,level,title,detail,status,"firstSeenAt","updatedAt"
       FROM platform_alerts WHERE "tenantId"=$1 ORDER BY "updatedAt" DESC LIMIT 50`,
    [tenantId],
  )
  return {
    row: l
      ? {
          tenantId: l.tenantId,
          tenantName: l.tenantName,
          entityCount: l.entityCount,
          txnCount30d: l.txnCount30d,
          revenue30d: Number(l.revenue30d),
          healthScore: l.healthScore,
          status: l.status,
          lastLoginAt: l.lastLoginAt ? new Date(l.lastLoginAt).toISOString() : null,
          lastTxnAt: l.lastTxnAt ? new Date(l.lastTxnAt).toISOString() : null,
          isOnboarding: l.entityCount === 0 && l.txnCount30d === 0,
        }
      : null,
    lastSyncAt: l?.lastSyncAt ? new Date(l.lastSyncAt).toISOString() : null,
    agentCount30d: l?.agentCount30d ?? 0,
    auditRan: l?.auditRan ?? false,
    trend: trendRes.rows.reverse().map((r) => ({
      date: String(r.date).slice(5, 10),
      score: r.score,
    })),
    alerts: alertRes.rows.map((r) => ({
      id: r.id,
      tenantId: r.tenantId,
      tenantName: r.tenantName,
      code: r.code,
      dimension: r.dimension,
      level: r.level,
      title: r.title,
      detail: r.detail,
      status: r.status,
      firstSeenAt: new Date(r.firstSeenAt).toISOString(),
      updatedAt: new Date(r.updatedAt).toISOString(),
    })),
  }
}
