// 发票介质:电子 / 纸质
export const INVOICE_MEDIUMS = [
  { value: 'none', label: '未开票' },
  { value: 'electronic', label: '电子发票' },
  { value: 'paper', label: '纸质发票' },
] as const

// 票种标准分类(中国增值税发票体系)
export const INVOICE_KINDS = [
  { value: 'none', label: '无' },
  { value: 'special', label: '增值税专用发票' },
  { value: 'general', label: '增值税普通发票' },
  { value: 'receipt', label: '收据 / 非税票据' },
] as const

const MEDIUM_LABEL: Record<string, string> = Object.fromEntries(
  INVOICE_MEDIUMS.map((m) => [m.value, m.label]),
)
const KIND_LABEL: Record<string, string> = Object.fromEntries(
  INVOICE_KINDS.map((k) => [k.value, k.label]),
)

export function invoiceMediumLabel(v: string): string {
  return MEDIUM_LABEL[v] ?? v
}
export function invoiceKindLabel(v: string): string {
  return KIND_LABEL[v] ?? v
}

// 标准收支分类(美业行业)
export const INCOME_CATEGORIES = [
  '护理服务',
  '美容项目',
  '医美项目',
  '产品零售',
  '会员储值',
  '充值消费',
  '其他收入',
] as const

export const EXPENSE_CATEGORIES = [
  '房租物业',
  '人力薪酬',
  '产品采购',
  '耗材成本',
  '市场推广',
  '水电杂费',
  '设备折旧',
  '税费',
  '其他支出',
] as const

export function categoriesFor(bizType: string): readonly string[] {
  return bizType === 'income' ? INCOME_CATEGORIES : EXPENSE_CATEGORIES
}
