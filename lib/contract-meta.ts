// 合同元数据:类型 / 方向 / 状态 的标签与样式

export type ContractCategory = 'sales' | 'service' | 'purchase' | 'lease' | 'labor' | 'other'
export type ContractDirection = 'income' | 'expense'
export type ContractStatus = 'draft' | 'pending' | 'active' | 'completed' | 'void'

export const CONTRACT_CATEGORIES: { value: ContractCategory; label: string }[] = [
  { value: 'sales', label: '销售合同' },
  { value: 'service', label: '服务合同' },
  { value: 'purchase', label: '采购合同' },
  { value: 'lease', label: '租赁合同' },
  { value: 'labor', label: '劳务合同' },
  { value: 'other', label: '其他' },
]

export const CONTRACT_DIRECTIONS: { value: ContractDirection; label: string }[] = [
  { value: 'income', label: '收入类(挂对公进账)' },
  { value: 'expense', label: '支出类(挂对公付款)' },
]

export const CONTRACT_STATUSES: {
  value: ContractStatus
  label: string
  // badge 样式:secondary 中性 / outline 描边 / destructive 警示
  variant: 'secondary' | 'outline' | 'destructive' | 'default'
  tone?: string
}[] = [
  { value: 'draft', label: '草稿', variant: 'outline' },
  { value: 'pending', label: '待签署', variant: 'outline', tone: 'amber' },
  { value: 'active', label: '履行中', variant: 'default' },
  { value: 'completed', label: '已完成', variant: 'secondary' },
  { value: 'void', label: '已作废', variant: 'destructive' },
]

const CAT_MAP = new Map(CONTRACT_CATEGORIES.map((c) => [c.value, c.label]))
const STATUS_MAP = new Map(CONTRACT_STATUSES.map((s) => [s.value, s]))

export function contractCategoryLabel(v: string): string {
  return CAT_MAP.get(v as ContractCategory) ?? v
}

export function contractStatusMeta(v: string) {
  return (
    STATUS_MAP.get(v as ContractStatus) ?? {
      value: v as ContractStatus,
      label: v,
      variant: 'outline' as const,
    }
  )
}

export function contractDirectionLabel(v: string): string {
  return v === 'expense' ? '支出类' : '收入类'
}

// 文件大小友好显示
export function formatFileSize(bytes: number): string {
  if (bytes >= 1024 * 1024) return (bytes / 1024 / 1024).toFixed(1) + ' MB'
  if (bytes >= 1024) return Math.round(bytes / 1024) + ' KB'
  return bytes + ' B'
}
