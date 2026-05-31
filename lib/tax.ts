// 税务临界点阈值(PRD 第三部分)
export const TAX_THRESHOLDS = {
  // 小规模纳税人增值税:季度销售额 30 万以内免征
  vatQuarterly: 300000,
  // 小微企业所得税优惠:年应纳税所得额 / 营收 300 万
  smallProfitYearly: 3000000,
  // 一般纳税人强制认定:连续 12 个月销售额 500 万
  generalTaxpayerYearly: 5000000,
}
