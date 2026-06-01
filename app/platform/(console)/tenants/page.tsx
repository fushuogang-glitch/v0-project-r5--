import { getTenantHealthList } from '@/app/actions/platform'
import { TenantTable } from '@/components/platform/tenant-table'

export const dynamic = 'force-dynamic'
export const metadata = { title: '客户明细 · 运营中控台' }

export default async function TenantsPage({
  searchParams,
}: {
  searchParams: Promise<{ province?: string }>
}) {
  const { province } = await searchParams
  const rows = await getTenantHealthList('all', province)
  return (
    <div className="space-y-6 p-6">
      <header>
        <h1 className="text-xl font-semibold text-neutral-100">客户明细</h1>
        <p className="mt-1 text-sm text-neutral-500">
          {province
            ? `已筛选地区:${province} · 共 ${rows.length} 个客户`
            : '按地区分组展示全部客户的使用状态、套餐、订阅到期与税务风险'}
        </p>
      </header>
      <TenantTable rows={rows} />
    </div>
  )
}
