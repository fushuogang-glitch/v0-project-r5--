'use server'

import { and, eq, sql } from 'drizzle-orm'
import { revalidatePath } from 'next/cache'
import { db } from '@/lib/db'
import { entities, transactions, complianceNodes } from '@/lib/db/schema'
import { getScope, type Scope } from '@/lib/scope'
import { getTaxProfile } from '@/lib/tax-policy'
import { TAX_THRESHOLDS } from '@/lib/tax'

export type ComplianceItem = {
  id: number
  entityId: number | null
  entityName: string
  nodeType: string
  title: string
  detail: string | null
  period: string | null
  dueDate: string | null
  remindAt: string | null
  level: 'info' | 'warning' | 'danger'
  status: 'pending' | 'filed' | 'overdue' | 'dismissed'
  daysLeft: number | null
  urgent: boolean
}

// --- 期间与截止日工具 --------------------------------------------------------

function pad(n: number) {
  return String(n).padStart(2, '0')
}
function ymd(d: Date) {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}
function addDays(iso: string, n: number) {
  const x = new Date(iso + 'T00:00:00')
  x.setDate(x.getDate() + n)
  return ymd(x)
}
function daysFromToday(iso: string, now: Date) {
  const a = new Date(iso + 'T00:00:00').getTime()
  const b = new Date(ymd(now) + 'T00:00:00').getTime()
  return Math.floor((a - b) / 86400000)
}

// 上一个已结束的自然月 → 申报期为次月,截止次月15日
function lastClosedMonth(now: Date) {
  const prev = new Date(now.getFullYear(), now.getMonth() - 1, 1)
  const py = prev.getFullYear()
  const pm = prev.getMonth() + 1
  const due = ymd(new Date(py, pm, 15)) // pm 的下一个月15日
  return { period: `${py}-${pad(pm)}`, dueDate: due }
}

// 上一个已结束的季度 → 截止季后次月15日
function lastClosedQuarter(now: Date) {
  const curQ = Math.floor(now.getMonth() / 3) + 1
  let q = curQ - 1
  let qy = now.getFullYear()
  if (q === 0) {
    q = 4
    qy = now.getFullYear() - 1
  }
  const due = ymd(new Date(qy, q * 3, 15)) // 结束月(q*3,1-based)的下一个月15日
  return { period: `${qy}Q${q}`, dueDate: due, qy, q }
}

// 判断是否“红色紧急”:逾期 或 7 天内到期 或 danger 级
function isUrgent(
  level: ComplianceItem['level'],
  status: ComplianceItem['status'],
  daysLeft: number | null,
) {
  if (status === 'dismissed' || status === 'filed') return false
  if (status === 'overdue' || level === 'danger') return true
  return daysLeft != null && daysLeft >= 0 && daysLeft <= 7
}

// --- 节点生成(幂等) --------------------------------------------------------

type DraftNode = {
  entityId: number | null
  nodeType: string
  title: string
  detail: string
  period: string | null
  dueDate: string | null
  remindAt: string | null
  level: 'info' | 'warning' | 'danger'
}

