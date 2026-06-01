import { getAccounts } from '@/app/actions/finance'
import { getBankReconciliation } from '@/app/actions/reconciliation'
import { getScope } from '@/lib/scope'
import { PageHeader } from '@/components/page-header'
import { BankReconciliation } from '@/components/bank-reconciliation'
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
import { Wallet, Building2, TrendingUp } from 'lucide-react'
import { accountMeta } from '@/lib/account-meta'
import { formatCompactCurrency, formatCurrency, formatPercent } from '@/lib/format'

export default async function AccountsPage() {
  const [accounts, scope, reconciliation] = await Promise.all([
    getAccounts(),
    getScope(),
    getBankReconciliation(),
  ])

  const totalReceived = accounts.reduce((s, a) => s + a.received, 0)

  // 按主体分组
  const groups = new Map<number, { name: string; rows: typeof accounts }>()
  for (const a of accounts) {
    const g = groups.get(a.entityId) ?? { name: a.entityName, rows: [] }
    g.rows.push(a)
    groups.set(a.entityId, g)
  }

  // 按账户类型汇总(用于顶部分布)
  const byType = new Map<string, number>()
  for (const a of accounts) {
    byType.set(a.accountType, (byType.get(a.accountType) ?? 0) + a.received)
  }
  const typeRanking = Array.from(byType.entries()).sort((a, b) => b[1] - a[1])

  const isSingle = scope.entityId != null

  return (
    <div className="mx-auto w-full max-w-7xl space-y-6 p-4 md:p-6 lg:p-8">
      <PageHeader
        title="收款账户"
        description={
          isSingle
            ? '本门店各收款渠道的累计收款金额'
            : '集团各主体收款账户与累计收款金额一览'
        }
      />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <Card>
          <CardContent className="flex items-center gap-3 p-5">
            <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-accent text-accent-foreground">
              <TrendingUp className="size-5" />
            </span>
            <div>
              <p className="text-sm text-muted-foreground">累计收款总额</p>
              <p className="text-xl font-semibold tracking-tight">
                {formatCompactCurrency(totalReceived)}
              </p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-3 p-5">
            <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-accent text-accent-foreground">
              <Wallet className="size-5" />
            </span>
            <div>
              <p className="text-sm text-muted-foreground">收款账户数</p>
              <p className="text-xl font-semibold tracking-tight">{accounts.length} 个</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-3 p-5">
            <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-accent text-accent-foreground">
              <Building2 className="size-5" />
            </span>
            <div>
              <p className="text-sm text-muted-foreground">覆盖主体</p>
              <p className="text-xl font-semibold tracking-tight">{groups.size} 个</p>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">收款渠道分布</CardTitle>
          <CardDescription>各收款方式累计金额占比</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {typeRanking.map(([type, amount]) => {
            const meta = accountMeta(type)
            const pct = totalReceived > 0 ? (amount / totalReceived) * 100 : 0
            return (
              <div key={type} className="space-y-1.5">
                <div className="flex items-center justify-between text-sm">
                  <span className="flex items-center gap-2 font-medium text-foreground">
                    <meta.icon className="size-4 text-muted-foreground" />
                    {meta.label}
                  </span>
                  <span className="tabular-nums text-muted-foreground">
                    {formatCompactCurrency(amount)} · {formatPercent(pct)}
                  </span>
                </div>
                <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
                  <div
                    className="h-full rounded-full bg-primary"
                    style={{ width: `${pct}%` }}
                  />
                </div>
              </div>
            )
          })}
        </CardContent>
      </Card>

      <BankReconciliation data={reconciliation} />

      {Array.from(groups.entries()).map(([entityId, g]) => {
        const subtotal = g.rows.reduce((s, a) => s + a.received, 0)
        return (
          <Card key={entityId}>
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle className="text-base">{g.name}</CardTitle>
                <CardDescription>{g.rows.length} 个收款账户</CardDescription>
              </div>
              <div className="text-right">
                <p className="text-xs text-muted-foreground">收款小计</p>
                <p className="text-lg font-semibold tabular-nums">
                  {formatCompactCurrency(subtotal)}
                </p>
              </div>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>账户名称</TableHead>
                      <TableHead>类型</TableHead>
                      <TableHead>账号 / 持有人</TableHead>
                      <TableHead>状态</TableHead>
                      <TableHead className="text-right">累计收款</TableHead>
                      <TableHead className="text-right">占比</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {g.rows.map((a) => {
                      const meta = accountMeta(a.accountType)
                      const pct = subtotal > 0 ? (a.received / subtotal) * 100 : 0
                      // 实时满额判断:累计收款 / 最高额度
                      const hasLimit = a.maxLimit != null && a.maxLimit > 0
                      const limitPct = hasLimit
                        ? Math.min((a.received / (a.maxLimit as number)) * 100, 100)
                        : 0
                      const isFull = hasLimit && a.received >= (a.maxLimit as number)
                      const isNear = hasLimit && !isFull && limitPct >= 80
                      return (
                        <TableRow key={a.id}>
                          <TableCell className="font-medium text-foreground">
                            <span className="flex items-center gap-2">
                              <meta.icon className="size-4 text-muted-foreground" />
                              {a.name}
                              {isFull && (
                                <Badge variant="destructive" className="font-normal">
                                  已满额
                                </Badge>
                              )}
                              {isNear && (
                                <Badge
                                  variant="outline"
                                  className="border-amber-500/50 font-normal text-amber-600 dark:text-amber-400"
                                >
                                  接近满额
                                </Badge>
                              )}
                            </span>
                          </TableCell>
                          <TableCell className="text-muted-foreground">
                            {meta.label}
                          </TableCell>
                          <TableCell className="text-muted-foreground">
                            <div className="flex flex-col">
                              <span className="tabular-nums">{a.accountNo ?? '—'}</span>
                              <span className="text-xs">{a.holder ?? ''}</span>
                            </div>
                          </TableCell>
                          <TableCell>
                            <Badge
                              variant={a.status === 'active' ? 'secondary' : 'outline'}
                              className="font-normal"
                            >
                              {a.status === 'active' ? '启用' : '停用'}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-right tabular-nums font-medium">
                            <div className="flex flex-col items-end gap-1">
                              <span>{formatCurrency(a.received)}</span>
                              {hasLimit && (
                                <>
                                  <span className="text-xs font-normal text-muted-foreground">
                                    限额 {formatCompactCurrency(a.maxLimit as number)} ·{' '}
                                    {formatPercent(limitPct)}
                                  </span>
                                  <div className="h-1.5 w-24 overflow-hidden rounded-full bg-muted">
                                    <div
                                      className={`h-full rounded-full ${
                                        isFull
                                          ? 'bg-destructive'
                                          : isNear
                                            ? 'bg-amber-500'
                                            : 'bg-primary'
                                      }`}
                                      style={{ width: `${limitPct}%` }}
                                    />
                                  </div>
                                </>
                              )}
                            </div>
                          </TableCell>
                          <TableCell className="text-right tabular-nums text-muted-foreground">
                            {formatPercent(pct)}
                          </TableCell>
                        </TableRow>
                      )
                    })}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        )
      })}
    </div>
  )
}
