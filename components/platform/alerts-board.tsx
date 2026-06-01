'use client'

import { useMemo, useState } from 'react'
import { AlertFeed } from './alert-feed'
import type { PlatformAlertRow } from '@/app/actions/platform'

const DIMS: { key: string; label: string }[] = [
  { key: 'all', label: '全部' },
  { key: 'tax', label: '税务风险' },
  { key: 'billing', label: '订阅到期' },
  { key: 'offline', label: '离线' },
  { key: 'data', label: '数据断流' },
  { key: 'sync', label: '同步' },
  { key: 'audit', label: '审计' },
]

export function AlertsBoard({ alerts }: { alerts: PlatformAlertRow[] }) {
  const [dim, setDim] = useState('all')

  // 各维度计数
  const counts = useMemo(() => {
    const m: Record<string, number> = {}
    for (const a of alerts) m[a.dimension] = (m[a.dimension] ?? 0) + 1
    return m
  }, [alerts])

  const taxOverdue = alerts.filter((a) => a.code === 'tax_overdue').length
  const filtered = dim === 'all' ? alerts : alerts.filter((a) => a.dimension === dim)

  return (
    <div className="space-y-4">
      {taxOverdue > 0 && (
        <div className="flex items-start gap-3 rounded-xl border border-red-500/30 bg-red-500/5 px-4 py-3">
          <span className="mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-full bg-red-500/15 text-xs font-bold text-red-300">
            {taxOverdue}
          </span>
          <div>
            <p className="text-sm font-medium text-red-200">税务风险超期未处理</p>
            <p className="mt-0.5 text-xs text-red-300/70">
              有 {taxOverdue} 个客户存在税务风险超过 7 天未处理,建议优先联系客户跟进
            </p>
          </div>
        </div>
      )}

      <div className="flex flex-wrap gap-1.5">
        {DIMS.map((d) => {
          const c = d.key === 'all' ? alerts.length : counts[d.key] ?? 0
          return (
            <button
              key={d.key}
              onClick={() => setDim(d.key)}
              className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
                dim === d.key ? 'bg-amber-400/15 text-amber-300' : 'bg-neutral-800/60 text-neutral-400 hover:text-neutral-200'
              }`}
            >
              {d.label}
              <span className="rounded bg-neutral-700/60 px-1 text-[10px] tabular-nums text-neutral-300">{c}</span>
            </button>
          )
        })}
      </div>

      <AlertFeed alerts={filtered} />
    </div>
  )
}
