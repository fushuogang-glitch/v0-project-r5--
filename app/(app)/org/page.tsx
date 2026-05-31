import { getScope, getViewableEntities } from '@/lib/scope'
import { getOrgChart, listDepartments, listPositions } from '@/app/actions/hr'
import { PageHeader } from '@/components/page-header'
import { OrgChart } from '@/components/org-chart'

export default async function OrgPage() {
  const scope = await getScope()
  const [chart, entities, departments, positions] = await Promise.all([
    getOrgChart(),
    getViewableEntities(scope),
    listDepartments(),
    listPositions(),
  ])
  const canEdit = scope.role === 'group'

  return (
    <div className="mx-auto w-full max-w-7xl space-y-6 p-4 md:p-6 lg:p-8">
      <PageHeader
        title="人力架构"
        description="集团中控 · 部门 · 门店 · 岗位人员 — 贯穿工资与股权的中心主数据"
      />
      <OrgChart
        chart={chart}
        entities={entities.map((e) => ({ id: e.id, name: e.name, departmentId: e.departmentId }))}
        departments={departments}
        positions={positions}
        canEdit={canEdit}
      />
    </div>
  )
}
