import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Progress } from '@/components/ui/progress'
import { Badge } from '@/components/ui/badge'
import { formatCurrency, formatPercent } from '@/lib/format'
import type { IncomeStatement, BalanceSheet } from '@/lib/accounting'

export function FinancialStatements({
  income,
  balance,
}: {
  income: IncomeStatement
  balance: BalanceSheet
}) {
  const balanced = balance.totalAssets === balance.totalLiabilities + balance.totalEquity

  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
      {/* 利润表 */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">利润表</CardTitle>
          <CardDescription>本主体累计经营成果 · 单位:元</CardDescription>
        </CardHeader>
        <CardContent className="space-y-1">
          <Line label="一、营业收入" value={income.revenue} strong />
          <Line label="减:营业成本" value={income.cogs} indent />
          <Line label="    税金及附加" value={income.taxAndSurcharge} indent />
          <Line label="    销售费用" value={income.sellingExpense} indent />
          <Line label="    管理费用" value={income.adminExpense} indent />
          <Line label="二、营业利润" value={income.operatingProfit} strong divider />
          <Line label="减:营业外支出" value={income.nonOpExpense} indent />
          <Line label="三、利润总额" value={income.totalProfit} strong divider />
          <Line label={`减:所得税费用`} value={income.incomeTax} indent />
          <Line label="四、净利润" value={income.netProfit} strong divider highlight />
          <p className="pt-2 text-xs text-muted-foreground">
            所得税口径:{income.incomeTaxLabel}(系统估算)
          </p>
        </CardContent>
      </Card>

      {/* 资产负债表 */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-base">资产负债表</CardTitle>
              <CardDescription>期末时点 · 单位:元</CardDescription>
            </div>
            <Badge
              variant="outline"
              className={
                balanced
                  ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
                  : 'border-amber-200 bg-amber-50 text-amber-700'
              }
            >
              {balanced ? '资产=负债+权益' : '待平衡'}
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <Section title="资产" total={balance.totalAssets}>
            <Bar label="货币资金" value={balance.monetaryFunds} total={balance.totalAssets} />
          </Section>
          <Section
            title="负债"
            total={balance.totalLiabilities}
            denom={balance.totalAssets}
          >
            <Bar
              label="预收账款(会员储值)"
              value={balance.prepaidReceipts}
              total={balance.totalAssets}
            />
            <Bar label="应交税费" value={balance.taxPayable} total={balance.totalAssets} />
          </Section>
          <Section
            title="所有者权益"
            total={balance.totalEquity}
            denom={balance.totalAssets}
          >
            <Bar
              label="未分配利润"
              value={balance.retainedEarnings}
              total={balance.totalAssets}
            />
          </Section>
        </CardContent>
      </Card>
    </div>
  )
}

function Line({
  label,
  value,
  strong,
  indent,
  divider,
  highlight,
}: {
  label: string
  value: number
  strong?: boolean
  indent?: boolean
  divider?: boolean
  highlight?: boolean
}) {
  return (
    <div
      className={[
        'flex items-center justify-between py-1.5 text-sm',
        divider ? 'border-t border-border' : '',
        highlight ? 'rounded-md bg-emerald-50 px-2' : '',
      ].join(' ')}
    >
      <span
        className={[
          indent ? 'pl-4 text-muted-foreground' : 'text-foreground',
          strong ? 'font-medium' : '',
        ].join(' ')}
      >
        {label}
      </span>
      <span
        className={[
          'tabular-nums',
          strong ? 'font-semibold' : '',
          highlight ? 'text-emerald-700' : value < 0 ? 'text-destructive' : 'text-foreground',
        ].join(' ')}
      >
        {formatCurrency(value)}
      </span>
    </div>
  )
}

function Section({
  title,
  total,
  denom,
  children,
}: {
  title: string
  total: number
  denom?: number
  children: React.ReactNode
}) {
  return (
    <div>
      <div className="mb-2 flex items-center justify-between text-sm font-medium">
        <span className="text-foreground">{title}</span>
        <span className="tabular-nums">{formatCurrency(total)}</span>
      </div>
      <div className="space-y-2">{children}</div>
    </div>
  )
}

function Bar({ label, value, total }: { label: string; value: number; total: number }) {
  const pct = total > 0 ? (value / total) * 100 : 0
  return (
    <div>
      <div className="mb-1 flex items-center justify-between text-xs">
        <span className="text-muted-foreground">{label}</span>
        <span className="tabular-nums text-foreground">
          {formatCurrency(value)}
          <span className="ml-2 text-muted-foreground">{formatPercent(pct)}</span>
        </span>
      </div>
      <Progress value={Math.max(0, Math.min(100, pct))} className="h-2" />
    </div>
  )
}
