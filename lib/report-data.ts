import { db } from '@/lib/db'
import { entities, transactions } from '@/lib/db/schema'
import { and, eq } from 'drizzle-orm'
import { getScope, type Scope } from '@/lib/scope'
import { getTaxProfile } from '@/lib/tax-policy'
import {
  computeStatements,
  buildVouchers,
  type IncomeStatement,
  type BalanceSheet,
} from '@/lib/accounting'

// 报表通用结构:每张表为「列 + 多行」,便于 Excel / CSV / 屏幕渲染复用。
export type ReportSheet = {
  key: string
  title: string
  columns: string[]
  rows: (string | number)[][]
  note?: string
}

export type ReportPackage = {
  title: string
  scopeLabel: string
  period: string
  generatedAt: string
  entityCount: number
  sheets: ReportSheet[]
}

type CashFlow = {
  operatingInflow: number
  operatingOutflow: number
  netCash: number
}

type TrialRow = {
  code: string
  name: string
  debit: number
  credit: number
  balance: number // >0 借方余额 <0 贷方余额
}

type TaxRow = {
  vat: number
  surtax: number
  incomeTax: number
  revenue: number
  taxBurdenRate: number // 税负率%
}

type EntityReport = {
  id: number
  name: string
  code: string
  taxpayerLabel: string
  income: IncomeStatement
  balance: BalanceSheet
  cashFlow: CashFlow
  trial: TrialRow[]
  tax: TaxRow
}

type RawTx = {
  id: number
  bizDate: string
  bizType: string
  category: string
  channel: string
  amount: number
  netAmount: number
  taxAmount: number
  surtaxAmount: number
  invoiceKind: string
  summary: string | null
}

function round(n: number) {
  return Math.round(n)
}

/** 由原始流水计算简化现金流量 */
function computeCashFlow(rows: RawTx[]): CashFlow {
  let inflow = 0
  let outflow = 0
  for (const r of rows) {
    const stored = r.channel.includes('储值')
    if (stored) continue // 储值消耗不产生实际现金流动
    if (r.bizType === 'income') inflow += r.amount
    else outflow += r.amount
  }
  return {
    operatingInflow: round(inflow),
    operatingOutflow: round(outflow),
    netCash: round(inflow - outflow),
  }
}

/** 由凭证分录汇总科目余额(试算平衡表) */
function computeTrialBalance(rows: RawTx[]): TrialRow[] {
  const vouchers = buildVouchers(
    rows.map((r) => ({
      id: r.id,
      bizDate: r.bizDate,
      bizType: r.bizType,
      category: r.category,
      channel: r.channel,
      amount: r.amount,
      netAmount: r.netAmount,
      taxAmount: r.taxAmount,
      invoiceKind: r.invoiceKind,
      summary: r.summary,
    })),
  )
  const map = new Map<string, TrialRow>()
  for (const v of vouchers) {
    for (const e of v.entries) {
      const cur =
        map.get(e.accountCode) ??
        { code: e.accountCode, name: e.account, debit: 0, credit: 0, balance: 0 }
      cur.debit += e.debit
      cur.credit += e.credit
      map.set(e.accountCode, cur)
    }
  }
  const list = [...map.values()].map((r) => ({
    code: r.code,
    name: r.name,
    debit: round(r.debit),
    credit: round(r.credit),
    balance: round(r.debit - r.credit),
  }))
  return list.sort((a, b) => a.code.localeCompare(b.code))
}