export async function generateComplianceNodes(): Promise<{ ok: true; total: number }> {
  const scope = await getScope()
  const now = new Date()

  const entConds = [eq(entities.userId, scope.ownerId), eq(entities.status, 'active')]
  if (scope.role === 'store' && scope.entityId != null) {
    entConds.push(eq(entities.id, scope.entityId))
  }
  const ents = await db.select().from(entities).where(and(...entConds))

  const month = lastClosedMonth(now)
  const quarter = lastClosedQuarter(now)
  const drafts: DraftNode[] = []

  for (const e of ents) {
    const profile = getTaxProfile(e.entityType, e.taxpayerType)
    const isGeneral = e.taxpayerType === 'general'

    // 1) 增值税及附加税费申报
    if (isGeneral) {
      drafts.push({
        entityId: e.id,
        nodeType: 'vat_filing',
        title: `${e.name} · 增值税及附加税费申报(${month.period})`,
        detail: `一般纳税人按月申报。${profile.vatLabel};${profile.surtaxLabel}。请在截止日前完成纳税申报与缴款。`,
        period: month.period,
        dueDate: month.dueDate,
        remindAt: addDays(month.dueDate, -7),
        level: 'info',
      })
    } else {
      drafts.push({
        entityId: e.id,
        nodeType: 'vat_filing',
        title: `${e.name} · 增值税及附加税费申报(${quarter.period})`,
        detail: `小规模纳税人按季申报。季度销售额不超过 30 万元免征增值税,仍需进行(零)申报。`,
        period: quarter.period,
        dueDate: quarter.dueDate,
        remindAt: addDays(quarter.dueDate, -7),
        level: 'info',
      })
    }

    // 2) 所得税预缴(按季)
    drafts.push({
      entityId: e.id,
      nodeType: 'cit_prepay',
      title:
        profile.incomeTaxKind === 'personal_business'
          ? `${e.name} · 个人经营所得预缴(${quarter.period})`
          : `${e.name} · 企业所得税预缴 A 类(${quarter.period})`,
      detail: `${profile.incomeTaxLabel}。按季预缴,请在季后次月 15 日前完成预缴申报。`,
      period: quarter.period,
      dueDate: quarter.dueDate,
      remindAt: addDays(quarter.dueDate, -7),
      level: 'info',
    })

    // 3) 临界点合规
    const trailingStart = ymd(new Date(now.getFullYear() - 1, now.getMonth(), now.getDate()))
    const qStart = ymd(new Date(quarter.qy, (quarter.q - 1) * 3, 1))

    const [trailing] = await db
      .select({ total: sql<string>`coalesce(sum(${transactions.amount}),0)` })
      .from(transactions)
      .where(
        and(
          eq(transactions.userId, scope.ownerId),
          eq(transactions.entityId, e.id),
          eq(transactions.bizType, 'income'),
          sql`${transactions.bizDate} >= ${trailingStart}`,
        ),
      )
    const [qtr] = await db
      .select({ total: sql<string>`coalesce(sum(${transactions.amount}),0)` })
      .from(transactions)
      .where(
        and(
          eq(transactions.userId, scope.ownerId),
          eq(transactions.entityId, e.id),
          eq(transactions.bizType, 'income'),
          sql`${transactions.bizDate} >= ${qStart}`,
        ),
      )
    const trailingRev = Number(trailing?.total ?? 0)
    const qtrRev = Number(qtr?.total ?? 0)

    if (!isGeneral) {
      const vatPct = (qtrRev / TAX_THRESHOLDS.vatQuarterly) * 100
      if (vatPct >= 80) {
        drafts.push({
          entityId: e.id,
          nodeType: 'vat_exempt',
          title: `${e.name} · 增值税免征额度临界(${quarter.period})`,
          detail: `本季销售额已达免征线的 ${vatPct.toFixed(0)}%(免征线 30 万元)。超过后将按征收率全额计税,建议关注开票节奏。`,
          period: quarter.period,
          dueDate: null,
          remindAt: ymd(now),
          level: vatPct >= 100 ? 'danger' : 'warning',
        })
      }
      const genPct = (trailingRev / TAX_THRESHOLDS.generalTaxpayerYearly) * 100
      if (genPct >= 80) {
        drafts.push({
          entityId: e.id,
          nodeType: 'general_taxpayer',
          title: `${e.name} · 一般纳税人强制认定临界`,
          detail: `近 12 个月销售额已达 500 万元认定线的 ${genPct.toFixed(0)}%。达标后须登记为一般纳税人,请提前做好税务筹划。`,
          period: `${now.getFullYear()}`,
          dueDate: null,
          remindAt: ymd(now),
          level: genPct >= 100 ? 'danger' : 'warning',
        })
      }
    } else if (profile.incomeTaxKind === 'corporate') {
      const spPct = (trailingRev / TAX_THRESHOLDS.smallProfitYearly) * 100
      if (spPct >= 80) {
        drafts.push({
          entityId: e.id,
          nodeType: 'small_profit',
          title: `${e.name} · 小微企业优惠临界`,
          detail: `近 12 个月营收已达小微优惠线 300 万元的 ${spPct.toFixed(0)}%。超过后可能无法适用小微企业所得税优惠税率。`,
          period: `${now.getFullYear()}`,
          dueDate: null,
          remindAt: ymd(now),
          level: spPct >= 100 ? 'danger' : 'warning',
        })
      }
    }
  }

  // 幂等:按 (entityId, nodeType, period) 比对现有记录,存在则更新内容(保留人工 status),否则插入
  const existing = await db
    .select()
    .from(complianceNodes)
    .where(eq(complianceNodes.userId, scope.ownerId))

  const keyOf = (entityId: number | null, nodeType: string, period: string | null) =>
    `${entityId ?? 0}::${nodeType}::${period ?? ''}`
  const existingMap = new Map(existing.map((r) => [keyOf(r.entityId, r.nodeType, r.period), r]))

  for (const d of drafts) {
    const hit = existingMap.get(keyOf(d.entityId, d.nodeType, d.period))
    if (hit) {
      await db
        .update(complianceNodes)
        .set({
          title: d.title,
          detail: d.detail,
          dueDate: d.dueDate,
          remindAt: d.remindAt,
          level: d.level,
          updatedAt: new Date(),
        })
        .where(eq(complianceNodes.id, hit.id))
    } else {
      await db.insert(complianceNodes).values({
        userId: scope.ownerId,
        entityId: d.entityId,
        nodeType: d.nodeType,
        title: d.title,
        detail: d.detail,
        period: d.period,
        dueDate: d.dueDate,
        remindAt: d.remindAt,
        level: d.level,
        status: 'pending',
      })
    }
  }

  // 注:本函数会在页面/布局渲染期间被调用,因此不在此处 revalidatePath。
  // 页面均为 force-dynamic,会实时读取最新数据。
  return { ok: true, total: drafts.length }
}

// --- 查询 -------------------------------------------------------------------

