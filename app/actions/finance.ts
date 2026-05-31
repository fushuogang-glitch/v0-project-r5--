'use server'

import { auth } from '@/lib/auth'
import { db } from '@/lib/db'
import { entities, transactions } from '@/lib/db/schema'
import { and, eq, sql, desc } from 'drizzle-orm'
import { headers } from 'next/headers'

async function getUserId() {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session?.user) throw new Error('Unauthorized')
  return session.user.id
}

// 税务临界点阈值(PRD 第三部分)
export const TAX_THRESHOLDS = {
  // 小规模纳税人增值税:季度销售额 30 万以内免征
  vatQuarterly: 300000,
  // 小微企业所得税优惠:年应纳税所得额 / 营收 300 万
  smallProfitYearly: 3000000,
  // 一般纳税人强制认定:连续 12 个月销售额 500 万
  generalTaxpayerYearly: 5000000,
}

// ---------------------------------------------------------------------------
// 演示数据:用户首次进入且没有任何主体时,自动生成多主体台账与近 6 个月统一流水
// ---------------------------------------------------------------------------
const DEMO_ENTITIES = [
  { name: '璞境美学(北京)有限公司', code: 'PJ-BJ-01', entityType: 'company', taxpayerType: 'general', region: '华北', city: '北京', legalPerson: '王雪', base: 1280000 },
  { name: '璞境美学(上海)有限公司', code: 'PJ-SH-02', entityType: 'company', taxpayerType: 'general', region: '华东', city: '上海', legalPerson: '李婷', base: 980000 },
  { name: '广州天河璞境美容服务部', code: 'PJ-GZ-03', entityType: 'sole', taxpayerType: 'small', region: '华南', city: '广州', legalPerson: '陈曦', base: 86000 },
  { name: '成都春熙璞境美容工作室', code: 'PJ-CD-04', entityType: 'sole', taxpayerType: 'small', region: '西南', city: '成都', legalPerson: '赵敏', base: 78000 },
  { name: '杭州西湖璞境美容服务部', code: 'PJ-HZ-05', entityType: 'sole', taxpayerType: 'small', region: '华东', city: '杭州', legalPerson: '孙琳', base: 64000 },
  { name: '深圳南山璞境医疗美容门诊部', code: 'PJ-SZ-06', entityType: 'company', taxpayerType: 'general', region: '华南', city: '深圳', legalPerson: '周倩', base: 760000 },
]

const INCOME_CATEGORIES = ['皮肤护理', '美容美体', '产品零售', '储值充值', '美甲美睫']
const INCOME_CHANNELS = ['微信', '支付宝', '银行卡', '现金', '储值余额']
const EXPENSE_CATEGORIES = ['房租', '人力薪酬', '物料耗材', '水电杂费', '市场营销']
const EXPENSE_RATIO: Record<string, number> = {
  房租: 0.16,
  人力薪酬: 0.32,
  物料耗材: 0.12,
  水电杂费: 0.04,
  市场营销: 0.08,
}

function rand(min: number, max: number) {
  return Math.random() * (max - min) + min
}

// 含税金额拆出税额与不含税额
function splitTax(amount: number, rate: number) {
  const net = amount / (1 + rate)
  const tax = amount - net
  return { net: Number(net.toFixed(2)), tax: Number(tax.toFixed(2)) }
}