async function loadEntityReport(scope: Scope, e: typeof entities.$inferSelect): Promise<EntityReport> {
  const profile = getTaxProfile(e.entityType, e.taxpayerType)
  const raw = await db
    .select({
      id: transactions.id,
      bizDate: transactions.bizDate,
      bizType: transactions.bizType,
      category: transactions.category,
      channel: transactions.channel,
      amount: transactions.amount,
      netAmount: transactions.netAmount,
      taxAmount: transactions.taxAmount,
      surtaxAmount: transactions.surtaxAmount,
      invoiceKind: transactions.invoiceKind,
      summary: transactions.summary,
    })
    .from(transactions)
    .where(and(eq(transactions.userId, scope.ownerId), eq(transactions.entityId, e.id)))

  const rows: RawTx[] = raw.map((r) => ({
    id: r.id,
    bizDate: String(r.bizDate),
    bizType: r.bizType,
    category: r.category,
    channel: r.channel,
    amount: Number(r.amount),
    netAmount: Number(r.netAmount),
    taxAmount: Number(r.taxAmount),
    surtaxAmount: Number(r.surtaxAmount),
    invoiceKind: r.invoiceKind,
    summary: r.summary,
  }))

  const { income, balance } = computeStatements(
    rows.map((r) => ({
      bizType: r.bizType,
      category: r.category,
      channel: r.channel,
      amount: r.amount,
      netAmount: r.netAmount,
      taxAmount: r.taxAmount,
      surtaxAmount: r.surtaxAmount,
      invoiceKind: r.invoiceKind,
    })),
    { incomeTaxKind: profile.incomeTaxKind, incomeTaxLabel: profile.incomeTaxLabel },
  )

  const cashFlow = computeCashFlow(rows)
  const trial = computeTrialBalance(rows)

  const vat = round(balance.taxPayable) // 期末应交增值税+附加(净)
  const tax: TaxRow = {
    vat: round(income.taxAndSurcharge - 0), // 税金及附加含附加,这里以申报口径用销项-进项另算
    surtax: 0,
    incomeTax: income.incomeTax,
    revenue: income.revenue,
    taxBurdenRate:
      income.revenue > 0
        ? ((income.taxAndSurcharge + income.incomeTax) / income.revenue) * 100
        : 0,
  }
  void vat

  return {
    id: e.id,
    name: e.name,
    code: e.code,
    taxpayerLabel: profile.taxpayerLabel,
    income,
    balance,
    cashFlow,
    trial,
    tax,
  }
}

const INCOME_ROWS: { label: string; key: keyof IncomeStatement }[] = [
  { label: '一、营业收入', key: 'revenue' },
  { label: '减:营业成本', key: 'cogs' },
  { label: '    税金及附加', key: 'taxAndSurcharge' },
  { label: '    销售费用', key: 'sellingExpense' },
  { label: '    管理费用', key: 'adminExpense' },
  { label: '二、营业利润', key: 'operatingProfit' },
  { label: '减:营业外支出', key: 'nonOpExpense' },
  { label: '三、利润总额', key: 'totalProfit' },
  { label: '减:所得税费用', key: 'incomeTax' },
  { label: '四、净利润', key: 'netProfit' },
]

const BALANCE_ROWS: { label: string; key: keyof BalanceSheet }[] = [
  { label: '货币资金', key: 'monetaryFunds' },
  { label: '资产总计', key: 'totalAssets' },
  { label: '预收账款(会员储值)', key: 'prepaidReceipts' },
  { label: '应交税费', key: 'taxPayable' },
  { label: '负债合计', key: 'totalLiabilities' },
  { label: '未分配利润', key: 'retainedEarnings' },
  { label: '所有者权益合计', key: 'totalEquity' },
]

function sumIncome(list: EntityReport[]): IncomeStatement {
  const acc = {} as Record<keyof IncomeStatement, number>
  for (const k of INCOME_ROWS.map((r) => r.key)) acc[k] = 0
  for (const er of list)
    for (const k of INCOME_ROWS.map((r) => r.key)) acc[k] += Number(er.income[k]) || 0
  return { ...acc, incomeTaxLabel: '合并' } as IncomeStatement
}

function sumBalance(list: EntityReport[]): BalanceSheet {
  const acc = {} as Record<keyof BalanceSheet, number>
  for (const k of BALANCE_ROWS.map((r) => r.key)) acc[k] = 0
  for (const er of list)
    for (const k of BALANCE_ROWS.map((r) => r.key)) acc[k] += Number(er.balance[k]) || 0
  return acc as BalanceSheet
}

