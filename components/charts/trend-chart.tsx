'use client'

import {
  Area,
  AreaChart,
  CartesianGrid,
  XAxis,
  YAxis,
} from 'recharts'
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from '@/components/ui/chart'
import { formatMonthLabel, formatCompactCurrency } from '@/lib/format'
import type { MonthlyPoint } from '@/app/actions/finance'

const chartConfig = {
  revenue: { label: '营收', color: 'var(--chart-1)' },
  expense: { label: '成本', color: 'var(--chart-3)' },
  profit: { label: '利润', color: 'var(--chart-4)' },
} satisfies ChartConfig

export function TrendChart({ data }: { data: MonthlyPoint[] }) {
  return (
    <ChartContainer config={chartConfig} className="h-[280px] w-full">
      <AreaChart data={data} margin={{ left: 4, right: 12, top: 8 }}>
        <defs>
          <linearGradient id="fillRevenue" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor="var(--color-revenue)" stopOpacity={0.25} />
            <stop offset="95%" stopColor="var(--color-revenue)" stopOpacity={0.02} />
          </linearGradient>
          <linearGradient id="fillProfit" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor="var(--color-profit)" stopOpacity={0.25} />
            <stop offset="95%" stopColor="var(--color-profit)" stopOpacity={0.02} />
          </linearGradient>
        </defs>
        <CartesianGrid vertical={false} strokeDasharray="3 3" />
        <XAxis
          dataKey="month"
          tickLine={false}
          axisLine={false}
          tickMargin={8}
          tickFormatter={formatMonthLabel}
        />
        <YAxis
          tickLine={false}
          axisLine={false}
          tickMargin={8}
          width={56}
          tickFormatter={(v) => formatCompactCurrency(Number(v))}
        />
        <ChartTooltip
          content={
            <ChartTooltipContent
              labelFormatter={(label) => formatMonthLabel(String(label))}
              formatter={(value, name) => [
                formatCompactCurrency(Number(value)) + '  ',
                chartConfig[name as keyof typeof chartConfig]?.label ?? name,
              ]}
            />
          }
        />
        <Area
          dataKey="revenue"
          type="monotone"
          stroke="var(--color-revenue)"
          fill="url(#fillRevenue)"
          strokeWidth={2}
        />
        <Area
          dataKey="profit"
          type="monotone"
          stroke="var(--color-profit)"
          fill="url(#fillProfit)"
          strokeWidth={2}
        />
        <Area
          dataKey="expense"
          type="monotone"
          stroke="var(--color-expense)"
          fill="transparent"
          strokeWidth={2}
          strokeDasharray="4 4"
        />
      </AreaChart>
    </ChartContainer>
  )
}
