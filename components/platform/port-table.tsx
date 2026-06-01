'use client'

import { useState } from 'react'
import { Plug, PlugZap, Unplug, AlertTriangle } from 'lucide-react'
import { relTime } from './status'
import type { PortMonitorRow } from '@/app/actions/platform'

const STATUS_META: Record<string, { label: string; chip: string; Icon: React.ElementType }> = {
  connected: { label: '已连接', chip: 'bg-emerald-400/10 text-emerald-300', Icon: PlugZap },
  error: { label: '对接异常', chip: 'bg-red-500/15 text-red-300', Icon: AlertTriangle },
  unconfigured: { label: '未配置', chip: 'bg-neutral-700/40 text-neutral-400', Icon: Unplug },
}

type Filter = 'all' | 'error' | 'unconfigured' | 'stale'

const FILTERS: { key: Filter; label: string }[] = [
  { key: 'all', label: '全部' },
  { key: 'error', label: '对接异常' },
  { key: 'unconfigured', label: '未配置' },
  { key: 'stale', label: '同步停滞(>3天)' },
]

export function PortTable({ rows }: { rows: PortMonitorRow[] }) {
  const [filter, setFilter] = useState<Filter>('all')

  const filtered = rows.filter((r) => {
    if (filter === 'error') return r.status === 'error'
    if (filter === 'unconfigured') return r.status === 'unconfigured'
    if (filter === 'stale') return r.syncDaysAgo != null && r.syncDaysAgo > 3
    return true
  })

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-1.5">
        {FILTERS.map((f) => (
          <button
            key={f.key}
            onClick={() => setFilter(f.key)}
            className={`rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
              filter === f.key ? 'bg-amber-400/15 text-amber-300' : 'bg-neutral-800/60 text-neutral-400 hover:text-neutral-200'
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      <div className="overflow-hidden rounded-xl border border-neutral-800 bg-neutral-900/40">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-neutral-800 bg-neutral-900/60 text-left text-xs text-neutral-500">
              <th className="px-4 py-2.5 font-medium">客户 / 地区</th>
              <th className="px-4 py-2.5 font-medium">对接状态</th>
              <th className="hidden px-4 py-2.5 font-medium md:table-cell">接口地址</th>
              <th className="px-4 py-2.5 text-right font-medium">最近同步</th>
              <th className="hidden px-4 py-2.5 text-right font-medium sm:table-cell">近30天Agent</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-neutral-800/70">
            {filtered.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-10 text-center text-sm text-neutral-500">没有符合条件的端口</td>
              </tr>
            )}
            {filtered.map((r) => {
              const sm = STATUS_META[r.status] ?? STATUS_META.unconfigured
              const stale = r.syncDaysAgo != null && r.syncDaysAgo > 3
              return (
                <tr key={r.tenantId} className="transition-colors hover:bg-neutral-800/40">
                  <td className="px-4 py-3">
                    <p className="font-medium text-neutral-100">{r.tenantName}</p>
                    <p className="text-xs text-neutral-500">{r.province ?? '未知地区'}</p>
                  </td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[11px] font-medium ${sm.chip}`}>
                      <sm.Icon className="size-3" aria-hidden />
                      {sm.label}
                    </span>
                  </td>
                  <td className="hidden max-w-[220px] truncate px-4 py-3 font-mono text-xs text-neutral-400 md:table-cell">
                    {r.baseUrl ?? '—'}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <span className={stale ? 'text-amber-300' : 'text-neutral-300'}>{relTime(r.lastSyncedAt)}</span>
                  </td>
                  <td className="hidden px-4 py-3 text-right tabular-nums text-neutral-300 sm:table-cell">{r.agentCount30d}</td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}
