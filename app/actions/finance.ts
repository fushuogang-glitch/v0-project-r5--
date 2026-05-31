'use server'

import { auth } from '@/lib/auth'
import { db } from '@/lib/db'
import { stores, revenues, expenses } from '@/lib/db/schema'
import { and, eq, sql, desc } from 'drizzle-orm'
import { headers } from 'next/headers'

async function getUserId() {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session?.user) throw new Error('Unauthorized')
  return session.user.id
}

// ---------------------------------------------------------------------------
// 演示数据:用户首次进入且没有任何门店时,自动生成连锁门店与近 6 个月财务流水
// ---------------------------------------------------------------------------
const DEMO_STORES = [
  { name: '璞境·国贸旗舰店', code: 'BJ-001', city: '北京', manager: '王雪', phone: '010-8800-1234', base: 420000 },
  { name: '璞境·静安寺店', code: 'SH-002', city: '上海', manager: '李婷', phone: '021-6200-5678', base: 380000 },
  { name: '璞境·天河城店', code: 'GZ-003', city: '广州', manager: '陈曦', phone: '020-3800-9012', base: 310000 },
  { name: '璞境·春熙路店', code: 'CD-004', city: '成都', manager: '赵敏', phone: '028-8600-3456', base: 260000 },
  { name: '璞境·西湖银泰店', code: 'HZ-005', city: '杭州', manager: '孙琳', phone: '0571-8700-7890', base: 230000 },
]

const REVENUE_CATEGORIES = ['皮肤护理', '美容美体', '产品零售', '储值充值', '美甲美睫']
const REVENUE_CHANNELS = ['微信', '支付宝', '银行卡', '现金', '储值余额']
const EXPENSE_CATEGORIES = ['房租', '人力薪酬', '物料耗材', '水电杂费', '市场营销']
// 各成本类目占营收的大致比例
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

