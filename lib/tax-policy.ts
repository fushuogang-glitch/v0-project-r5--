import { TAX_THRESHOLDS } from '@/lib/tax'

/**
 * 税政引擎:根据「主体类型 + 纳税人身份」自动适配适用的税收政策与计税口径。
 * 这是账目标准自动变化的核心——录入流水时按此口径自动套用税率、算税额。
 */

export type IncomeTaxKind = 'corporate' | 'personal_business'

export type TaxProfile = {
  taxpayerLabel: string
  vatRate: number
  vatRateOptions: number[]
  vatLabel: string
  vatQuarterlyExempt: boolean
  surtaxRate: number
  surtaxLabel: string
  incomeTaxKind: IncomeTaxKind
  incomeTaxLabel: string
  thresholds: typeof TAX_THRESHOLDS
  notes: string[]
}

const PERSONAL_TYPES = new Set(['sole', 'self_owned', 'partnership', 'studio'])

export function getTaxProfile(
  entityType: string,
  taxpayerType: string,
): TaxProfile {
  const isGeneral = taxpayerType === 'general'
  const isPersonal = PERSONAL_TYPES.has(entityType)

  const incomeTaxKind: IncomeTaxKind = isPersonal
    ? 'personal_business'
    : 'corporate'
  const incomeTaxLabel = isPersonal
    ? '个人所得税 · 经营所得(五级累进)'
    : '企业所得税(小微优惠 5% / 25%)'

  if (isGeneral) {
    return {
      taxpayerLabel: '一般纳税人',
      vatRate: 0.06,
      vatRateOptions: [0.06, 0.09, 0.13],
      vatLabel: '增值税 6%(生活服务业)',
      vatQuarterlyExempt: false,
      surtaxRate: 0.12,
      surtaxLabel: '附加税费 12%(城建+教育附加+地方教育附加)',
      incomeTaxKind,
      incomeTaxLabel,
      thresholds: TAX_THRESHOLDS,
      notes: [
        '一般纳税人按 6% 计征增值税,可凭进项发票抵扣。',
        '附加税费以实缴增值税额为计税基础,合计 12%。',
        '连续 12 个月销售额超 500 万将强制认定为一般纳税人。',
      ],
    }
  }

  return {
    taxpayerLabel: '小规模纳税人',
    vatRate: 0.01,
    vatRateOptions: [0.01, 0.03],
    vatLabel: '增值税征收率 1%(阶段性优惠)',
    vatQuarterlyExempt: true,
    surtaxRate: 0.06,
    surtaxLabel: '附加税费 6%(六税两费减半)',
    incomeTaxKind,
    incomeTaxLabel,
    thresholds: TAX_THRESHOLDS,
    notes: [
      '小规模纳税人季度销售额 ≤30 万元免征增值税。',
      '增值税征收率 1%(2027 年底前阶段性优惠,原 3%)。',
      '「六税两费」减半征收,附加税费综合按 6% 估算。',
      isPersonal
        ? '该主体为个人性质,不缴企业所得税,按个人经营所得申报。'
        : '小型微利企业年应纳税所得额 ≤300 万享受优惠税率。',
    ],
  }
}

export type TaxCalc = {
  gross: number
  net: number
  vat: number
  surtax: number
  rate: number
}

/**
 * 价税分离:由含税金额按适用税率拆出不含税额与增值税额,并计算附加税费。
 */
export function calcTax(
  grossAmount: number,
  vatRate: number,
  surtaxRate: number,
): TaxCalc {
  const net = vatRate > 0 ? grossAmount / (1 + vatRate) : grossAmount
  const vat = grossAmount - net
  const surtax = vat * surtaxRate
  return {
    gross: round2(grossAmount),
    net: round2(net),
    vat: round2(vat),
    surtax: round2(surtax),
    rate: vatRate,
  }
}

function round2(n: number): number {
  return Math.round(n * 100) / 100
}
