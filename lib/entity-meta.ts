// 主体类型(中国美业常见的多种纳税主体形态)
export const ENTITY_TYPES = [
  { value: 'company', label: '有限责任公司' },
  { value: 'sole', label: '个体工商户' },
  { value: 'self_owned', label: '个人独资企业' },
  { value: 'partnership', label: '合伙企业' },
  { value: 'branch', label: '分公司' },
  { value: 'studio', label: '工作室 / 服务部' },
  { value: 'clinic', label: '医疗美容门诊部' },
] as const

export type EntityTypeValue = (typeof ENTITY_TYPES)[number]['value']

const LABEL_MAP: Record<string, string> = Object.fromEntries(
  ENTITY_TYPES.map((t) => [t.value, t.label]),
)
// 兼容历史数据:旧的 store 值
LABEL_MAP.store = '门店'

export function entityTypeLabel(value: string): string {
  return LABEL_MAP[value] ?? value
}

// 纳税人身份
export const TAXPAYER_TYPES = [
  { value: 'small', label: '小规模纳税人' },
  { value: 'general', label: '一般纳税人' },
] as const

const TAXPAYER_LABEL: Record<string, string> = Object.fromEntries(
  TAXPAYER_TYPES.map((t) => [t.value, t.label]),
)

export function taxpayerLabel(value: string): string {
  return TAXPAYER_LABEL[value] ?? value
}
