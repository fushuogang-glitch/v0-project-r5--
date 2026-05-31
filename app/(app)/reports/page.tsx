import {
  getMonthlyTrend,
  getRevenueByCategory,
  getExpenseByCategory,
  getDashboardSummary,
} from '@/app/actions/finance'
import { PageHeader } from '@/components/page-header'
import { RevenueExpenseBar } from '@/components/charts/revenue-expense-bar'
import { CategoryDonut } from '@/components/charts/category-donut'
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
import {
  formatCurrency,
  formatCompactCurrency,
  formatPercent,
  formatMonthLabel,
} from '@/lib/format'

export default async function ReportsPage() {
  const [trend, revByCat, expByCat, summary] = await Promise.all([
    getMonthlyTrend(),
    getRevenueByCategory(),
    getExpenseByCategory(),
    getDashboardSummary(),
  ])

  const reversed = [...trend].reverse()

  return (
    <div className="mx-auto w-full max-w-7xl space-y-6 p-4 md:p-6 lg:p-8">
      <PageHeader
        title="财务报表"
        description="营收、成本与利润的多维度分析"
      />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <Card>
          <CardContent className="p-5">
            <p className="text-sm text-muted-foreground">累计营收</p>
            <p className="mt-2 text-2xl font-semibold tracking-tight">
              {formatCompactCurrency(summary.totalRevenue)}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-5">
            <p className="text-sm text-muted-foreground">累计成本</p>
            <p className="mt-2 text-2xl font-semibold tracking-tight">
              {formatCompactCurrency(summary.totalExpense)}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-5">
            <p className="text-sm text-muted-foreground">净利润 · 净利率</p>
            <p className="mt-2 text-2xl font-semibold tracking-tight">
              {formatCompactCurrency(summary.netProfit)}
              <span className="ml-2 text-base font-medium text-emerald-600">
                {formatPercent(summary.profitMargin)}
              </span>
            </p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">营收与成本对比</CardTitle>
          <CardDescription>近 6 个月月度对比</CardDescription>
        </CardHeader>
        <CardContent>
          <RevenueExpenseBar data={trend} />
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">营收品类构成</CardTitle>
            <CardDescription>各服务 / 产品营收占比</CardDescription>
          </CardHeader>
          <CardContent>
            <CategoryDonut data={revByCat} />
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-base">成本结构构成</CardTitle>
            <CardDescription>各成本类目占比</CardDescription>
          </CardHeader>
          <CardContent>
            <CategoryDonut data={expByCat} />
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">月度利润表</CardTitle>
          <CardDescription>各月营收、成本、利润与利润率明细</CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>月份</TableHead>
                <TableHead className="text-right">营收</TableHead>
                <TableHead className="text-right">成本</TableHead>
                <TableHead className="text-right">利润</TableHead>
                <TableHead className="text-right">利润率</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {reversed.map((m) => {
                const margin = m.revenue > 0 ? (m.profit / m.revenue) * 100 : 0
                return (
                  <TableRow key={m.month}>
                    <TableCell className="font-medium">
                      {m.month.split('-')[0]} 年 {formatMonthLabel(m.month)}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {formatCurrency(m.revenue)}
                    </TableCell>
                    <TableCell className="text-right tabular-nums text-muted-foreground">
                      {formatCurrency(m.expense)}
                    </TableCell>
                    <TableCell className="text-right tabular-nums font-medium">
                      {formatCurrency(m.profit)}
                    </TableCell>
                    <TableCell className="text-right">
                      <Badge
                        variant="secondary"
                        className="tabular-nums font-normal"
                      >
                        {formatPercent(margin)}
                      </Badge>
                    </TableCell>
                  </TableRow>
                )
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  )
}
