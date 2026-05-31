'use server'

import { db } from '@/lib/db'
import { entities, transactions, accounts } from '@/lib/db/schema'
import { TAX_THRESHOLDS } from '@/lib/tax'
import { getTaxProfile, calcTax } from '@/lib/tax-policy'
import { getScope, type Scope } from '@/lib/scope'
import { and, eq, sql, desc, type SQL } from 'drizzle-orm'
import { revalidatePath } from 'next/cache'

// ---------------------------------------------------------------------------
// 范围助手:所有业务查询都按 ownerId 隔离;若 scope 锁定了某主体(门店端 / 集团
// 选中单店视图),再追加 entityId 过滤。
// ---------------------------------------------------------------------------
function txWhere(scope: Scope, extra: SQL[] = []) {
  const conds: SQL[] = [eq(transactions.userId, scope.ownerId), ...extra]
  if (scope.entityId != null) conds.push(eq(transactions.entityId, scope.entityId))
  return and(...conds)
}

/** 校验某主体属于当前 scope,门店端只能访问自己的主体 */
async function assertEntityAccess(scope: Scope, entityId: number) {
  if (scope.role === 'store' && scope.entityId !== entityId) {
    throw new Error('无权访问该主体')
  }
  const [e] = await db
    .select()
    .from(entities)
    .where(and(eq(entities.id, entityId), eq(entities.userId, scope.ownerId)))
    .limit(1)
  if (!e) throw new Error('主体不存在')
  return e
}

// ---------------------------------------------------------------------------
// 演示数据:首次进入自动生成多主体台账、统一流水与收款账户
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

// 收款账户模板(channel 与流水 channel 对应,用于汇总收款额)
const ACCOUNT_TEMPLATES = [
  { name: '微信收款', accountType: 'wechat', channel: '微信' },
  { name: '支付宝收款', accountType: 'alipay', channel: '支付宝' },
  { name: '对公银行账户', accountType: 'bank', channel: '银行卡' },
  { name: '门店现金', accountType: 'cash', channel: '现金' },
  { name: '会员储值账户', accountType: 'stored_value', channel: '储值余额' },
]

function rand(min: number, max: number) {
  return Math.random() * (max - min) + min
}

function splitTax(amount: number, rate: number) {
  const net = amount / (1 + rate)
  const tax = amount - net
  return { net: Number(net.toFixed(2)), tax: Number(tax.toFixed(2)) }
}

function seedAccountsFor(userId: string, entityId: number, city: string) {
  return ACCOUNT_TEMPLATES.map((t) => ({
    userId,
    entityId,
    name: t.name,
    accountType: t.accountType,
    channel: t.channel,
    accountNo:
      t.accountType === 'bank'
        ? '6217 **** **** ' + Math.floor(rand(1000, 9999))
        : t.accountType === 'cash'
          ? null
          : '****' + Math.floor(rand(1000, 9999)),
    holder: `${city}璞境`,
    status: 'active',
  }))
}

export async function ensureSeedData() {
  const scope = await getScope()
  // 门店端不触发播种(数据由集团创建)
  if (scope.role === 'store') return { seeded: false }
  const userId = scope.ownerId

  const existing = await db
    .select({ id: entities.id })
    .from(entities)
    .where(eq(entities.userId, userId))

  // 已有主体:仅补建缺失的收款账户(老数据兼容)
  if (existing.length > 0) {
    const hasAccounts = await db
      .select({ id: accounts.id })
      .from(accounts)
      .where(eq(accounts.userId, userId))
      .limit(1)
    if (hasAccounts.length === 0) {
      const ents = await db
        .select({ id: entities.id, city: entities.city })
        .from(entities)
        .where(eq(entities.userId, userId))
      for (const e of ents) {
        await db.insert(accounts).values(seedAccountsFor(userId, e.id, e.city ?? ''))
      }
    }
    return { seeded: false }
  }

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

    await db.insert(accounts).values(seedAccountsFor(userId, entity.id, e.city))

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
// 汇总(集团总览,或 scope 锁定单主体时即该主体口径)
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
  const scope = await getScope()

  const [income] = await db
    .select({
      total: sql<string>`coalesce(sum(${transactions.amount}), 0)`,
      tax: sql<string>`coalesce(sum(${transactions.taxAmount}), 0)`,
    })
    .from(transactions)
    .where(txWhere(scope, [eq(transactions.bizType, 'income')]))

  const [expense] = await db
    .select({
      total: sql<string>`coalesce(sum(${transactions.amount}), 0)`,
      tax: sql<string>`coalesce(sum(${transactions.taxAmount}), 0)`,
    })
    .from(transactions)
    .where(txWhere(scope, [eq(transactions.bizType, 'expense')]))

  const entityConds: SQL[] = [eq(entities.userId, scope.ownerId), eq(entities.status, 'active')]
  if (scope.entityId != null) entityConds.push(eq(entities.id, scope.entityId))
  const [entityAgg] = await db
    .select({ count: sql<string>`count(*)` })
    .from(entities)
    .where(and(...entityConds))

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
    totalTax: Number(income?.tax ?? 0) + Number(expense?.tax ?? 0),
    revenueMoM,
    profitMoM,
    warningCount,
  }
}

