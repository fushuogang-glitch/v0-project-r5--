import { db } from '@/lib/db'
import { entities, transactions } from '@/lib/db/schema'
import { and, eq, gte, lte } from 'drizzle-orm'
import { getScope } from '@/lib/scope'
import { getTaxProfile } from '@/lib/tax-policy'
import { computeStatements } from '@/lib/accounting'
import type { ReportPackage, ReportSheet } from '@/lib/report-data'

// 申报期间:季度(默认)或月度
export type FilingPeriod = { year: number; quarter?: number; month?: number }

function periodRange(p: FilingPeriod): { start: string; end: string; label: string } {
  const y = p.year
  if (p.month) {
    const start = new Date(Date.UTC(y, p.month - 1, 1))
    const end = new Date(Date.UTC(y, p.month, 0))
    return {
      start: start.toISOString().slice(0, 10),
      end: end.toISOString().slice(0, 10),
      label: `${y}年${String(p.month).padStart(2, '0')}月`,
    }
  }
  const q = p.quarter ?? 1
  const startMonth = (q - 1) * 3
  const start = new Date(Date.UTC(y, startMonth, 1))
  const end = new Date(Date.UTC(y, startMonth + 3, 0))
  return {
    start: start.toISOString().slice(0, 10),
    end: end.toISOString().slice(0, 10),
    label: `${y}年第${q}季度`,
  }
}

function n2(n: number) {
  return Math.round(n * 100) / 100
}

type FilingTx = {
  bizType: string
  category: string
  channel: string
  amount: number
  netAmount: number
  taxAmount: number
  surtaxAmount: number
  invoiceKind: string
}

/**
 * 生成国标税务申报表(增值税及附加 + 所得税预缴 + 报送提示)。
 * 申报以单一纳税主体为单位,target 必须为具体 entityId。
 * 数据为依据系统流水的预填测算,正式申报以税务机关口径为准。
 */
