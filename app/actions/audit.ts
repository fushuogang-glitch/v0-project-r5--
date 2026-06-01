'use server'

import { db } from '@/lib/db'
import {
  entities,
  transactions,
  accounts,
  salaries,
  shareholders,
  auditFindings,
} from '@/lib/db/schema'
import { getScope } from '@/lib/scope'
import { getBankReconciliation } from '@/app/actions/reconciliation'
import { and, eq, gte, lt, sql } from 'drizzle-orm'

// ---------------------------------------------------------------------------
// 月度自动审计引擎
// 跨集团全部主体,按 5 个维度幂等生成审计结论:
//   revenue 收支平衡 · reconciliation 银行对账 · tax 税务临界 ·
//   payroll 工资分红 · account 收款账户满额
// 重点稽核"手工做账"数据(source=manual / 未开票),员工手动录入后自动复核。
// 幂等:按 (userId, period, entityId, code) upsert;group 级用 entityId=0 占位。
// ---------------------------------------------------------------------------

const GROUP_SCOPE = 0 // 集团级 finding 的 entityId 占位(避免 NULL 破坏唯一约束)

// 税务/比率阈值(可按需调整)
const VAT_MONTHLY_EXEMPT = 100000 // 小规模纳税人月销售额免征增值税临界(10万)
const VAT_NEAR_RATIO = 0.85 // 达到临界 85% 视为接近
const PAYROLL_WARN = 0.45 // 工资占营业额 45% 预警
const PAYROLL_RISK = 0.6 // 60% 异常
const BIG_TXN_MULTIPLE = 5 // 单笔超过当月均额 5 倍视为异常大额

export type AuditLevel = 'pass' | 'warn' | 'risk'
export type AuditDimension =
  | 'revenue'
  | 'reconciliation'
  | 'tax'
  | 'payroll'
  | 'account'

type Draft = {
  entityId: number
  dimension: AuditDimension
  code: string
  level: AuditLevel
  title: string
  detail: string
  metric: number | null
}