/** 构建报表包:target 为 'group'(集团合并,含逐店列)或具体 entityId */
export async function buildReportPackage(
  target: 'group' | number,
): Promise<ReportPackage> {
  const scope = await getScope()

  // 门店端只能导出自己;集团端可选集团或单店
  let entList = await db
    .select()
    .from(entities)
    .where(eq(entities.userId, scope.ownerId))
    .orderBy(entities.code)

  if (scope.role === 'store' && scope.entityId != null) {
    entList = entList.filter((e) => e.id === scope.entityId)
  } else if (scope.entityId != null) {
    entList = entList.filter((e) => e.id === scope.entityId)
  }

  let selected = entList
  let isGroup = true
  if (target !== 'group') {
    selected = entList.filter((e) => e.id === target)
    isGroup = false
  }
  if (selected.length === 0) {
    throw new Error('无可导出的主体')
  }

  const reports = await Promise.all(selected.map((e) => loadEntityReport(scope, e)))

  const multi = isGroup && reports.length > 1
  const scopeLabel = multi
    ? `集团合并(含 ${reports.length} 家门店)`
    : reports[0].name

  // ---- 利润表 ----
  const incomeCols = multi
    ? ['项目', ...reports.map((r) => r.name), '合并数']
    : ['项目', '本期金额']
  const mergedIncome = multi ? sumIncome(reports) : null
  const incomeRows: (string | number)[][] = INCOME_ROWS.map((row) => {
    if (multi) {
      return [
        row.label,
        ...reports.map((r) => Number(r.income[row.key]) || 0),
        Number(mergedIncome![row.key]) || 0,
      ]
    }
    return [row.label, Number(reports[0].income[row.key]) || 0]
  })

  // ---- 资产负债表 ----
  const balanceCols = multi
    ? ['项目', ...reports.map((r) => r.name), '合并数']
    : ['项目', '期末余额']
  const mergedBalance = multi ? sumBalance(reports) : null
  const balanceRows: (string | number)[][] = BALANCE_ROWS.map((row) => {
    if (multi) {
      return [
        row.label,
        ...reports.map((r) => Number(r.balance[row.key]) || 0),
        Number(mergedBalance![row.key]) || 0,
      ]
    }
    return [row.label, Number(reports[0].balance[row.key]) || 0]
  })

  // ---- 现金流量表 ----
  const cfLabels: { label: string; key: keyof CashFlow }[] = [
    { label: '经营活动现金流入', key: 'operatingInflow' },
    { label: '经营活动现金流出', key: 'operatingOutflow' },
    { label: '经营活动现金流量净额', key: 'netCash' },
  ]
  const cashCols = multi
    ? ['项目', ...reports.map((r) => r.name), '合并数']
    : ['项目', '本期金额']
  const cashRows: (string | number)[][] = cfLabels.map((row) => {
    if (multi) {
      const vals = reports.map((r) => r.cashFlow[row.key])
      return [row.label, ...vals, vals.reduce((s, v) => s + v, 0)]
    }
    return [row.label, reports[0].cashFlow[row.key]]
  })

  // ---- 科目余额表(逐店分块) ----
  const trialRows: (string | number)[][] = []
  for (const r of reports) {
    if (multi) trialRows.push([`【${r.name}】`, '', '', '', ''])
    for (const t of r.trial) {
      const dir = t.balance >= 0 ? '借' : '贷'
      trialRows.push([t.code, t.name, t.debit, t.credit, `${dir} ${Math.abs(t.balance)}`])
    }
  }

  // ---- 税负表 ----
  const taxRows: (string | number)[][] = reports.map((r) => [
    r.name,
    r.taxpayerLabel,
    r.tax.revenue,
    r.income.taxAndSurcharge,
    r.tax.incomeTax,
    `${r.tax.taxBurdenRate.toFixed(2)}%`,
  ])
  if (multi) {
    const totRev = reports.reduce((s, r) => s + r.tax.revenue, 0)
    const totTas = reports.reduce((s, r) => s + r.income.taxAndSurcharge, 0)
    const totIit = reports.reduce((s, r) => s + r.tax.incomeTax, 0)
    taxRows.push([
      '合计',
      '—',
      totRev,
      totTas,
      totIit,
      `${totRev > 0 ? (((totTas + totIit) / totRev) * 100).toFixed(2) : '0.00'}%`,
    ])
  }

  const sheets: ReportSheet[] = [
    { key: 'income', title: '利润表', columns: incomeCols, rows: incomeRows, note: '单位:元' },
    { key: 'balance', title: '资产负债表', columns: balanceCols, rows: balanceRows, note: '单位:元' },
    { key: 'cashflow', title: '现金流量表', columns: cashCols, rows: cashRows, note: '简表 · 单位:元' },
    {
      key: 'trial',
      title: '科目余额表',
      columns: ['科目编码', '科目名称', '借方发生额', '贷方发生额', '期末余额'],
      rows: trialRows,
      note: '由记账凭证实时派生',
    },
    {
      key: 'tax',
      title: '税负汇总表',
      columns: ['主体', '纳税人类型', '营业收入', '税金及附加', '所得税(估)', '综合税负率'],
      rows: taxRows,
    },
  ]

  return {
    title: '诺塔智财务 · 财务报表',
    scopeLabel,
    period: `截至 ${new Date().toLocaleDateString('zh-CN')}`,
    generatedAt: new Date().toLocaleString('zh-CN', { hour12: false }),
    entityCount: reports.length,
    sheets,
  }
}