export async function getComplianceNodes(): Promise<ComplianceItem[]> {
  const scope = await getScope()
  const now = new Date()

  const conds = [eq(complianceNodes.userId, scope.ownerId)]
  if (scope.role === 'store' && scope.entityId != null) {
    conds.push(eq(complianceNodes.entityId, scope.entityId))
  }

  const rows = await db
    .select({
      id: complianceNodes.id,
      entityId: complianceNodes.entityId,
      nodeType: complianceNodes.nodeType,
      title: complianceNodes.title,
      detail: complianceNodes.detail,
      period: complianceNodes.period,
      dueDate: complianceNodes.dueDate,
      remindAt: complianceNodes.remindAt,
      level: complianceNodes.level,
      status: complianceNodes.status,
      entityName: entities.name,
    })
    .from(complianceNodes)
    .leftJoin(entities, eq(complianceNodes.entityId, entities.id))
    .where(and(...conds))

  const items: ComplianceItem[] = rows.map((r) => {
    const daysLeft = r.dueDate ? daysFromToday(r.dueDate, now) : null
    let status = r.status as ComplianceItem['status']
    if (status === 'pending' && daysLeft != null && daysLeft < 0) status = 'overdue'
    const level = r.level as ComplianceItem['level']
    return {
      id: r.id,
      entityId: r.entityId,
      entityName: r.entityName ?? '集团',
      nodeType: r.nodeType,
      title: r.title,
      detail: r.detail,
      period: r.period,
      dueDate: r.dueDate,
      remindAt: r.remindAt,
      level,
      status,
      daysLeft,
      urgent: isUrgent(level, status, daysLeft),
    }
  })

  const statusRank = { overdue: 0, pending: 1, filed: 2, dismissed: 3 } as const
  const levelRank = { danger: 0, warning: 1, info: 2 } as const
  return items.sort((a, b) => {
    if (statusRank[a.status] !== statusRank[b.status]) return statusRank[a.status] - statusRank[b.status]
    if (levelRank[a.level] !== levelRank[b.level]) return levelRank[a.level] - levelRank[b.level]
    return (a.daysLeft ?? 9999) - (b.daysLeft ?? 9999)
  })
}

export type ComplianceSummary = {
  pending: number
  overdue: number
  urgent: number
}

export async function getComplianceSummary(): Promise<ComplianceSummary> {
  const items = await getComplianceNodes()
  const active = items.filter((i) => i.status === 'pending' || i.status === 'overdue')
  return {
    pending: active.length,
    overdue: items.filter((i) => i.status === 'overdue').length,
    urgent: active.filter((i) => i.urgent).length,
  }
}

// 按侧栏栏目聚合角标:返回 href → { count, urgent }
export type ComplianceBadge = { count: number; urgent: boolean }

// 节点类型 → 归属栏目
const NODE_ROUTE: Record<string, string> = {
  vat_filing: '/tax-filing',
  cit_prepay: '/tax-filing',
  cit_settle: '/tax-filing',
  vat_exempt: '/tax-alerts',
  small_profit: '/tax-alerts',
  general_taxpayer: '/tax-alerts',
}

export async function getComplianceBadges(): Promise<{
  byRoute: Record<string, ComplianceBadge>
  total: ComplianceBadge
}> {
  let items: ComplianceItem[] = []
  try {
    items = await getComplianceNodes()
  } catch {
    return { byRoute: {}, total: { count: 0, urgent: false } }
  }
  const active = items.filter((i) => i.status === 'pending' || i.status === 'overdue')

  const byRoute: Record<string, ComplianceBadge> = {}
  const bump = (route: string, urgent: boolean) => {
    const b = byRoute[route] ?? { count: 0, urgent: false }
    b.count += 1
    b.urgent = b.urgent || urgent
    byRoute[route] = b
  }

  for (const i of active) {
    const route = NODE_ROUTE[i.nodeType]
    if (route) bump(route, i.urgent)
    // 所有待办都计入「合规提醒」总览
    bump('/compliance', i.urgent)
  }

  return {
    byRoute,
    total: {
      count: active.length,
      urgent: active.some((i) => i.urgent),
    },
  }
}

async function assertNodeAccess(scope: Scope, id: number) {
  const [node] = await db
    .select()
    .from(complianceNodes)
    .where(and(eq(complianceNodes.id, id), eq(complianceNodes.userId, scope.ownerId)))
    .limit(1)
  if (!node) throw new Error('节点不存在')
  if (scope.role === 'store' && scope.entityId !== node.entityId) {
    throw new Error('无权操作该节点')
  }
  return node
}

export async function setComplianceStatus(
  id: number,
  status: 'filed' | 'dismissed' | 'pending',
): Promise<{ ok: true }> {
  const scope = await getScope()
  await assertNodeAccess(scope, id)
  await db
    .update(complianceNodes)
    .set({ status, updatedAt: new Date() })
    .where(and(eq(complianceNodes.id, id), eq(complianceNodes.userId, scope.ownerId)))
  revalidatePath('/compliance')
  return { ok: true }
}
