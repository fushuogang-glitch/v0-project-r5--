import type { LucideIcon } from 'lucide-react'
import { TrendingUp, TrendingDown } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { cn } from '@/lib/utils'

export function KpiCard({
  label,
  value,
  icon: Icon,
  delta,
  deltaLabel,
  hint,
}: {
  label: string
  value: string
  icon: LucideIcon
  delta?: number
  deltaLabel?: string
  hint?: string
}) {
  const showDelta = typeof delta === 'number'
  const positive = (delta ?? 0) >= 0

  return (
    <Card>
      <CardContent className="p-5">
        <div className="flex items-center justify-between">
          <span className="text-sm text-muted-foreground">{label}</span>
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-accent text-accent-foreground">
            <Icon className="size-4" />
          </span>
        </div>
        <div className="mt-3 text-2xl font-semibold tracking-tight text-foreground">
          {value}
        </div>
        <div className="mt-2 flex items-center gap-1.5 text-xs">
          {showDelta && (
            <span
              className={cn(
                'inline-flex items-center gap-0.5 font-medium',
                positive ? 'text-emerald-600' : 'text-destructive'
              )}
            >
              {positive ? (
                <TrendingUp className="size-3.5" />
              ) : (
                <TrendingDown className="size-3.5" />
              )}
              {(positive ? '+' : '') + (delta ?? 0).toFixed(1) + '%'}
            </span>
          )}
          <span className="text-muted-foreground">{deltaLabel ?? hint}</span>
        </div>
      </CardContent>
    </Card>
  )
}
