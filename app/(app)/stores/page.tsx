import { getStorePerformance } from '@/app/actions/finance'
import { PageHeader } from '@/components/page-header'
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
import { Store, TrendingUp, MapPin } from 'lucide-react'
import { formatCompactCurrency, formatCurrency, formatPercent, formatNumber } from '@/lib/format'

export default async function StoresPage() {
  const stores = await getStorePerformance()

  const totalRevenue = stores.reduce((s, x) => s + x.revenue, 0)
  const totalProfit = stores.reduce((s, x) => s + x.profit, 0)
  const best = stores[0]

  return (
    <div className="mx-auto w-full max-w-7xl space-y-6 p-4 md:p-6 lg:p-8">
      <PageHeader
        title="门店管理"
        description="连锁门店经营对比与财务明细"
      />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <Card>
          <CardContent className="flex items-center gap-3 p-5">
            <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-accent text-accent-foreground">
              <Store className="size-5" />
            </span>
            <div>
              <p className="text-sm text-muted-foreground">门店总数</p>
              <p className="text-xl font-semibold tracking-tight">
                {stores.length} 家
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
              <MapPin className="size-5" />
            </span>
            <div>
              <p className="text-sm text-muted-foreground">营收冠军门店</p>
              <p className="text-xl font-semibold tracking-tight truncate max-w-[180px]">
                {best?.name ?? '-'}
              </p>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">门店经营明细</CardTitle>
          <CardDescription>累计营收、成本、利润与订单对比(按营收排序)</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>门店</TableHead>
                  <TableHead>城市</TableHead>
                  <TableHead>店长</TableHead>
                  <TableHead className="text-right">营收</TableHead>
                  <TableHead className="text-right">成本</TableHead>
                  <TableHead className="text-right">利润</TableHead>
                  <TableHead className="text-right">利润率</TableHead>
                  <TableHead className="text-right">订单数</TableHead>
                  <TableHead className="text-center">状态</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {stores.map((s) => (
                  <TableRow key={s.id}>
                    <TableCell>
                      <div className="flex flex-col">
                        <span className="font-medium text-foreground">{s.name}</span>
                        <span className="text-xs text-muted-foreground">{s.code}</span>
                      </div>
                    </TableCell>
                    <TableCell className="text-muted-foreground">{s.city}</TableCell>
                    <TableCell className="text-muted-foreground">{s.manager ?? '-'}</TableCell>
                    <TableCell className="text-right tabular-nums font-medium">
                      {formatCurrency(s.revenue)}
                    </TableCell>
                    <TableCell className="text-right tabular-nums text-muted-foreground">
                      {formatCurrency(s.expense)}
                    </TableCell>
                    <TableCell className="text-right tabular-nums font-medium">
                      {formatCurrency(s.profit)}
                    </TableCell>
                    <TableCell className="text-right">
                      <Badge variant="secondary" className="tabular-nums font-normal">
                        {formatPercent(s.margin)}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right tabular-nums text-muted-foreground">
                      {formatNumber(s.orders)}
                    </TableCell>
                    <TableCell className="text-center">
                      <Badge
                        variant={s.status === 'active' ? 'default' : 'outline'}
                        className="font-normal"
                      >
                        {s.status === 'active' ? '营业中' : '已停业'}
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
