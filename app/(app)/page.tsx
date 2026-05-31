import { Wallet, TrendingUp, PiggyBank, Receipt } from 'lucide-react'
import {
  getDashboardSummary,
  getMonthlyTrend,
  getStorePerformance,
  getRevenueByCategory,
  getExpenseByCategory,
} from '@/app/actions/finance'
import { PageHeader } from '@/components/page-header'
import { KpiCard } from '@/components/kpi-card'
import { TrendChart } from '@/components/charts/trend-chart'
import { CategoryDonut } from '@/components/charts/category-donut'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { formatCompactCurrency, formatPercent } from '@/lib/format'

export default async function DashboardPage() {
  const [summary, trend, stores, revByCat, expByCat] = await Promise.all([
    getDashboardSummary(),
    getMonthlyTrend(),
    getStorePerformance(),
    getRevenueByCategory(),
    getExpenseByCategory(),
  ])

  const topStores = stores.slice(0, 5)

  return (
    <div className="mx-auto w-full max-w-7xl space-y-6 p-4 md:p-6 lg:p-8">
      <PageHeader
        title="经营仪表盘"
        description="全部门店近 6 个月经营财务概览"
      />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <KpiCard
          label="累计营收"
          value={formatCompactCurrency(summary.totalRevenue)}
          icon={Wallet}
          delta={summary.revenueMoM}
          deltaLabel="较上月"
        />
        <KpiCard
          label="累计成本"
          value={formatCompactCurrency(summary.totalExpense)}
          icon={Receipt}
          hint="含房租 / 人力 / 物料等"
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
          hint={`${summary.storeCount} 家在营门店`}
        />
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="text-base">营收 · 成本 · 利润趋势</CardTitle>
            <CardDescription>近 6 个月月度走势</CardDescription>
          </CardHeader>
          <CardContent>
            <TrendChart data={trend} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">营收品类构成</CardTitle>
            <CardDescription>各服务 / 产品占比</CardDescription>
          </CardHeader>
          <CardContent>
            <CategoryDonut data={revByCat} />
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="text-base">门店业绩排行</CardTitle>
            <CardDescription>按累计营收排序</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {topStores.map((s, i) => {
              const max = topStores[0]?.revenue || 1
              const width = (s.revenue / max) * 100
              return (
                <div key={s.id} className="space-y-1.5">
                  <div className="flex items-center justify-between text-sm">
                    <div className="flex items-center gap-2">
                      <span className="flex h-5 w-5 items-center justify-center rounded bg-muted text-xs font-medium text-muted-foreground">
                        {i + 1}
                      </span>
                      <span className="font-medium text-foreground">{s.name}</span>
                      <span className="text-xs text-muted-foreground">{s.city}</span>
                    </div>
                    <span className="tabular-nums font-medium text-foreground">
                      {formatCompactCurrency(s.revenue)}
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
            <CardTitle className="text-base">成本结构</CardTitle>
            <CardDescription>各成本类目占比</CardDescription>
          </CardHeader>
          <CardContent>
            <CategoryDonut data={expByCat} />
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
