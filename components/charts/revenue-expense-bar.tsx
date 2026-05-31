'use client'

import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from 'recharts'
import {
  ChartContainer,
  ChartLegend,
  ChartLegendContent,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from '@/components/ui/chart'
import { formatMonthLabel, formatCompactCurrency } from '@/lib/format'
import type { MonthlyPoint } from '@/app/actions/finance'

const chartConfig = {
  revenue: { label: '营收', color: 'var(--chart-1)' },
  expense: { label: '成本', color: 'var(--chart-3)' },
} satisfies ChartConfig

export function RevenueExpenseBar({ data }: { data: MonthlyPoint[] }) {
  return (
    <ChartContainer config={chartConfig} className="h-[300px] w-full">
      <BarChart data={data} margin={{ left: 4, right: 12, top: 8 }}>
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
        <ChartLegend content={<ChartLegendContent />} />
        <Bar dataKey="revenue" fill="var(--color-revenue)" radius={[4, 4, 0, 0]} />
        <Bar dataKey="expense" fill="var(--color-expense)" radius={[4, 4, 0, 0]} />
      </BarChart>
    </ChartContainer>
  )
}
