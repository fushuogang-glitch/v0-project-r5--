import { getProvinceStats } from '@/app/actions/platform'
import { ChinaMap } from '@/components/platform/china-map'
import { RegionTable } from '@/components/platform/region-table'

export const dynamic = 'force-dynamic'
export const metadata = { title: '地区分布 · 运营中控台' }

export default async function RegionsPage() {
  const stats = await getProvinceStats()
  return (
    <div className="space-y-6 p-6">
      <header>
        <h1 className="text-xl font-semibold text-neutral-100">地区分布</h1>
        <p className="mt-1 text-sm text-neutral-500">客户在全国的部署热力、活跃与风险分布,点击省份查看该地区客户明细</p>
      </header>
      <ChinaMap stats={stats} />
      <RegionTable stats={stats} />
    </div>
  )
}
