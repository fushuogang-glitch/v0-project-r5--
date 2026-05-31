import { getScope, getViewableEntities } from '@/lib/scope'
import { getEquityData, getDividendForecast } from '@/app/actions/equity'
import { PageHeader } from '@/components/page-header'
import { EquityManager } from '@/components/equity-manager'
import { Card, CardContent } from '@/components/ui/card'
import { PieChart } from 'lucide-react'

export default async function EquityPage({
  searchParams,
}: {
  searchParams: Promise<{ entity?: string }>
}) {
  const sp = await searchParams
  const scope = await getScope()
  const entities = await getViewableEntities(scope)

  return (
    <div className="mx-auto w-full max-w-7xl space-y-6 p-4 md:p-6 lg:p-8">
      <PageHeader
        title="股权管理"
        description="三层股权(银股 / 身股 / 发展股)结构、分红权释放与年度分红测算 · 与单店关联"
      />

      {entities.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-3 py-16 text-center">
            <span className="flex size-12 items-center justify-center rounded-full bg-muted text-muted-foreground">
              <PieChart className="size-6" />
            </span>
            <p className="text-sm text-muted-foreground">
              暂无可管理的门店主体,请先在「主体管理」中创建门店
            </p>
          </CardContent>
        </Card>
      ) : (
        await renderManager(scope, entities, sp.entity)
      )}
    </div>
  )
}

async function renderManager(
  scope: Awaited<ReturnType<typeof getScope>>,
  entities: { id: number; name: string }[],
  requested?: string,
) {
  const requestedId = requested ? Number(requested) : null
  const baseId =
    scope.role === 'store' ? scope.entityId ?? entities[0].id : requestedId ?? entities[0].id
  const selectedId = entities.some((e) => e.id === baseId) ? baseId : entities[0].id

  const [data, forecast] = await Promise.all([
    getEquityData(selectedId),
    getDividendForecast(selectedId),
  ])

  if (!data) {
    return (
      <Card>
        <CardContent className="py-16 text-center text-sm text-muted-foreground">
          无权查看该门店股权数据
        </CardContent>
      </Card>
    )
  }

  return (
    <EquityManager
      entities={entities}
      selectedId={selectedId}
      data={data}
      forecast={forecast}
      canEdit={scope.role === 'group'}
    />
  )
}
