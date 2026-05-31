import type { TaxAlert } from '@/app/actions/finance'
import { cn } from '@/lib/utils'
import { formatCompactCurrency } from '@/lib/format'

const LEVEL_STYLES: Record<
  TaxAlert['level'],
  { bar: string; text: string; badge: string; label: string }
> = {
  safe: {
    bar: 'bg-emerald-500',
    text: 'text-emerald-600',
    badge: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    label: '安全',
  },
  warning: {
    bar: 'bg-amber-500',
    text: 'text-amber-600',
    badge: 'bg-amber-50 text-amber-700 border-amber-200',
    label: '临近',
  },
  danger: {
    bar: 'bg-destructive',
    text: 'text-destructive',
    badge: 'bg-red-50 text-red-700 border-red-200',
    label: '超限',
  },
}

export function TaxAlertBar({ alert }: { alert: TaxAlert }) {
  const s = LEVEL_STYLES[alert.level]
  const pct = Math.min(alert.usedPercent, 100)

  return (
    <div className="space-y-2">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate text-sm font-medium text-foreground">
            {alert.entityName}
          </p>
          <p className="text-xs text-muted-foreground">{alert.thresholdLabel}</p>
        </div>
        <span
          className={cn(
            'shrink-0 rounded-md border px-2 py-0.5 text-xs font-medium',
            s.badge,
          )}
        >
          {s.label} · {alert.usedPercent.toFixed(0)}%
        </span>
      </div>
      <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
        <div
          className={cn('h-full rounded-full transition-all', s.bar)}
          style={{ width: `${pct}%` }}
        />
      </div>
      <div className="flex items-center justify-between text-xs text-muted-foreground">
        <span className="tabular-nums">
          已用 {formatCompactCurrency(
            alert.taxpayerType === 'small' &&
              alert.thresholdLabel.includes('季度')
              ? alert.quarterRevenue
              : alert.trailingRevenue,
          )}
        </span>
        <span className="tabular-nums">阈值 {formatCompactCurrency(alert.threshold)}</span>
      </div>
    </div>
  )
}