// ---------------------------------------------------------------------------
// 月度趋势
// ---------------------------------------------------------------------------
export type MonthlyPoint = {
  month: string
  revenue: number
  expense: number
  profit: number
}

export async function getMonthlyTrend(): Promise<MonthlyPoint[]> {
  const scope = await getScope()

  const rows = await db
    .select({
      month: sql<string>`to_char(${transactions.bizDate}, 'YYYY-MM')`,
      bizType: transactions.bizType,
      total: sql<string>`sum(${transactions.amount})`,
    })
    .from(transactions)
    .where(txWhere(scope))
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
  const scope = await getScope()

  const entConds: SQL[] = [eq(entities.userId, scope.ownerId)]
  if (scope.entityId != null) entConds.push(eq(entities.id, scope.entityId))
  const list = await db
    .select()
    .from(entities)
    .where(and(...entConds))
    .orderBy(entities.code)

  const agg = await db
    .select({
      entityId: transactions.entityId,
      bizType: transactions.bizType,
      total: sql<string>`sum(${transactions.amount})`,
    })
    .from(transactions)
    .where(txWhere(scope))
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
// 税务额度临界点预警
// ---------------------------------------------------------------------------
export type TaxAlert = {
  entityId: number
  entityName: string
  taxpayerType: string
  trailingRevenue: number
  quarterRevenue: number
  threshold: number
  thresholdLabel: string
  usedPercent: number
  level: 'safe' | 'warning' | 'danger'
}

export async function getTaxAlerts(entityIdFilter?: number): Promise<TaxAlert[]> {
  const scope = await getScope()

  const entConds: SQL[] = [eq(entities.userId, scope.ownerId), eq(entities.status, 'active')]
  // 指定主体时(如单店详情页),按 URL 主体查询并校验权限,忽略全局视图过滤
  if (entityIdFilter != null) {
    await assertEntityAccess(scope, entityIdFilter)
    entConds.push(eq(entities.id, entityIdFilter))
  } else if (scope.entityId != null) {
    entConds.push(eq(entities.id, scope.entityId))
  }
  const list = await db
    .select()
    .from(entities)
    .where(and(...entConds))

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
          eq(transactions.userId, scope.ownerId),
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
          eq(transactions.userId, scope.ownerId),
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

  return alerts.sort((a, b) => b.usedPercent - a.usedPercent)
}

// ---------------------------------------------------------------------------
// 分类构成
// ---------------------------------------------------------------------------
export type CategorySlice = { category: string; amount: number }

export async function getRevenueByCategory(): Promise<CategorySlice[]> {
  const scope = await getScope()
  const rows = await db
    .select({
      category: transactions.category,
      total: sql<string>`sum(${transactions.amount})`,
    })
    .from(transactions)
    .where(txWhere(scope, [eq(transactions.bizType, 'income')]))
    .groupBy(transactions.category)
    .orderBy(desc(sql`sum(${transactions.amount})`))
  return rows.map((r) => ({ category: r.category, amount: Math.round(Number(r.total)) }))
}

export async function getExpenseByCategory(): Promise<CategorySlice[]> {
  const scope = await getScope()
  const rows = await db
    .select({
      category: transactions.category,
      total: sql<string>`sum(${transactions.amount})`,
    })
    .from(transactions)
    .where(txWhere(scope, [eq(transactions.bizType, 'expense')]))
    .groupBy(transactions.category)
    .orderBy(desc(sql`sum(${transactions.amount})`))
  return rows.map((r) => ({ category: r.category, amount: Math.round(Number(r.total)) }))
}

// ---------------------------------------------------------------------------
// 收款账户:列表 + 每个账户的累计收款额(按 entityId + channel 汇总收入流水)
// ---------------------------------------------------------------------------
export type AccountWithRevenue = {
  id: number
  entityId: number
  entityName: string
  name: string
  accountType: string
  channel: string
  accountNo: string | null
  holder: string | null
  status: string
  received: number
}

export async function getAccounts(): Promise<AccountWithRevenue[]> {
  const scope = await getScope()

  const accConds: SQL[] = [eq(accounts.userId, scope.ownerId)]
  if (scope.entityId != null) accConds.push(eq(accounts.entityId, scope.entityId))
  const list = await db
    .select()
    .from(accounts)
    .where(and(...accConds))
    .orderBy(accounts.entityId, accounts.id)

  // 按 (entityId, channel) 汇总收入
  const agg = await db
    .select({
      entityId: transactions.entityId,
      channel: transactions.channel,
      total: sql<string>`sum(${transactions.amount})`,
    })
    .from(transactions)
    .where(txWhere(scope, [eq(transactions.bizType, 'income')]))
    .groupBy(transactions.entityId, transactions.channel)

  const revMap = new Map<string, number>()
  for (const a of agg) revMap.set(`${a.entityId}::${a.channel}`, Number(a.total))

  const entList = await db
    .select({ id: entities.id, name: entities.name })
    .from(entities)
    .where(eq(entities.userId, scope.ownerId))
  const nameMap = new Map(entList.map((e) => [e.id, e.name]))

  return list.map((a) => ({
    id: a.id,
    entityId: a.entityId,
    entityName: nameMap.get(a.entityId) ?? '-',
    name: a.name,
    accountType: a.accountType,
    channel: a.channel,
    accountNo: a.accountNo,
    holder: a.holder,
    status: a.status,
    received: Math.round(revMap.get(`${a.entityId}::${a.channel}`) ?? 0),
  }))
}

// ---------------------------------------------------------------------------
// 单主体明细(供单店详情页使用)
// ---------------------------------------------------------------------------
export type EntityDetail = {
  entity: {
    id: number
    name: string
    code: string
    entityType: string
    taxpayerType: string
    creditCode: string | null
    legalPerson: string | null
    region: string | null
    city: string | null
    address: string | null
    status: string
    establishDate: string | null
  }
  summary: { revenue: number; expense: number; profit: number; margin: number; totalTax: number }
}

export async function getEntityDetail(entityId: number): Promise<EntityDetail> {
  const scope = await getScope()
  const e = await assertEntityAccess(scope, entityId)

  const [income] = await db
    .select({
      total: sql<string>`coalesce(sum(${transactions.amount}), 0)`,
      tax: sql<string>`coalesce(sum(${transactions.taxAmount}), 0)`,
    })
    .from(transactions)
    .where(
      and(
        eq(transactions.userId, scope.ownerId),
        eq(transactions.entityId, entityId),
        eq(transactions.bizType, 'income'),
      ),
    )

  const [expense] = await db
    .select({
      total: sql<string>`coalesce(sum(${transactions.amount}), 0)`,
      tax: sql<string>`coalesce(sum(${transactions.taxAmount}), 0)`,
    })
    .from(transactions)
    .where(
      and(
        eq(transactions.userId, scope.ownerId),
        eq(transactions.entityId, entityId),
        eq(transactions.bizType, 'expense'),
      ),
    )

  const revenue = Math.round(Number(income?.total ?? 0))
  const exp = Math.round(Number(expense?.total ?? 0))
  const profit = revenue - exp

  return {
    entity: {
      id: e.id,
      name: e.name,
      code: e.code,
      entityType: e.entityType,
      taxpayerType: e.taxpayerType,
      creditCode: e.creditCode,
      legalPerson: e.legalPerson,
      region: e.region,
      city: e.city,
      address: e.address,
      status: e.status,
      establishDate: e.establishDate,
    },
    summary: {
      revenue,
      expense: exp,
      profit,
      margin: revenue > 0 ? (profit / revenue) * 100 : 0,
      totalTax: Math.round(Number(income?.tax ?? 0) + Number(expense?.tax ?? 0)),
    },
  }
}

export type EntityAccount = {
  id: number
  name: string
  accountType: string
  accountNo: string | null
  holder: string | null
  status: string
  received: number
}

export async function getEntityAccounts(entityId: number): Promise<EntityAccount[]> {
  const scope = await getScope()
  await assertEntityAccess(scope, entityId)

  const list = await db
    .select()
    .from(accounts)
    .where(and(eq(accounts.userId, scope.ownerId), eq(accounts.entityId, entityId)))
    .orderBy(accounts.id)

  const agg = await db
    .select({
      channel: transactions.channel,
      total: sql<string>`sum(${transactions.amount})`,
    })
    .from(transactions)
    .where(
      and(
        eq(transactions.userId, scope.ownerId),
        eq(transactions.entityId, entityId),
        eq(transactions.bizType, 'income'),
      ),
    )
    .groupBy(transactions.channel)

  const revMap = new Map(agg.map((a) => [a.channel, Number(a.total)]))

  return list.map((a) => ({
    id: a.id,
    name: a.name,
    accountType: a.accountType,
    accountNo: a.accountNo,
    holder: a.holder,
    status: a.status,
    received: Math.round(revMap.get(a.channel) ?? 0),
  }))
}

export type TxRow = {
  id: number
  bizDate: string
  bizType: string
  category: string
  channel: string
  amount: number
  netAmount: number
  taxAmount: number
  invoiced: boolean
  invoiceMedium: string
  invoiceKind: string
  invoiceNo: string | null
  summary: string | null
}

export async function getEntityTransactions(
  entityId: number,
  limit = 30,
): Promise<TxRow[]> {
  const scope = await getScope()
  await assertEntityAccess(scope, entityId)

  const rows = await db
    .select({
      id: transactions.id,
      bizDate: transactions.bizDate,
      bizType: transactions.bizType,
      category: transactions.category,
      channel: transactions.channel,
      amount: transactions.amount,
      netAmount: transactions.netAmount,
      taxAmount: transactions.taxAmount,
      invoiced: transactions.invoiced,
      invoiceMedium: transactions.invoiceMedium,
      invoiceKind: transactions.invoiceKind,
      invoiceNo: transactions.invoiceNo,
      summary: transactions.summary,
    })
    .from(transactions)
    .where(and(eq(transactions.userId, scope.ownerId), eq(transactions.entityId, entityId)))
    .orderBy(desc(transactions.bizDate), desc(transactions.id))
    .limit(limit)

  return rows.map((r) => ({
    id: r.id,
    bizDate: r.bizDate,
    bizType: r.bizType,
    category: r.category,
    channel: r.channel,
    amount: Math.round(Number(r.amount)),
    netAmount: Math.round(Number(r.netAmount)),
    taxAmount: Math.round(Number(r.taxAmount)),
    invoiced: r.invoiced,
    invoiceMedium: r.invoiceMedium,
    invoiceKind: r.invoiceKind,
    invoiceNo: r.invoiceNo,
    summary: r.summary,
  }))
}

// ---------------------------------------------------------------------------
// 税政:返回某主体当前适用的税收政策(账目标准随主体自动变化)
// ---------------------------------------------------------------------------
export async function getEntityTaxPolicy(entityId: number) {
  const scope = await getScope()
  const e = await assertEntityAccess(scope, entityId)
  return {
    entityType: e.entityType,
    taxpayerType: e.taxpayerType,
    profile: getTaxProfile(e.entityType, e.taxpayerType),
  }
}

export type CreateTxInput = {
  entityId: number
  bizType: 'income' | 'expense'
  bizDate: string
  category: string
  channel: string
  amount: number
  // 发票
  invoiceMedium?: string
  invoiceKind?: string
  invoiceNo?: string
  invoiceCode?: string
  summary?: string
}

export type CreateTxResult =
  | { ok: true; id: number; taxAmount: number; netAmount: number }
  | { ok: false; error: string }

/**
 * 录入一笔收支流水。账目标准自动变化:依据该主体的税政(税率/计税口径)
 * 自动完成价税分离、计算增值税额与附加税费。
 */
export async function createTransaction(
  input: CreateTxInput,
): Promise<CreateTxResult> {
  const scope = await getScope()
  const e = await assertEntityAccess(scope, input.entityId)

  if (!(input.amount > 0)) return { ok: false, error: '金额必须大于 0' }
  if (!input.category) return { ok: false, error: '请选择业务分类' }

  // 按主体税政自动套用税率并算税
  const profile = getTaxProfile(e.entityType, e.taxpayerType)
  const invoiceMedium = input.invoiceMedium ?? 'none'
  const invoiced = invoiceMedium !== 'none'
  // 已开票才产生销项/进项税额;未开票按未计税处理
  const rate = invoiced ? profile.vatRate : 0
  const calc = calcTax(input.amount, rate, profile.surtaxRate)

  const [row] = await db
    .insert(transactions)
    .values({
      userId: scope.ownerId,
      entityId: input.entityId,
      bizDate: input.bizDate,
      bizType: input.bizType,
      category: input.category,
      channel: input.channel || (input.bizType === 'income' ? '现金' : '银行卡'),
      amount: String(calc.gross),
      taxRate: String(rate),
      taxAmount: String(calc.vat),
      surtaxAmount: String(calc.surtax),
      netAmount: String(calc.net),
      invoiced,
      invoiceMedium,
      invoiceKind: input.invoiceKind ?? 'none',
      invoiceNo: input.invoiceNo || null,
      invoiceCode: input.invoiceCode || null,
      summary: input.summary || null,
      source: 'manual',
      status: 'posted',
    })
    .returning({ id: transactions.id })

  revalidatePath(`/entities/${input.entityId}`)
  revalidatePath('/')
  revalidatePath('/reports')
  revalidatePath('/tax-alerts')
  return { ok: true, id: row.id, taxAmount: calc.vat, netAmount: calc.net }
}