export async function buildTaxFilingPackage(
  entityId: number,
  period: FilingPeriod,
): Promise<ReportPackage> {
  const scope = await getScope()

  // 门店端只能看自己
  if (scope.role === 'store' && scope.entityId != null && scope.entityId !== entityId) {
    throw new Error('无权访问该主体')
  }

  const [ent] = await db
    .select()
    .from(entities)
    .where(and(eq(entities.id, entityId), eq(entities.userId, scope.ownerId)))
    .limit(1)
  if (!ent) throw new Error('主体不存在')

  const { start, end, label } = periodRange(period)
  const profile = getTaxProfile(ent.entityType, ent.taxpayerType)

  const rows = await db
    .select({
      bizType: transactions.bizType,
      category: transactions.category,
      channel: transactions.channel,
      amount: transactions.amount,
      netAmount: transactions.netAmount,
      taxAmount: transactions.taxAmount,
      surtaxAmount: transactions.surtaxAmount,
      invoiceKind: transactions.invoiceKind,
    })
    .from(transactions)
    .where(
      and(
        eq(transactions.userId, scope.ownerId),
        eq(transactions.entityId, entityId),
        eq(transactions.status, 'posted'),
        gte(transactions.bizDate, start),
        lte(transactions.bizDate, end),
      ),
    )

  const txs: FilingTx[] = rows.map((r) => ({
    bizType: r.bizType,
    category: r.category,
    channel: r.channel,
    amount: Number(r.amount),
    netAmount: Number(r.netAmount) || Number(r.amount),
    taxAmount: Number(r.taxAmount) || 0,
    surtaxAmount: Number(r.surtaxAmount) || 0,
    invoiceKind: r.invoiceKind,
  }))

  // 收入(不含税销售额)、销项税、进项税
  let salesNet = 0
  let vatOutput = 0
  let vatInput = 0
  for (const t of txs) {
    const stored = t.channel.includes('储值')
    if (t.bizType === 'income') {
      if (stored) continue // 储值充值非当期增值税应税收入(预收)
      salesNet += t.netAmount
      vatOutput += t.taxAmount
    } else {
      // 仅专用发票进项可抵扣
      if (t.invoiceKind === 'special') vatInput += t.taxAmount
    }
  }
  salesNet = n2(salesNet)
  vatOutput = n2(vatOutput)
  vatInput = n2(vatInput)

  const sheets: ReportSheet[] = []

  // ====== 表一:增值税及附加税费申报表 ======
  if (profile.taxpayerLabel === '小规模纳税人') {
    const exempt = salesNet <= profile.thresholds.vatQuarterly
    const vatPayable = exempt ? 0 : n2(salesNet * profile.vatRate)
    const surtax = exempt ? 0 : n2(vatPayable * profile.surtaxRate)
    sheets.push({
      key: 'vat',
      title: '增值税及附加税费申报表(小规模纳税人适用)',
      columns: ['项目', '本期数'],
      rows: [
        ['一、应征增值税不含税销售额', salesNet],
        ['其中:免税销售额', exempt ? salesNet : 0],
        ['二、增值税征收率', `${(profile.vatRate * 100).toFixed(0)}%`],
        ['三、本期应纳增值税额', vatPayable],
        ['四、增值税减免税额(季度≤30万免征)', exempt ? n2(salesNet * profile.vatRate) : 0],
        ['五、本期应补(退)增值税', vatPayable],
        ['六、城建税及教育费附加(综合6%)', surtax],
        ['七、本期应缴税费合计', n2(vatPayable + surtax)],
      ],
      note: exempt
        ? `本季不含税销售额 ${salesNet} 元 ≤ 30 万元,免征增值税`
        : '小规模纳税人按征收率全额计征',
    })
  } else {
    const vatPayable = n2(Math.max(vatOutput - vatInput, 0))
    const surtax = n2(vatPayable * profile.surtaxRate)
    sheets.push({
      key: 'vat',
      title: '增值税及附加税费申报表(一般纳税人适用)',
      columns: ['项目', '本期数'],
      rows: [
        ['一、销售额(不含税)', salesNet],
        ['二、销项税额', vatOutput],
        ['三、进项税额(取得专票部分)', vatInput],
        ['四、本期应纳税额(销项-进项)', vatPayable],
        ['五、期末留抵税额', n2(Math.max(vatInput - vatOutput, 0))],
        ['六、城建税及教育费附加(12%)', surtax],
        ['七、本期应缴税费合计', n2(vatPayable + surtax)],
      ],
      note: '一般纳税人按销项税额抵扣进项税额计算应纳税额',
    })
  }

  // ====== 表二:所得税预缴申报表 ======
  const { income } = computeStatements(txs, {
    incomeTaxKind: profile.incomeTaxKind,
    incomeTaxLabel: profile.incomeTaxLabel,
  })
  const totalProfit = n2(income.totalProfit)

  if (profile.incomeTaxKind === 'corporate') {
    // 小型微利企业:应纳税所得额≤300万,减按25%计入,税率20%,实际税负5%
    const taxable = Math.max(totalProfit, 0)
    const isSmall = taxable <= profile.thresholds.smallProfitYearly
    const citPayable = isSmall ? n2(taxable * 0.05) : n2(taxable * 0.25)
    sheets.push({
      key: 'cit',
      title: '中华人民共和国企业所得税月(季)度预缴纳税申报表(A类)',
      columns: ['项目', '本期累计'],
      rows: [
        ['一、营业收入', n2(income.revenue)],
        ['二、营业成本', n2(income.cogs)],
        ['三、利润总额', totalProfit],
        ['四、实际利润额(应纳税所得额)', taxable],
        ['五、适用税率', isSmall ? '5%(小微优惠)' : '25%'],
        ['六、本期应纳所得税额', citPayable],
        ['七、减免所得税额', isSmall ? n2(taxable * 0.25 - citPayable) : 0],
        ['八、本期应补(退)所得税额', citPayable],
      ],
      note: isSmall
        ? '符合小型微利企业条件,应纳税所得额≤300万减按5%预缴'
        : '应纳税所得额超过300万,按25%法定税率',
    })
  } else {
    // 个人经营所得:五级超额累进
    const taxable = Math.max(totalProfit, 0)
    const { tax, bracket } = personalBusinessTax(taxable)
    sheets.push({
      key: 'iit',
      title: '个人所得税经营所得纳税申报表(B表)',
      columns: ['项目', '本期累计'],
      rows: [
        ['一、收入总额', n2(income.revenue)],
        ['二、成本费用', n2(income.cogs + income.sellingExpense + income.adminExpense)],
        ['三、利润总额(应纳税所得额)', taxable],
        ['四、适用税率', bracket],
        ['五、本期应纳个人所得税额', tax],
      ],
      note: '个体工商户/个人独资按经营所得五级超额累进税率计征',
    })
  }

  // ====== 表三:财务报表主要数据(报送提示)======
  sheets.push({
    key: 'submit',
    title: '财务报表报送主要数据',
    columns: ['项目', '金额'],
    rows: [
      ['营业收入', n2(income.revenue)],
      ['营业成本', n2(income.cogs)],
      ['税金及附加', n2(income.taxAndSurcharge)],
      ['销售费用', n2(income.sellingExpense)],
      ['管理费用', n2(income.adminExpense)],
      ['营业利润', n2(income.operatingProfit)],
      ['利润总额', totalProfit],
      ['净利润', n2(income.netProfit)],
    ],
    note: '随税申报同步报送的财务报表关键科目',
  })

  return {
    title: '诺塔智财务 · 税务申报表',
    scopeLabel: `${ent.name} · ${profile.taxpayerLabel} · ${label}`,
    period: label,
    generatedAt: new Date().toLocaleString('zh-CN', { hour12: false }),
    entityCount: 1,
    sheets,
  }
}

// 个人经营所得五级超额累进(年度口径,预缴按累计测算)
function personalBusinessTax(taxable: number): { tax: number; bracket: string } {
  const brackets = [
    { upTo: 30000, rate: 0.05, deduct: 0 },
    { upTo: 90000, rate: 0.1, deduct: 1500 },
    { upTo: 300000, rate: 0.2, deduct: 10500 },
    { upTo: 500000, rate: 0.3, deduct: 40500 },
    { upTo: Infinity, rate: 0.35, deduct: 65500 },
  ]
  const b = brackets.find((x) => taxable <= x.upTo) ?? brackets[brackets.length - 1]
  const tax = Math.max(n2(taxable * b.rate - b.deduct), 0)
  return { tax, bracket: `${(b.rate * 100).toFixed(0)}% 速算扣除 ${b.deduct}` }
}
