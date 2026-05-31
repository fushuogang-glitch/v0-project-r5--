'use client'

import { Pie, PieChart, Cell } from 'recharts'
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from '@/components/ui/chart'
import { formatCompactCurrency } from '@/lib/format'
import type { CategorySlice } from '@/app/actions/finance'

const COLORS = [
  'var(--chart-1)',
  'var(--chart-2)',
  'var(--chart-3)',
  'var(--chart-4)',
  'var(--chart-5)',
]

export function CategoryDonut({ data }: { data: CategorySlice[] }) {
  const total = data.reduce((s, d) => s + d.amount, 0)
  const config: ChartConfig = Object.fromEntries(
    data.map((d, i) => [d.category, { label: d.category, color: COLORS[i % COLORS.length] }])
  )

  return (
    <div className="flex flex-col items-center gap-4 sm:flex-row">
      <ChartContainer config={config} className="aspect-square h-[180px]">
        <PieChart>
          <ChartTooltip
            content={
              <ChartTooltipContent
                hideLabel
                formatter={(value, name) => [
                  formatCompactCurrency(Number(value)) + '  ',
                  name,
                ]}
              />
            }
          />
          <Pie
            data={data}
            dataKey="amount"
            nameKey="category"
            innerRadius={50}
            outerRadius={80}
            paddingAngle={2}
          >
            {data.map((_, i) => (
              <Cell key={i} fill={COLORS[i % COLORS.length]} />
            ))}
          </Pie>
        </PieChart>
      </ChartContainer>

      <div className="flex-1 space-y-2 w-full">
        {data.map((d, i) => {
          const pct = total > 0 ? (d.amount / total) * 100 : 0
          return (
            <div key={d.category} className="flex items-center gap-2 text-sm">
              <span
                className="h-2.5 w-2.5 shrink-0 rounded-sm"
                style={{ backgroundColor: COLORS[i % COLORS.length] }}
              />
              <span className="text-foreground">{d.category}</span>
              <span className="ml-auto tabular-nums text-muted-foreground">
                {pct.toFixed(1)}%
              </span>
              <span className="w-20 text-right tabular-nums font-medium text-foreground">
                {formatCompactCurrency(d.amount)}
              </span>
            </div>
          )
        })}
      </div>
    </div>
  )
}