export async function ensureSeedData() {
  const userId = await getUserId()
  const existing = await db
    .select({ id: entities.id })
    .from(entities)
    .where(eq(entities.userId, userId))
    .limit(1)
  if (existing.length > 0) return { seeded: false }

  const now = new Date()

  for (const e of DEMO_ENTITIES) {
    const establishYear = 2018 + Math.floor(rand(0, 5))
    const [entity] = await db
      .insert(entities)
      .values({
        userId,
        name: e.name,
        code: e.code,
        entityType: e.entityType,
        taxpayerType: e.taxpayerType,
        creditCode: '9111' + Math.floor(rand(1e11, 9e11)).toString(),
        legalPerson: e.legalPerson,
        region: e.region,
        city: e.city,
        address: `${e.city}市核心商圈`,
        status: 'active',
        establishDate: `${establishYear}-0${1 + Math.floor(rand(0, 8))}-15`,
      })
      .returning({ id: entities.id, taxpayerType: entities.taxpayerType })

    // 一般纳税人增值税率按 6%(现代服务),小规模按 1%
    const vatRate = entity.taxpayerType === 'general' ? 0.06 : 0.01
    const rows: (typeof transactions.$inferInsert)[] = []

    for (let m = 5; m >= 0; m--) {
      const d = new Date(now.getFullYear(), now.getMonth() - m, 1)
      const bizDate = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-05`
      const growth = 1 + (5 - m) * 0.03
      const monthIncome = e.base * growth * rand(0.88, 1.12)

      const weights = [0.34, 0.26, 0.16, 0.14, 0.1]
      INCOME_CATEGORIES.forEach((cat, i) => {
        const amount = monthIncome * weights[i] * rand(0.9, 1.1)
        const { net, tax } = splitTax(amount, vatRate)
        rows.push({
          userId,
          entityId: entity.id,
          bizDate,
          bizType: 'income',
          category: cat,
          channel: INCOME_CHANNELS[i % INCOME_CHANNELS.length],
          amount: amount.toFixed(2),
          taxRate: vatRate.toFixed(4),
          taxAmount: tax.toFixed(2),
          netAmount: net.toFixed(2),
          invoiced: Math.random() > 0.4,
          summary: `${cat}收入`,
          source: 'pos',
        })
      })

      EXPENSE_CATEGORIES.forEach((cat) => {
        const amount = monthIncome * EXPENSE_RATIO[cat] * rand(0.92, 1.08)
        const { net, tax } = splitTax(amount, 0.06)
        rows.push({
          userId,
          entityId: entity.id,
          bizDate,
          bizType: 'expense',
          category: cat,
          channel: '银行卡',
          amount: amount.toFixed(2),
          taxRate: '0.0600',
          taxAmount: tax.toFixed(2),
          netAmount: net.toFixed(2),
          invoiced: Math.random() > 0.3,
          summary: `${cat}支出`,
          source: 'bank',
        })
      })
    }

    await db.insert(transactions).values(rows)
  }

  return { seeded: true }
}

// ---------------------------------------------------------------------------
// 集团驾驶舱汇总
// ---------------------------------------------------------------------------
export type GroupSummary = {
  totalRevenue: number
  totalExpense: number
  netProfit: number
  profitMargin: number
  entityCount: number
  totalTax: number
  revenueMoM: number
  profitMoM: number
  warningCount: number
}

export async function getGroupSummary(): Promise<GroupSummary> {
  const userId = await getUserId()

  const [income] = await db
    .select({ total: sql<string>`coalesce(sum(${transactions.amount}), 0)` })
    .from(transactions)
    .where(and(eq(transactions.userId, userId), eq(transactions.bizType, 'income')))

  const [expense] = await db
    .select({
      total: sql<string>`coalesce(sum(${transactions.amount}), 0)`,
      tax: sql<string>`coalesce(sum(${transactions.taxAmount}), 0)`,
    })
    .from(transactions)
    .where(and(eq(transactions.userId, userId), eq(transactions.bizType, 'expense')))

  const [incomeTax] = await db
    .select({ tax: sql<string>`coalesce(sum(${transactions.taxAmount}), 0)` })
    .from(transactions)
    .where(and(eq(transactions.userId, userId), eq(transactions.bizType, 'income')))

  const [entityAgg] = await db
    .select({ count: sql<string>`count(*)` })
    .from(entities)
    .where(and(eq(entities.userId, userId), eq(entities.status, 'active')))

  const trend = await getMonthlyTrend()
  const last = trend[trend.length - 1]
  const prev = trend[trend.length - 2]

  const totalRevenue = Number(income?.total ?? 0)
  const totalExpense = Number(expense?.total ?? 0)
  const netProfit = totalRevenue - totalExpense

  const revenueMoM =
    last && prev && prev.revenue > 0
      ? ((last.revenue - prev.revenue) / prev.revenue) * 100
      : 0
  const profitMoM =
    last && prev && prev.profit !== 0
      ? ((last.profit - prev.profit) / Math.abs(prev.profit)) * 100
      : 0

  const alerts = await getTaxAlerts()
  const warningCount = alerts.filter((a) => a.level !== 'safe').length

  return {
    totalRevenue,
    totalExpense,
    netProfit,
    profitMargin: totalRevenue > 0 ? (netProfit / totalRevenue) * 100 : 0,
    entityCount: Number(entityAgg?.count ?? 0),
    totalTax: Number(incomeTax?.tax ?? 0) + Number(expense?.tax ?? 0),
    revenueMoM,
    profitMoM,
    warningCount,
  }
}

// ---------------------------------------------------------------------------
// 月度趋势(营收 / 成本 / 利润)
// ---------------------------------------------------------------------------
export type MonthlyPoint = {
  month: string
  revenue: number
  expense: number
  profit: number
}

export async function getMonthlyTrend(): Promise<MonthlyPoint[]> {
  const userId = await getUserId()

  const rows = await db
    .select({
      month: sql<string>`to_char(${transactions.bizDate}, 'YYYY-MM')`,
      bizType: transactions.bizType,
      total: sql<string>`sum(${transactions.amount})`,
    })
    .from(transactions)
    .where(eq(transactions.userId, userId))
    .groupBy(sql`to_char(${transactions.bizDate}, 'YYYY-MM')`, transactions.bizType)

  const map = new Map<string, { revenue: number; expense: number }>()
  for (const r of rows) {
    const cur = map.get(r.month) ?? { revenue: 0, expense: 0 }
    if (r.bizType === 'income') cur.revenue = Number(r.total)
    else cur.expense = Number(r.total)
    map.set(r.month, cur)
  }

  return Array.from(map.entries())
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([month, v]) => ({
      month,
      revenue: Math.round(v.revenue),
      expense: Math.round(v.expense),
      profit: Math.round(v.revenue - v.expense),
    }))
}

// ---------------------------------------------------------------------------
// 主体经营绩效
// ---------------------------------------------------------------------------
export type EntityPerformance = {
  id: number
  name: string
  code: string
  entityType: string
  taxpayerType: string
  region: string | null
  city: string | null
  legalPerson: string | null
  status: string
  revenue: number
  expense: number
  profit: number
  margin: number
}

export async function getEntityPerformance(): Promise<EntityPerformance[]> {
  const userId = await getUserId()
  const list = await db
    .select()
    .from(entities)
    .where(eq(entities.userId, userId))
    .orderBy(entities.code)

  const agg = await db
    .select({
      entityId: transactions.entityId,
      bizType: transactions.bizType,
      total: sql<string>`sum(${transactions.amount})`,
    })
    .from(transactions)
    .where(eq(transactions.userId, userId))
    .groupBy(transactions.entityId, transactions.bizType)

  const incomeMap = new Map<number, number>()
  const expenseMap = new Map<number, number>()
  for (const a of agg) {
    if (a.bizType === 'income') incomeMap.set(a.entityId, Number(a.total))
    else expenseMap.set(a.entityId, Number(a.total))
  }

  return list
    .map((e) => {
      const revenue = incomeMap.get(e.id) ?? 0
      const expense = expenseMap.get(e.id) ?? 0
      const profit = revenue - expense
      return {
        id: e.id,
        name: e.name,
        code: e.code,
        entityType: e.entityType,
        taxpayerType: e.taxpayerType,
        region: e.region,
        city: e.city,
        legalPerson: e.legalPerson,
        status: e.status,
        revenue: Math.round(revenue),
        expense: Math.round(expense),
        profit: Math.round(profit),
        margin: revenue > 0 ? (profit / revenue) * 100 : 0,
      }
    })
    .sort((a, b) => b.revenue - a.revenue)
}

// ---------------------------------------------------------------------------
// 税务额度临界点预警(PRD 灵魂功能)
// ---------------------------------------------------------------------------
export type TaxAlert = {
  entityId: number
  entityName: string
  taxpayerType: string
  // 近 12 个月销售额(用于一般纳税人 500 万 / 小微 300 万判断)
  trailingRevenue: number
  // 本季度销售额(用于小规模增值税 30 万判断)
  quarterRevenue: number
  // 适用的关键阈值与占比
  threshold: number
  thresholdLabel: string
  usedPercent: number
  level: 'safe' | 'warning' | 'danger'
}

export async function getTaxAlerts(): Promise<TaxAlert[]> {
  const userId = await getUserId()
  const list = await db
    .select()
    .from(entities)
    .where(and(eq(entities.userId, userId), eq(entities.status, 'active')))

  const now = new Date()
  const quarterStartMonth = Math.floor(now.getMonth() / 3) * 3
  const quarterStart = new Date(now.getFullYear(), quarterStartMonth, 1)
  const trailingStart = new Date(now.getFullYear() - 1, now.getMonth(), 1)

  const fmt = (d: Date) =>
    `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`

  const alerts: TaxAlert[] = []

  for (const e of list) {
    const [trailing] = await db
      .select({ total: sql<string>`coalesce(sum(${transactions.amount}), 0)` })
      .from(transactions)
      .where(
        and(
          eq(transactions.userId, userId),
          eq(transactions.entityId, e.id),
          eq(transactions.bizType, 'income'),
          sql`${transactions.bizDate} >= ${fmt(trailingStart)}`,
        ),
      )

    const [quarter] = await db
      .select({ total: sql<string>`coalesce(sum(${transactions.amount}), 0)` })
      .from(transactions)
      .where(
        and(
          eq(transactions.userId, userId),
          eq(transactions.entityId, e.id),
          eq(transactions.bizType, 'income'),
          sql`${transactions.bizDate} >= ${fmt(quarterStart)}`,
        ),
      )

    const trailingRevenue = Number(trailing?.total ?? 0)
    const quarterRevenue = Number(quarter?.total ?? 0)

    let threshold: number
    let thresholdLabel: string
    let usedPercent: number

    if (e.taxpayerType === 'small') {
      // 小规模:盯一般纳税人强制认定线 500 万(近 12 个月)与季度增值税免征线 30 万
      const generalPct = (trailingRevenue / TAX_THRESHOLDS.generalTaxpayerYearly) * 100
      const vatPct = (quarterRevenue / TAX_THRESHOLDS.vatQuarterly) * 100
      if (generalPct >= vatPct) {
        threshold = TAX_THRESHOLDS.generalTaxpayerYearly
        thresholdLabel = '一般纳税人认定线(近12月500万)'
        usedPercent = generalPct
      } else {
        threshold = TAX_THRESHOLDS.vatQuarterly
        thresholdLabel = '小规模增值税免征线(季度30万)'
        usedPercent = vatPct
      }
    } else {
      // 一般纳税人:盯小微企业所得税优惠线 300 万(年营收口径)
      threshold = TAX_THRESHOLDS.smallProfitYearly
      thresholdLabel = '小微企业优惠线(年300万)'
      usedPercent = (trailingRevenue / TAX_THRESHOLDS.smallProfitYearly) * 100
    }

    const level: TaxAlert['level'] =
      usedPercent >= 100 ? 'danger' : usedPercent >= 80 ? 'warning' : 'safe'

    alerts.push({
      entityId: e.id,
      entityName: e.name,
      taxpayerType: e.taxpayerType,
      trailingRevenue: Math.round(trailingRevenue),
      quarterRevenue: Math.round(quarterRevenue),
      threshold,
      thresholdLabel,
      usedPercent,
      level,
    })
  }

  // 风险高的排前面
  return alerts.sort((a, b) => b.usedPercent - a.usedPercent)
}

// ---------------------------------------------------------------------------
// 分类构成(营收按品类 / 成本按类目)
// ---------------------------------------------------------------------------
export type CategorySlice = { category: string; amount: number }

export async function getRevenueByCategory(): Promise<CategorySlice[]> {
  const userId = await getUserId()
  const rows = await db
    .select({
      category: transactions.category,
      total: sql<string>`sum(${transactions.amount})`,
    })
    .from(transactions)
    .where(and(eq(transactions.userId, userId), eq(transactions.bizType, 'income')))
    .groupBy(transactions.category)
    .orderBy(desc(sql`sum(${transactions.amount})`))
  return rows.map((r) => ({ category: r.category, amount: Math.round(Number(r.total)) }))
}

export async function getExpenseByCategory(): Promise<CategorySlice[]> {
  const userId = await getUserId()
  const rows = await db
    .select({
      category: transactions.category,
      total: sql<string>`sum(${transactions.amount})`,
    })
    .from(transactions)
    .where(and(eq(transactions.userId, userId), eq(transactions.bizType, 'expense')))
    .groupBy(transactions.category)
    .orderBy(desc(sql`sum(${transactions.amount})`))
  return rows.map((r) => ({ category: r.category, amount: Math.round(Number(r.total)) }))
}
