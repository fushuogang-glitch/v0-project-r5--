// 财务岗位角色定义:出纳 / 会计 / 审计 / 税务专员
// 用于财务子账号的角色标签、职责说明与页面访问权限(RBAC)

export type FinanceRole = 'cashier' | 'accountant' | 'auditor' | 'tax'

export type FinanceRoleDef = {
  value: FinanceRole
  label: string // 岗位名
  duty: string // 岗位职责
  // 该角色可访问的导航路径(集团管理员不受限,拥有全部)
  allow: string[]
}

export const FINANCE_ROLES: FinanceRoleDef[] = [
  {
    value: 'cashier',
    label: '出纳',
    duty: '负责现金/银行收付、收款账户管理与银行对账,经手不记账。',
    allow: ['/accounts', '/reports', '/audit'],
  },
  {
    value: 'accountant',
    label: '会计',
    duty: '负责日常记账、报表编制、工资与凭证处理,记账不管钱。',
    allow: ['/reports', '/accounts', '/org', '/audit'],
  },
  {
    value: 'auditor',
    label: '审计',
    duty: '独立复核账务、监督收支与对账差异,处理月度审计发现。',
    allow: ['/audit', '/reports', '/accounts', '/equity', '/tax-alerts'],
  },
  {
    value: 'tax',
    label: '税务专员',
    duty: '负责纳税申报、发票管理与税务合规临界点监控。',
    allow: ['/tax-alerts', '/tax-filing', '/reports', '/audit'],
  },
]

const ROLE_MAP = new Map(FINANCE_ROLES.map((r) => [r.value, r]))

export function financeRoleDef(role?: string | null): FinanceRoleDef | null {
  if (!role) return null
  return ROLE_MAP.get(role as FinanceRole) ?? null
}

export function financeRoleLabel(role?: string | null): string {
  return financeRoleDef(role)?.label ?? ''
}

/** 判断某财务角色是否可访问给定路径(集团管理员请在调用方放行) */
export function financeRoleCanAccess(role: string | null | undefined, path: string): boolean {
  const def = financeRoleDef(role)
  if (!def) return true // 非财务子账号(集团/门店端)由其它逻辑控制
  // 仅集团驾驶舱对所有财务角色开放;设置为管理员专属,不放行
  if (path === '/') return true
  return def.allow.some((p) => path === p || path.startsWith(p + '/'))
}
