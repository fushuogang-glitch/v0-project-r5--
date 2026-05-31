import { getScope, getViewableEntities } from '@/lib/scope'
import { getOrgChart } from '@/app/actions/hr'
import { PageHeader } from '@/components/page-header'
import { OrgChart } from '@/components/org-chart'

export default async function OrgPage() {
  const scope = await getScope()
  const [chart, entities] = await Promise.all([getOrgChart(), getViewableEntities(scope)])
  const canEdit = scope.role === 'group'

  return (
    <div className="mx-auto w-full max-w-7xl space-y-6 p-4 md:p-6 lg:p-8">
      <PageHeader
        title="人力架构"
        description="组织架构与员工主数据 · 贯穿工资与股权的中心实体"
      />
      <OrgChart
        chart={chart}
        entities={entities.map((e) => ({ id: e.id, name: e.name }))}
        canEdit={canEdit}
      />
    </div>
  )
}
