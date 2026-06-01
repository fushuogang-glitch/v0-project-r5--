'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import { ChevronRight, Search } from 'lucide-react'
import { statusMeta, planLabel, expiryMeta, relTime } from './status'
import type { TenantHealthRow } from '@/app/actions/platform'

type Filter = 'all' | 'risk' | 'expiring' | 'tax'

const FILTERS: { key: Filter; label: string }[] = [
  { key: 'all', label: '全部' },
  { key: 'risk', label: '健康风险' },
  { key: 'expiring', label: '即将到期/已过期' },
  { key: 'tax', label: '税务超期未处理' },
]

export function TenantTable({ rows }: { rows: TenantHealthRow[] }) {
  const [filter, setFilter] = useState<Filter>('all')
  const [kw, setKw] = useState('')

  const filtered = useMemo(() => {
    return rows.filter((r) => {
      if (kw && !r.tenantName.toLowerCase().includes(kw.toLowerCase()) && !(r.province ?? '').includes(kw)) return false
      if (filter === 'risk') return r.status === 'risk' || r.status === 'down'
      if (filter === 'expiring') return r.daysToExpiry != null && r.daysToExpiry <= 7
      if (filter === 'tax') return r.taxRiskOverdue > 0
      return true
    })
  }, [rows, filter, kw])

  // 按省份分组
  const groups = useMemo(() => {
    const m = new Map<string, TenantHealthRow[]>()
    for (const r of filtered) {
      const p = r.province ?? '未知地区'
      if (!m.has(p)) m.set(p, [])
      m.get(p)!.push(r)
    }
    return Array.from(m.entries()).sort((a, b) => b[1].length - a[1].length)
  }, [filtered])

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-wrap gap-1.5">
          {FILTERS.map((f) => (
            <button
              key={f.key}
              onClick={() => setFilter(f.key)}
              className={`rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
                filter === f.key
                  ? 'bg-amber-400/15 text-amber-300'
                  : 'bg-neutral-800/60 text-neutral-400 hover:text-neutral-200'
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-neutral-500" />
          <input
            value={kw}
            onChange={(e) => setKw(e.target.value)}
            placeholder="搜索客户 / 地区"
            className="w-full rounded-md border border-neutral-800 bg-neutral-900/60 py-1.5 pl-8 pr-3 text-xs text-neutral-200 outline-none placeholder:text-neutral-600 focus:border-amber-400/40 sm:w-56"
          />
        </div>
      </div>

      {groups.length === 0 && (
        <p className="rounded-lg border border-neutral-800 bg-neutral-900/40 px-4 py-10 text-center text-sm text-neutral-500">
          没有符合条件的客户
        </p>
      )}

      {groups.map(([province, list]) => (
        <div key={province} className="overflow-hidden rounded-xl border border-neutral-800 bg-neutral-900/40">
          <div className="flex items-center justify-between border-b border-neutral-800 bg-neutral-900/60 px-4 py-2.5">
            <h3 className="text-sm font-semibold text-neutral-200">{province}</h3>
            <span className="text-xs text-neutral-500">{list.length} 个客户</span>
          </div>
          <div className="divide-y divide-neutral-800/70">
            {list.map((r) => {
              const sm = statusMeta[r.isOnboarding ? 'onboarding' : r.status] ?? statusMeta.ok
              const pm = planLabel(r.plan)
              const em = expiryMeta(r.daysToExpiry)
              return (
                <Link
                  key={r.tenantId}
                  href={`/platform/tenants/${r.tenantId}`}
                  className="flex items-center gap-3 px-4 py-3 transition-colors hover:bg-neutral-800/40"
                >
                  <span className={`size-2 shrink-0 rounded-full ${sm.dot}`} aria-hidden />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <p className="truncate text-sm font-medium text-neutral-100">{r.tenantName}</p>
                      <span className={`rounded px-1.5 py-0.5 text-[10px] font-medium ${pm.chip}`}>{pm.label}</span>
                    </div>
                    <p className="mt-0.5 text-xs text-neutral-500">
                      {r.entityCount} 个主体 · 近30天 {r.txnCount30d} 笔 · 最近登录 {relTime(r.lastLoginAt)}
                    </p>
                  </div>
                  <div className="hidden text-right sm:block">
                    <p className="text-sm font-semibold tabular-nums text-neutral-200">{r.healthScore}</p>
                    <p className="text-[10px] text-neutral-500">健康分</p>
                  </div>
                  <div className="flex w-28 shrink-0 flex-col items-end gap-1">
                    <span className={`rounded px-1.5 py-0.5 text-[10px] font-medium ${em.chip}`}>{em.label}</span>
                    {r.taxRiskOverdue > 0 && (
                      <span className="rounded bg-red-500/15 px-1.5 py-0.5 text-[10px] font-medium text-red-300">
                        税务超期 {r.taxRiskOverdue}
                      </span>
                    )}
                  </div>
                  <ChevronRight className="size-4 shrink-0 text-neutral-600" aria-hidden />
                </Link>
              )
            })}
          </div>
        </div>
      ))}
    </div>
  )
}