function periodNow(): string {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

function periodRange(period: string): { start: string; end: string } {
  const [y, m] = period.split('-').map(Number)
  const start = `${y}-${String(m).padStart(2, '0')}-01`
  const ny = m === 12 ? y + 1 : y
  const nm = m === 12 ? 1 : m + 1
  const end = `${ny}-${String(nm).padStart(2, '0')}-01`
  return { start, end }
}

// ----- 审计计算:产出 Draft[] -----------------------------------------------
async function computeFindings(ownerId: string, period: string): Promise<Draft[]> {
  const { start, end } = periodRange(period)
  const drafts: Draft[] = []

  const entList = await db
    .select({ id: entities.id, name: entities.name })
    .from(entities)
    .where(eq(entities.userId, ownerId))
  const nameMap = new Map(entList.map((e) => [e.id, e.name]))

  // 当月全部流水
  const txns = await db
    .select({
      id: transactions.id,
      entityId: transactions.entityId,
      bizType: transactions.bizType,
      amount: transactions.amount,
      invoiced: transactions.invoiced,
      source: transactions.source,
      category: transactions.category,
    })
    .from(transactions)
    .where(
      and(
        eq(transactions.userId, ownerId),
        gte(transactions.bizDate, start),
        lt(transactions.bizDate, end),
      ),
    )

  // 按主体聚合
  type Agg = {
    income: number
    expense: number
    incomeCount: number
    manualCount: number
    uninvoicedIncome: number
    maxIncome: number
  }
  const aggMap = new Map<number, Agg>()
  for (const t of txns) {
    const a =
      aggMap.get(t.entityId) ??
      {
        income: 0,
        expense: 0,
        incomeCount: 0,
        manualCount: 0,
        uninvoicedIncome: 0,
        maxIncome: 0,
      }
    const amt = Number(t.amount)
    if (t.bizType === 'income') {
      a.income += amt
      a.incomeCount += 1
      a.maxIncome = Math.max(a.maxIncome, amt)
      if (!t.invoiced) a.uninvoicedIncome += amt
    } else {
      a.expense += amt
    }
    if (t.source === 'manual') a.manualCount += 1
    aggMap.set(t.entityId, a)
  }

  let groupIncome = 0
  let groupManual = 0

  // --- 维度1:收支平衡与异常大额 ---
  for (const [eid, a] of aggMap) {
    const name = nameMap.get(eid) ?? `主体${eid}`
    const net = a.income - a.expense
    groupIncome += a.income
    groupManual += a.manualCount

    if (a.income === 0 && a.expense === 0) continue

    if (net < 0) {
      drafts.push({
        entityId: eid,
        dimension: 'revenue',
        code: 'rev_negative',
        level: 'warn',
        title: `${name}:本月收支为负`,
        detail: `收入 ${fmt(a.income)},支出 ${fmt(a.expense)},净额 ${fmt(net)}。请核实是否有大额一次性支出或漏记收入。`,
        metric: Math.round(net),
      })
    } else if (a.expense > a.income * 0.9 && a.income > 0) {
      drafts.push({
        entityId: eid,
        dimension: 'revenue',
        code: 'rev_thin_margin',
        level: 'warn',
        title: `${name}:支出接近收入(毛利偏低)`,
        detail: `支出占收入 ${pct(a.expense / a.income)},毛利空间不足 10%,建议复核成本归集。`,
        metric: Math.round(a.income - a.expense),
      })
    } else {
      drafts.push({
        entityId: eid,
        dimension: 'revenue',
        code: 'rev_ok',
        level: 'pass',
        title: `${name}:收支结构正常`,
        detail: `收入 ${fmt(a.income)},支出 ${fmt(a.expense)},净额 ${fmt(net)}。`,
        metric: Math.round(net),
      })
    }

    // 异常大额单笔
    const avg = a.incomeCount > 0 ? a.income / a.incomeCount : 0
    if (avg > 0 && a.maxIncome > avg * BIG_TXN_MULTIPLE) {
      drafts.push({
        entityId: eid,
        dimension: 'revenue',
        code: 'rev_big_txn',
        level: 'warn',
        title: `${name}:存在异常大额收入单笔`,
        detail: `最大单笔 ${fmt(a.maxIncome)},为当月单笔均额(${fmt(avg)})的 ${(a.maxIncome / avg).toFixed(1)} 倍,请核实业务真实性与开票。`,
        metric: Math.round(a.maxIncome),
      })
    }

    // 手工做账数据质量:大额未开票收入
    if (a.uninvoicedIncome > 0 && a.income > 0 && a.uninvoicedIncome / a.income > 0.5) {
      drafts.push({
        entityId: eid,
        dimension: 'revenue',
        code: 'rev_uninvoiced',
        level: 'warn',
        title: `${name}:过半收入未开票`,
        detail: `未开票收入 ${fmt(a.uninvoicedIncome)},占比 ${pct(a.uninvoicedIncome / a.income)}。手工录入需关注发票合规与税务匹配。`,
        metric: Math.round(a.uninvoicedIncome),
      })
    }
  }

  // --- 维度2:银行对账差异(复用对账引擎) ---
  try {
    const recon = await getBankReconciliation()
    for (const r of recon) {
      if (!r.isBalanced) {
        drafts.push({
          entityId: r.entityId,
          dimension: 'reconciliation',
          code: 'recon_unbalanced',
          level: 'risk',
          title: `${r.entityName}:银行对账未平`,
          detail: `账面 ${fmt(r.bookBalance)} 与对账单 ${fmt(r.bankBalance)} 调节后仍不平,请核查未达账项。`,
          metric: Math.round(r.difference),
        })
      } else {
        const pending = r.bookOnly.length + r.bankOnly.length
        drafts.push({
          entityId: r.entityId,
          dimension: 'reconciliation',
          code: 'recon_ok',
          level: pending > 0 ? 'warn' : 'pass',
          title:
            pending > 0
              ? `${r.entityName}:对账已平,有 ${pending} 笔未达账项`
              : `${r.entityName}:银行对账平账`,
          detail:
            pending > 0
              ? `调节后余额 ${fmt(r.adjustedBalance)}。在途/单边项 ${pending} 笔待入账,属正常时间性差异。`
              : `账面与对账单一致,余额 ${fmt(r.adjustedBalance)}。`,
          metric: Math.round(r.adjustedBalance),
        })
      }
    }
  } catch {
    // 对账依赖银行账户,无账户时跳过
  }

  // --- 维度3:税务与临界点 ---
  for (const [eid, a] of aggMap) {
    if (a.income === 0) continue
    const name = nameMap.get(eid) ?? `主体${eid}`
    if (a.income > VAT_MONTHLY_EXEMPT) {
      drafts.push({
        entityId: eid,
        dimension: 'tax',
        code: 'tax_vat_over',
        level: 'risk',
        title: `${name}:月销售额超增值税免征额`,
        detail: `本月销售额 ${fmt(a.income)},已超小规模纳税人月免征临界(${fmt(VAT_MONTHLY_EXEMPT)}),需按规定计缴增值税,关注一般纳税人认定。`,
        metric: Math.round(a.income),
      })
    } else if (a.income >= VAT_MONTHLY_EXEMPT * VAT_NEAR_RATIO) {
      drafts.push({
        entityId: eid,
        dimension: 'tax',
        code: 'tax_vat_near',
        level: 'warn',
        title: `${name}:接近增值税免征临界`,
        detail: `本月销售额 ${fmt(a.income)},已达免征临界的 ${pct(a.income / VAT_MONTHLY_EXEMPT)},临近月末注意控制开票节奏与合规。`,
        metric: Math.round(a.income),
      })
    } else {
      drafts.push({
        entityId: eid,
        dimension: 'tax',
        code: 'tax_ok',
        level: 'pass',
        title: `${name}:增值税在免征区间`,
        detail: `本月销售额 ${fmt(a.income)},低于月免征临界,暂无增值税缴纳义务。`,
        metric: Math.round(a.income),
      })
    }
  }

  // --- 维度4:工资占比与股权分红 ---
  const [y, m] = period.split('-').map(Number)
  const salRows = await db
    .select({ entityId: salaries.entityId, netPay: salaries.netPay })
    .from(salaries)
    .where(and(eq(salaries.userId, ownerId), eq(salaries.year, y), eq(salaries.month, m)))
  const salByEntity = new Map<number, number>()
  for (const s of salRows) {
    if (s.entityId == null) continue
    salByEntity.set(s.entityId, (salByEntity.get(s.entityId) ?? 0) + Number(s.netPay))
  }
  for (const [eid, a] of aggMap) {
    const sal = salByEntity.get(eid) ?? 0
    if (sal === 0 || a.income === 0) continue
    const name = nameMap.get(eid) ?? `主体${eid}`
    const ratio = sal / a.income
    if (ratio > PAYROLL_RISK) {
      drafts.push({
        entityId: eid,
        dimension: 'payroll',
        code: 'pay_ratio_risk',
        level: 'risk',
        title: `${name}:工资占营业额过高`,
        detail: `本月工资 ${fmt(sal)},占营业额 ${pct(ratio)},超过 ${pct(PAYROLL_RISK)} 警戒线,人力成本异常。`,
        metric: Math.round(ratio * 100),
      })
    } else if (ratio > PAYROLL_WARN) {
      drafts.push({
        entityId: eid,
        dimension: 'payroll',
        code: 'pay_ratio_warn',
        level: 'warn',
        title: `${name}:工资占比偏高`,
        detail: `本月工资 ${fmt(sal)},占营业额 ${pct(ratio)},高于 ${pct(PAYROLL_WARN)},建议关注人效。`,
        metric: Math.round(ratio * 100),
      })
    }
  }

  // 股权分红比例:按主体/集团汇总持股比例,超过 100% 为异常
  const shRows = await db
    .select({
      level: shareholders.level,
      entityId: shareholders.entityId,
      ratio: shareholders.ratio,
    })
    .from(shareholders)
    .where(and(eq(shareholders.userId, ownerId), eq(shareholders.status, 'active')))
  const ratioByEntity = new Map<number, number>()
  let groupRatio = 0
  for (const s of shRows) {
    const r = Number(s.ratio)
    if (s.level === 'group' || s.entityId == null) groupRatio += r
    else ratioByEntity.set(s.entityId, (ratioByEntity.get(s.entityId) ?? 0) + r)
  }
  for (const [eid, total] of ratioByEntity) {
    const name = nameMap.get(eid) ?? `主体${eid}`
    if (total > 100.001) {
      drafts.push({
        entityId: eid,
        dimension: 'payroll',
        code: 'div_over_100',
        level: 'risk',
        title: `${name}:股权分红比例超 100%`,
        detail: `该主体在册股东分红权合计 ${total.toFixed(2)}%,超过 100%,请核对银股/身股/发展股配置。`,
        metric: Math.round(total),
      })
    }
  }
  if (groupRatio > 100.001) {
    drafts.push({
      entityId: GROUP_SCOPE,
      dimension: 'payroll',
      code: 'div_group_over_100',
      level: 'risk',
      title: '集团层股权分红比例超 100%',
      detail: `集团层股东分红权合计 ${groupRatio.toFixed(2)}%,超过 100%,请核对集团分红配置。`,
      metric: Math.round(groupRatio),
    })
  }

  // --- 维度5:收款账户满额 ---
  const accRows = await db
    .select()
    .from(accounts)
    .where(and(eq(accounts.userId, ownerId), eq(accounts.status, 'active')))
  // 账户累计收款(按 entity+channel 汇总当月收入)
  const recvMap = new Map<string, number>()
  for (const t of txns) {
    if (t.bizType !== 'income') continue
    const k = `${t.entityId}::`
    // 用全部收入近似;账户满额按当月收入对照(与账户列表口径一致)
  }
  // 为与账户列表口径一致,这里按 entity+channel 汇总当月收入
  const chanMap = new Map<string, number>()
  const txnFull = await db
    .select({
      entityId: transactions.entityId,
      channel: transactions.channel,
      amount: transactions.amount,
      bizType: transactions.bizType,
    })
    .from(transactions)
    .where(eq(transactions.userId, ownerId))
  for (const t of txnFull) {
    if (t.bizType !== 'income') continue
    const k = `${t.entityId}::${t.channel}`
    chanMap.set(k, (chanMap.get(k) ?? 0) + Number(t.amount))
  }
  for (const acc of accRows) {
    if (acc.maxLimit == null) continue
    const limit = Number(acc.maxLimit)
    if (limit <= 0) continue
    const received = chanMap.get(`${acc.entityId}::${acc.channel}`) ?? 0
    const name = nameMap.get(acc.entityId) ?? `主体${acc.entityId}`
    if (received >= limit) {
      drafts.push({
        entityId: acc.entityId,
        dimension: 'account',
        code: `acct_full_${acc.id}`,
        level: 'risk',
        title: `${name} · ${acc.name}:收款账户已满额`,
        detail: `累计收款 ${fmt(received)} 已达/超最高额度 ${fmt(limit)},请及时分流或调额,避免收款受阻。`,
        metric: Math.round(received),
      })
    } else if (received >= limit * 0.8) {
      drafts.push({
        entityId: acc.entityId,
        dimension: 'account',
        code: `acct_near_${acc.id}`,
        level: 'warn',
        title: `${name} · ${acc.name}:收款账户接近满额`,
        detail: `累计收款 ${fmt(received)},已达额度 ${fmt(limit)} 的 ${pct(received / limit)}。`,
        metric: Math.round(received),
      })
    }
  }

  void groupIncome
  void groupManual
  void recvMap

  return drafts
}

// ----- 幂等写入 -------------------------------------------------------------
async function persist(ownerId: string, period: string, drafts: Draft[]) {
  for (const d of drafts) {
    await db
      .insert(auditFindings)
      .values({
        userId: ownerId,
        period,
        entityId: d.entityId,
        dimension: d.dimension,
        code: d.code,
        level: d.level,
        title: d.title,
        detail: d.detail,
        metric: d.metric != null ? String(d.metric) : null,
        status: 'open',
        updatedAt: new Date(),
      })
      .onConflictDoUpdate({
        target: [
          auditFindings.userId,
          auditFindings.period,
          auditFindings.entityId,
          auditFindings.code,
        ],
        set: {
          level: d.level,
          title: d.title,
          detail: d.detail,
          metric: d.metric != null ? String(d.metric) : null,
          updatedAt: new Date(),
        },
      })
  }
}

// 手动重跑��月(或指定期间)审计
export async function runMonthlyAudit(period?: string): Promise<{ ok: boolean; count: number }> {
  const scope = await getScope()
  const p = period ?? periodNow()
  const drafts = await computeFindings(scope.ownerId, p)
  await persist(scope.ownerId, p, drafts)
  return { ok: true, count: drafts.length }
}

// 进系统自动跑:当月尚无审计记录时自动生成一次(幂等)
export async function autoRunAuditIfDue(): Promise<void> {
  const scope = await getScope()
  const p = periodNow()
  const existing = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(auditFindings)
    .where(and(eq(auditFindings.userId, scope.ownerId), eq(auditFindings.period, p)))
  if ((existing[0]?.n ?? 0) > 0) return
  const drafts = await computeFindings(scope.ownerId, p)
  await persist(scope.ownerId, p, drafts)
}

// ----- 读取审计报告 ---------------------------------------------------------
export type AuditFindingView = {
  id: number
  entityId: number
  dimension: AuditDimension
  level: AuditLevel
  title: string
  detail: string | null
  metric: number | null
  status: string
}

export type AuditReport = {
  period: string
  generatedAt: string | null
  total: number
  passCount: number
  warnCount: number
  riskCount: number
  score: number // 健康分 0-100
  byDimension: {
    dimension: AuditDimension
    label: string
    pass: number
    warn: number
    risk: number
    findings: AuditFindingView[]
  }[]
}

const DIMENSION_LABELS: Record<AuditDimension, string> = {
  revenue: '收支平衡',
  reconciliation: '银行对账',
  tax: '税务临界',
  payroll: '工资分红',
  account: '收款账户',
}

export async function getAuditReport(period?: string): Promise<AuditReport> {
  const scope = await getScope()
  const p = period ?? periodNow()

  const rows = await db
    .select()
    .from(auditFindings)
    .where(and(eq(auditFindings.userId, scope.ownerId), eq(auditFindings.period, p)))

  let passCount = 0
  let warnCount = 0
  let riskCount = 0
  const dimMap = new Map<AuditDimension, AuditFindingView[]>()
  let generatedAt: string | null = null

  for (const r of rows) {
    const lvl = r.level as AuditLevel
    if (lvl === 'pass') passCount++
    else if (lvl === 'warn') warnCount++
    else if (lvl === 'risk') riskCount++

    const dim = r.dimension as AuditDimension
    const arr = dimMap.get(dim) ?? []
    arr.push({
      id: r.id,
      entityId: r.entityId ?? 0,
      dimension: dim,
      level: lvl,
      title: r.title,
      detail: r.detail,
      metric: r.metric != null ? Number(r.metric) : null,
      status: r.status,
    })
    dimMap.set(dim, arr)
    const t = r.updatedAt instanceof Date ? r.updatedAt.toISOString() : String(r.updatedAt)
    if (!generatedAt || t > generatedAt) generatedAt = t
  }

  const total = rows.length
  // 健康分:从 100 扣分,警告 -3,异常 -10,封底 0
  const score = Math.max(0, Math.min(100, 100 - warnCount * 3 - riskCount * 10))

  const order: AuditDimension[] = ['revenue', 'reconciliation', 'tax', 'payroll', 'account']
  const byDimension = order
    .map((dim) => {
      const findings = (dimMap.get(dim) ?? []).sort(
        (a, b) => levelRank(b.level) - levelRank(a.level),
      )
      return {
        dimension: dim,
        label: DIMENSION_LABELS[dim],
        pass: findings.filter((f) => f.level === 'pass').length,
        warn: findings.filter((f) => f.level === 'warn').length,
        risk: findings.filter((f) => f.level === 'risk').length,
        findings,
      }
    })
    .filter((d) => d.findings.length > 0)

  return {
    period: p,
    generatedAt,
    total,
    passCount,
    warnCount,
    riskCount,
    score,
    byDimension,
  }
}

// 标记某条审计发现为已处理 / 重新打开
export async function setFindingStatus(
  id: number,
  status: 'open' | 'resolved',
): Promise<{ ok: boolean }> {
  const scope = await getScope()
  await db
    .update(auditFindings)
    .set({ status, updatedAt: new Date() })
    .where(and(eq(auditFindings.id, id), eq(auditFindings.userId, scope.ownerId)))
  return { ok: true }
}

function levelRank(l: AuditLevel): number {
  return l === 'risk' ? 2 : l === 'warn' ? 1 : 0
}

function fmt(n: number): string {
  return '¥' + Math.round(n).toLocaleString('zh-CN')
}
function pct(r: number): string {
  return (r * 100).toFixed(1) + '%'
}
