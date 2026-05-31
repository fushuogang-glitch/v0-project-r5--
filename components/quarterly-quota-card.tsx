import type { QuarterlyQuota } from '@/app/actions/finance'
import { cn } from '@/lib/utils'
import { formatCompactCurrency } from '@/lib/format'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

const Q_LABEL = ['一季度', '二季度', '三季度', '四季度']

const BAR_COLOR: Record<QuarterlyQuota['quarters'][number]['level'], string> = {
  safe: 'bg-emerald-500',
  warning: 'bg-amber-500',
  danger: 'bg-destructive',
}

export function QuarterlyQuotaCard({ quota }: { quota: QuarterlyQuota }) {
  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <CardTitle className="truncate text-base">{quota.entityName}</CardTitle>
            <p className="mt-1 text-xs text-muted-foreground">
              {quota.taxpayerType === 'small' ? '小规模纳税人' : '一般纳税人'} · {quota.year} 年度
            </p>
          </div>
          <div className="shrink-0 text-right">
            <p className="text-xs text-muted-foreground">建议每季度额度</p>
            <p className="text-sm font-semibold tabular-nums text-foreground">
              {formatCompactCurrency(quota.suggestedPerQuarter)}
            </p>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {quota.quarters.map((q) => {
          const pct = Math.min(q.usedPercent, 100)
          return (
            <div key={q.quarter} className="space-y-1.5">
              <div className="flex items-center justify-between text-xs">
                <span
                  className={cn(
                    'font-medium',
                    q.isCurrent ? 'text-foreground' : 'text-muted-foreground',
                  )}
                >
                  {Q_LABEL[q.quarter - 1]}
                  {q.isCurrent && (
                    <span className="ml-1.5 rounded bg-primary/10 px-1.5 py-0.5 text-[10px] text-primary">
                      本季度
                    </span>
                  )}
                </span>
                <span className="tabular-nums text-muted-foreground">
                  {formatCompactCurrency(q.revenue)} · {q.usedPercent.toFixed(0)}%
                </span>
              </div>
              <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
                <div
                  className={cn('h-full rounded-full transition-all', BAR_COLOR[q.level])}
                  style={{ width: `${pct}%` }}
                />
              </div>
            </div>
          )
        })}
        <div className="flex items-center justify-between border-t pt-3 text-xs">
          <span className="text-muted-foreground">{quota.annualThresholdLabel}</span>
          <span className="tabular-nums text-muted-foreground">
            年累计 {formatCompactCurrency(quota.yearRevenue)} / {formatCompactCurrency(quota.annualThreshold)}
          </span>
        </div>
      </CardContent>
    </Card>
  )
}
