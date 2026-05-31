import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Users, Wallet, TicketCheck, Scale } from 'lucide-react'
import type { MembershipData } from '@/app/actions/finance'
import { formatCurrency } from '@/lib/format'
import { cn } from '@/lib/utils'

export function MembershipPanel({ data }: { data: MembershipData }) {
  const { recon, bookStoredValue, diff } = data
  const balanced = Math.abs(diff) < 1

  const stats = [
    { label: '会员数', value: String(recon.memberCount), icon: Users, suffix: '人' },
    { label: '累计充值', value: formatCurrency(recon.totalTopUp), icon: Wallet },
    { label: '累计核销', value: formatCurrency(recon.totalConsumed), icon: TicketCheck },
    { label: '预收负债余额', value: formatCurrency(recon.deferredLiability), icon: Scale },
  ]

  return (
    <div className="space-y-4">
      {/* 数据来源提示 */}
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <span>数据来源:</span>
        {recon.source === 'live' ? (
          <Badge className="bg-emerald-100 font-normal text-emerald-700">
            SaaS 实时接口
          </Badge>
        ) : (
          <Badge variant="outline" className="font-normal">
            模拟数据(未接入 SaaS,配置 SAAS_API_BASE_URL / SAAS_API_KEY 后自动切换)
          </Badge>
        )}
      </div>

      {/* 汇总指标 */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {stats.map((s) => (
          <Card key={s.label}>
            <CardContent className="flex items-center gap-3 p-4">
              <div className="flex size-9 items-center justify-center rounded-md bg-muted">
                <s.icon className="size-4 text-muted-foreground" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">{s.label}</p>
                <p className="text-lg font-semibold tabular-nums">
                  {s.value}
                  {s.suffix && (
                    <span className="ml-0.5 text-xs font-normal text-muted-foreground">
                      {s.suffix}
                    </span>
                  )}
                </p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* 对账结果 */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">储值充值对账</CardTitle>
          <CardDescription>SaaS 充值流水与财务入账核对</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <div className="rounded-lg border border-border p-4">
              <p className="text-xs text-muted-foreground">SaaS 充值合计</p>
              <p className="mt-1 text-xl font-semibold tabular-nums">
                {formatCurrency(recon.totalTopUp)}
              </p>
            </div>
            <div className="rounded-lg border border-border p-4">
              <p className="text-xs text-muted-foreground">财务储值入账</p>
              <p className="mt-1 text-xl font-semibold tabular-nums">
                {formatCurrency(bookStoredValue)}
              </p>
            </div>
            <div
              className={cn(
                'rounded-lg border p-4',
                balanced
                  ? 'border-emerald-200 bg-emerald-50'
                  : 'border-amber-200 bg-amber-50',
              )}
            >
              <p
                className={cn(
                  'text-xs',
                  balanced ? 'text-emerald-700' : 'text-amber-700',
                )}
              >
                对账差异 {balanced ? '· 已平' : '· 待核查'}
              </p>
              <p
                className={cn(
                  'mt-1 text-xl font-semibold tabular-nums',
                  balanced ? 'text-emerald-700' : 'text-amber-700',
                )}
              >
                {formatCurrency(diff)}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* 充值明细 */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">储值充值流水</CardTitle>
          <CardDescription>共 {recon.topUps.length} 条</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>日期</TableHead>
                  <TableHead>会员</TableHead>
                  <TableHead>会员号</TableHead>
                  <TableHead>渠道</TableHead>
                  <TableHead className="text-right">充值</TableHead>
                  <TableHead className="text-right">赠送</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {recon.topUps.map((t) => (
                  <TableRow key={t.id}>
                    <TableCell className="tabular-nums text-muted-foreground">{t.date}</TableCell>
                    <TableCell className="text-foreground">{t.memberName}</TableCell>
                    <TableCell className="tabular-nums text-muted-foreground">{t.memberNo}</TableCell>
                    <TableCell className="text-muted-foreground">{t.channel}</TableCell>
                    <TableCell className="text-right font-medium tabular-nums text-emerald-600">
                      +{formatCurrency(t.amount)}
                    </TableCell>
                    <TableCell className="text-right tabular-nums text-muted-foreground">
                      {formatCurrency(t.bonus)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* 消费核销明细 */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">消费核销明细</CardTitle>
          <CardDescription>共 {recon.consumes.length} 条 · 扣减储值余额</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>日期</TableHead>
                  <TableHead>会员</TableHead>
                  <TableHead>会员号</TableHead>
                  <TableHead>消费项目</TableHead>
                  <TableHead className="text-right">核销金额</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {recon.consumes.map((c) => (
                  <TableRow key={c.id}>
                    <TableCell className="tabular-nums text-muted-foreground">{c.date}</TableCell>
                    <TableCell className="text-foreground">{c.memberName}</TableCell>
                    <TableCell className="tabular-nums text-muted-foreground">{c.memberNo}</TableCell>
                    <TableCell className="text-muted-foreground">{c.item}</TableCell>
                    <TableCell className="text-right font-medium tabular-nums text-foreground">
                      -{formatCurrency(c.amount)}
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