export async function ensureSeedData() {
  const userId = await getUserId()
  const existing = await db
    .select({ id: stores.id })
    .from(stores)
    .where(eq(stores.userId, userId))
    .limit(1)
  if (existing.length > 0) return { seeded: false }

  const now = new Date()

  for (const s of DEMO_STORES) {
    const openedYear = 2019 + Math.floor(rand(0, 4))
    const [store] = await db
      .insert(stores)
      .values({
        userId,
        name: s.name,
        code: s.code,
        city: s.city,
        manager: s.manager,
        phone: s.phone,
        address: `${s.city}市核心商圈`,
        status: 'active',
        openedAt: `${openedYear}-0${1 + Math.floor(rand(0, 8))}-15`,
      })
      .returning({ id: stores.id })

    const revenueRows: (typeof revenues.$inferInsert)[] = []
    const expenseRows: (typeof expenses.$inferInsert)[] = []

    // 近 6 个月,每月按月初记一条聚合流水(演示用)
    for (let m = 5; m >= 0; m--) {
      const d = new Date(now.getFullYear(), now.getMonth() - m, 1)
      const bizDate = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`
      // 季节性 + 随机波动,越近的月份略有增长
      const growth = 1 + (5 - m) * 0.025
      const monthRevenue = s.base * growth * rand(0.88, 1.12)

      // 营收拆分到各品类
      const weights = [0.34, 0.26, 0.16, 0.14, 0.1]
      REVENUE_CATEGORIES.forEach((cat, i) => {
        const amount = monthRevenue * weights[i] * rand(0.9, 1.1)
        revenueRows.push({
          userId,
          storeId: store.id,
          bizDate,
          category: cat,
          channel: REVENUE_CHANNELS[i % REVENUE_CHANNELS.length],
          amount: amount.toFixed(2),
          orderCount: Math.round(amount / rand(380, 720)),
        })
      })

      // 成本拆分到各类目
      EXPENSE_CATEGORIES.forEach((cat) => {
        const amount = monthRevenue * EXPENSE_RATIO[cat] * rand(0.92, 1.08)
        expenseRows.push({
          userId,
          storeId: store.id,
          bizDate,
          category: cat,
          amount: amount.toFixed(2),
        })
      })
    }

    await db.insert(revenues).values(revenueRows)
    await db.insert(expenses).values(expenseRows)
  }

  return { seeded: true }
}

// ---------------------------------------------------------------------------
// 仪表盘汇总
// ---------------------------------------------------------------------------
export type DashboardSummary = {
  totalRevenue: number
  totalExpense: number
  netProfit: number
  profitMargin: number
  storeCount: number
  orderCount: number
  // 环比(最近月 vs 上一月)
  revenueMoM: number
  profitMoM: number
}

export async function getDashboardSummary(): Promise<DashboardSummary> {
  const userId = await getUserId()

  const [rev] = await db
    .select({
      total: sql<string>`coalesce(sum(${revenues.amount}), 0)`,
      orders: sql<string>`coalesce(sum(${revenues.orderCount}), 0)`,
    })
    .from(revenues)
    .where(eq(revenues.userId, userId))

  const [exp] = await db
    .select({ total: sql<string>`coalesce(sum(${expenses.amount}), 0)` })
    .from(expenses)
    .where(eq(expenses.userId, userId))

  const [storeAgg] = await db
    .select({ count: sql<string>`count(*)` })
    .from(stores)
    .where(and(eq(stores.userId, userId), eq(stores.status, 'active')))

  const trend = await getMonthlyTrend()
  const last = trend[trend.length - 1]
  const prev = trend[trend.length - 2]

  const totalRevenue = Number(rev?.total ?? 0)
  const totalExpense = Number(exp?.total ?? 0)
  const netProfit = totalRevenue - totalExpense

  const revenueMoM =
    last && prev && prev.revenue > 0
      ? ((last.revenue - prev.revenue) / prev.revenue) * 100
      : 0
  const profitMoM =
    last && prev && prev.profit !== 0
      ? ((last.profit - prev.profit) / Math.abs(prev.profit)) * 100
      : 0

  return {
    totalRevenue,
    totalExpense,
    netProfit,
    profitMargin: totalRevenue > 0 ? (netProfit / totalRevenue) * 100 : 0,
    storeCount: Number(storeAgg?.count ?? 0),
    orderCount: Number(rev?.orders ?? 0),
    revenueMoM,
    profitMoM,
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

  const revByMonth = await db
    .select({
      month: sql<string>`to_char(${revenues.bizDate}, 'YYYY-MM')`,
      total: sql<string>`sum(${revenues.amount})`,
    })
    .from(revenues)
    .where(eq(revenues.userId, userId))
    .groupBy(sql`to_char(${revenues.bizDate}, 'YYYY-MM')`)

  const expByMonth = await db
    .select({
      month: sql<string>`to_char(${expenses.bizDate}, 'YYYY-MM')`,
      total: sql<string>`sum(${expenses.amount})`,
    })
    .from(expenses)
    .where(eq(expenses.userId, userId))
    .groupBy(sql`to_char(${expenses.bizDate}, 'YYYY-MM')`)

  const map = new Map<string, { revenue: number; expense: number }>()
  for (const r of revByMonth) {
    map.set(r.month, { revenue: Number(r.total), expense: 0 })
  }
  for (const e of expByMonth) {
    const cur = map.get(e.month) ?? { revenue: 0, expense: 0 }
    cur.expense = Number(e.total)
    map.set(e.month, cur)
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
// 门店业绩排行
// ---------------------------------------------------------------------------
export type StorePerformance = {
  id: number
  name: string
  code: string
  city: string
  manager: string | null
  status: string
  revenue: number
  expense: number
  profit: number
  margin: number
  orders: number
}

export async function getStorePerformance(): Promise<StorePerformance[]> {
  const userId = await getUserId()
  const storeList = await db
    .select()
    .from(stores)
    .where(eq(stores.userId, userId))
    .orderBy(stores.code)

  const revByStore = await db
    .select({
      storeId: revenues.storeId,
      total: sql<string>`sum(${revenues.amount})`,
      orders: sql<string>`sum(${revenues.orderCount})`,
    })
    .from(revenues)
    .where(eq(revenues.userId, userId))
    .groupBy(revenues.storeId)

  const expByStore = await db
    .select({
      storeId: expenses.storeId,
      total: sql<string>`sum(${expenses.amount})`,
    })
    .from(expenses)
    .where(eq(expenses.userId, userId))
    .groupBy(expenses.storeId)

  const revMap = new Map(revByStore.map((r) => [r.storeId, r]))
  const expMap = new Map(expByStore.map((e) => [e.storeId, Number(e.total)]))

  return storeList
    .map((s) => {
      const revenue = Number(revMap.get(s.id)?.total ?? 0)
      const orders = Number(revMap.get(s.id)?.orders ?? 0)
      const expense = expMap.get(s.id) ?? 0
      const profit = revenue - expense
      return {
        id: s.id,
        name: s.name,
        code: s.code,
        city: s.city,
        manager: s.manager,
        status: s.status,
        revenue: Math.round(revenue),
        expense: Math.round(expense),
        profit: Math.round(profit),
        margin: revenue > 0 ? (profit / revenue) * 100 : 0,
        orders,
      }
    })
    .sort((a, b) => b.revenue - a.revenue)
}

// ---------------------------------------------------------------------------
// 分类构成(营收按品类 / 成本按类目)
// ---------------------------------------------------------------------------
export type CategorySlice = { category: string; amount: number }

export async function getRevenueByCategory(): Promise<CategorySlice[]> {
  const userId = await getUserId()
  const rows = await db
    .select({
      category: revenues.category,
      total: sql<string>`sum(${revenues.amount})`,
    })
    .from(revenues)
    .where(eq(revenues.userId, userId))
    .groupBy(revenues.category)
    .orderBy(desc(sql`sum(${revenues.amount})`))
  return rows.map((r) => ({ category: r.category, amount: Math.round(Number(r.total)) }))
}

export async function getExpenseByCategory(): Promise<CategorySlice[]> {
  const userId = await getUserId()
  const rows = await db
    .select({
      category: expenses.category,
      total: sql<string>`sum(${expenses.amount})`,
    })
    .from(expenses)
    .where(eq(expenses.userId, userId))
    .groupBy(expenses.category)
    .orderBy(desc(sql`sum(${expenses.amount})`))
  return rows.map((r) => ({ category: r.category, amount: Math.round(Number(r.total)) }))
}
