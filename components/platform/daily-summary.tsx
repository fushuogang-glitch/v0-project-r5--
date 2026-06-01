import type { DailySummary } from '@/app/actions/platform'
import { fmtMoney } from './kpi-band'
import { CalendarCheck } from 'lucide-react'

export function DailySummaryStrip({ summary }: { summary: DailySummary }) {
  const items = [
    { label: '今日活跃实例', value: summary.activeTenants.toLocaleString('zh-CN') },
    { label: '近30天流水', value: `${summary.totalTxn30d.toLocaleString('zh-CN')} 笔` },
    { label: '近30天收入', value: `¥${fmtMoney(summary.totalRevenue30d)}` },
    { label: '今日新增预警', value: summary.newAlerts.toLocaleString('zh-CN') },
    { label: '今日已处理', value: summary.resolvedToday.toLocaleString('zh-CN') },
  ]
  return (
    <div className="rounded-xl border border-neutral-800 bg-neutral-900 p-4">
      <div className="mb-3 flex items-center gap-2">
        <CalendarCheck className="size-4 text-amber-400" />
        <h2 className="text-sm font-semibold text-neutral-100">每日使用总结</h2>
        <span className="text-[11px] text-neutral-500">{summary.date}</span>
      </div>
      <div className="grid grid-cols-2 gap-x-4 gap-y-3 sm:grid-cols-5">
        {items.map((it) => (
          <div key={it.label}>
            <p className="text-lg font-semibold text-neutral-50">{it.value}</p>
            <p className="text-[11px] text-neutral-500">{it.label}</p>
          </div>
        ))}
      </div>
    </div>
  )
}
