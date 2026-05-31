import { Wallet, TrendingUp, PiggyBank, ShieldAlert, Building2 } from 'lucide-react'
import Link from 'next/link'
import {
  getGroupSummary,
  getMonthlyTrend,
  getEntityPerformance,
  getRevenueByCategory,
  getTaxAlerts,
} from '@/app/actions/finance'
import { getScope } from '@/lib/scope'
import { PageHeader } from '@/components/page-header'
import { KpiCard } from '@/components/kpi-card'
import { TrendChart } from '@/components/charts/trend-chart'
import { CategoryDonut } from '@/components/charts/category-donut'
import { TaxAlertBar } from '@/components/tax-alert-bar'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { formatCompactCurrency, formatPercent } from '@/lib/format'

export default async function DashboardPage() {
  const [scope, summary, trend, entities, revByCat, alerts] = await Promise.all([
    getScope(),
    getGroupSummary(),
    getMonthlyTrend(),
    getEntityPerformance(),
    getRevenueByCategory(),
    getTaxAlerts(),
  ])

  const topEntities = entities.slice(0, 5)
  const topAlerts = alerts.slice(0, 4)

  // 是否聚焦在单个门店(门店端账号,或集团端切换到了某主体视图)
  const focused = scope.role === 'store' || scope.entityId != null
  const focusName = focused ? (entities[0]?.name ?? '当前门店') : null

  return (
    <div className="mx-auto w-full max-w-7xl space-y-6 p-4 md:p-6 lg:p-8">
      <PageHeader
        title={focused ? `${focusName} · 经营驾驶舱` : '集团驾驶舱'}
        description={
          focused
            ? '本门店经营财务与税务风险概览'
            : '全集团多主体经营财务与税务风险一屏总览'
        }
      />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <KpiCard
          label={focused ? '门店营收' : '集团总营收'}
          value={formatCompactCurrency(summary.totalRevenue)}
          icon={Wallet}
          delta={summary.revenueMoM}
          deltaLabel="较上月"
        />
        <KpiCard
          label="净利润"
          value={formatCompactCurrency(summary.netProfit)}
          icon={PiggyBank}
          delta={summary.profitMoM}
          deltaLabel="较上月"
        />
        <KpiCard
          label="净利率"
          value={formatPercent(summary.profitMargin)}
          icon={TrendingUp}
          hint={`${summary.entityCount} 个在营主体`}
        />
        <KpiCard
          label="税务风险预警"
          value={`${summary.warningCount} 个主体`}
          icon={ShieldAlert}
          hint="临近 / 超出临界点"
        />
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="text-base">营收 · 成本 · 利润趋势</CardTitle>
            <CardDescription>
              {focused ? '本门店' : '全集团'}近 6 个月月度走势
            </CardDescription>
          </CardHeader>
          <CardContent>
            <TrendChart data={trend} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle className="text-base">税务临界点预警</CardTitle>
              <CardDescription>额度使用率最高的主体</CardDescription>
            </div>
            <Link
              href="/tax-alerts"
              className="text-xs font-medium text-primary hover:underline"
            >
              查看全部
            </Link>
          </CardHeader>
          <CardContent className="space-y-4">
            {topAlerts.map((a) => (
              <TaxAlertBar key={a.entityId} alert={a} />
            ))}
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="text-base">主体业绩排行</CardTitle>
            <CardDescription>按累计营收排序</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {topEntities.map((e, i) => {
              const max = topEntities[0]?.revenue || 1
              const width = (e.revenue / max) * 100
              return (
                <div key={e.id} className="space-y-1.5">
                  <div className="flex items-center justify-between text-sm">
                    <div className="flex min-w-0 items-center gap-2">
                      <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded bg-muted text-xs font-medium text-muted-foreground">
                        {i + 1}
                      </span>
                      <span className="truncate font-medium text-foreground">
                        {e.name}
                      </span>
                      <Badge variant="secondary" className="shrink-0 font-normal">
                        {e.taxpayerType === 'general' ? '一般' : '小规模'}
                      </Badge>
                    </div>
                    <span className="shrink-0 tabular-nums font-medium text-foreground">
                      {formatCompactCurrency(e.revenue)}
                    </span>
                  </div>
                  <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
                    <div
                      className="h-full rounded-full bg-primary"
                      style={{ width: `${width}%` }}
                    />
                  </div>
                </div>
              )
            })}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">营收品类构成</CardTitle>
            <CardDescription>
              {focused ? '本门店' : '全集团'}各服务 / 产品占比
            </CardDescription>
          </CardHeader>
          <CardContent>
            <CategoryDonut data={revByCat} />
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
