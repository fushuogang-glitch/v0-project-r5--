import Link from 'next/link'
import { getEntityPerformance, getTaxAlerts } from '@/app/actions/finance'
import { getScope } from '@/lib/scope'
import { PageHeader } from '@/components/page-header'
import { CreateEntityDialog } from '@/components/create-entity-dialog'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { Building2, TrendingUp, ShieldAlert } from 'lucide-react'
import { formatCompactCurrency, formatCurrency, formatPercent } from '@/lib/format'
import { cn } from '@/lib/utils'

const ENTITY_TYPE_LABEL: Record<string, string> = {
  company: '有限公司',
  sole: '个体户',
  store: '门店',
}

export default async function EntitiesPage() {
  const [entities, alerts, scope] = await Promise.all([
    getEntityPerformance(),
    getTaxAlerts(),
    getScope(),
  ])

  const alertMap = new Map(alerts.map((a) => [a.entityId, a]))
  const totalRevenue = entities.reduce((s, x) => s + x.revenue, 0)
  const totalProfit = entities.reduce((s, x) => s + x.profit, 0)
  const warningCount = alerts.filter((a) => a.level !== 'safe').length

  return (
    <div className="mx-auto w-full max-w-7xl space-y-6 p-4 md:p-6 lg:p-8">
      <PageHeader
        title="主体管理"
        description="集团下属各独立纳税主体台账与经营对比"
        action={scope.role === 'group' ? <CreateEntityDialog /> : null}
      />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <Card>
          <CardContent className="flex items-center gap-3 p-5">
            <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-accent text-accent-foreground">
              <Building2 className="size-5" />
            </span>
            <div>
              <p className="text-sm text-muted-foreground">纳税主体数</p>
              <p className="text-xl font-semibold tracking-tight">
                {entities.length} 个
              </p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-3 p-5">
            <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-accent text-accent-foreground">
              <TrendingUp className="size-5" />
            </span>
            <div>
              <p className="text-sm text-muted-foreground">总利润 · 平均利润率</p>
              <p className="text-xl font-semibold tracking-tight">
                {formatCompactCurrency(totalProfit)}
                <span className="ml-2 text-sm font-medium text-emerald-600">
                  {formatPercent(totalRevenue > 0 ? (totalProfit / totalRevenue) * 100 : 0)}
                </span>
              </p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-3 p-5">
            <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-accent text-accent-foreground">
              <ShieldAlert className="size-5" />
            </span>
            <div>
              <p className="text-sm text-muted-foreground">税务风险主体</p>
              <p className="text-xl font-semibold tracking-tight">
                {warningCount} 个
              </p>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">主体台账</CardTitle>
          <CardDescription>
            各主体类型、纳税人身份、累计经营数据与税务额度使用率
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>主体名称</TableHead>
                  <TableHead>类型</TableHead>
                  <TableHead>纳税人</TableHead>
                  <TableHead>区域</TableHead>
                  <TableHead className="text-right">累计营收</TableHead>
                  <TableHead className="text-right">利润</TableHead>
                  <TableHead className="text-right">利润率</TableHead>
                  <TableHead className="text-right">额度使用</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {entities.map((e) => {
                  const alert = alertMap.get(e.id)
                  const level = alert?.level ?? 'safe'
                  return (
                    <TableRow key={e.id}>
                      <TableCell>
                        <Link
                          href={`/entities/${e.id}`}
                          className="flex flex-col group"
                        >
                          <span className="font-medium text-foreground group-hover:text-primary group-hover:underline underline-offset-4">
                            {e.name}
                          </span>
                          <span className="text-xs text-muted-foreground">
                            {e.code} · {e.legalPerson ?? '-'}
                          </span>
                        </Link>
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {ENTITY_TYPE_LABEL[e.entityType] ?? e.entityType}
                      </TableCell>
                      <TableCell>
                        <Badge variant="secondary" className="font-normal">
                          {e.taxpayerType === 'general' ? '一般纳税人' : '小规模'}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {e.region ?? '-'} · {e.city ?? '-'}
                      </TableCell>
                      <TableCell className="text-right tabular-nums font-medium">
                        {formatCurrency(e.revenue)}
                      </TableCell>
                      <TableCell className="text-right tabular-nums font-medium">
                        {formatCurrency(e.profit)}
                      </TableCell>
                      <TableCell className="text-right">
                        <Badge variant="secondary" className="tabular-nums font-normal">
                          {formatPercent(e.margin)}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <span
                          className={cn(
                            'tabular-nums font-medium',
                            level === 'danger' && 'text-destructive',
                            level === 'warning' && 'text-amber-600',
                            level === 'safe' && 'text-muted-foreground',
                          )}
                        >
                          {alert ? alert.usedPercent.toFixed(0) + '%' : '-'}
                        </span>
                      </TableCell>
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
