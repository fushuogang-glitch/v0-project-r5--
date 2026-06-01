'use client'

import { useState, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import type { TenantHealthRow } from '@/app/actions/platform'
import { statusMeta, relTime } from '@/components/platform/status'
import { fmtMoney } from '@/components/platform/kpi-band'
import { ChevronRight } from 'lucide-react'

type Filter = 'all' | 'down' | 'risk' | 'ok' | 'onboarding'

export function HealthMatrix({ rows }: { rows: TenantHealthRow[] }) {
  const router = useRouter()
  const [filter, setFilter] = useState<Filter>('all')
  const [q, setQ] = useState('')

  const counts = useMemo(() => {
    const c = { all: rows.length, down: 0, risk: 0, ok: 0, onboarding: 0 }
    for (const r of rows) {
      if (r.isOnboarding) c.onboarding++
      else if (r.status === 'down') c.down++
      else if (r.status === 'risk') c.risk++
      else c.ok++
    }
    return c
  }, [rows])

  const filtered = useMemo(() => {
    return rows.filter((r) => {
      if (q && !r.tenantName.toLowerCase().includes(q.toLowerCase())) return false
      if (filter === 'all') return true
      if (filter === 'onboarding') return r.isOnboarding
      if (r.isOnboarding) return false
      return r.status === filter
    })
  }, [rows, filter, q])

  const tabs: { key: Filter; label: string }[] = [
    { key: 'all', label: `全部 ${counts.all}` },
    { key: 'down', label: `异常 ${counts.down}` },
    { key: 'risk', label: `风险 ${counts.risk}` },
    { key: 'ok', label: `正常 ${counts.ok}` },
    { key: 'onboarding', label: `待激活 ${counts.onboarding}` },
  ]

  return (
    <div className="rounded-xl border border-neutral-800 bg-neutral-900">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-neutral-800 p-4">
        <div className="flex flex-wrap gap-1.5">
          {tabs.map((t) => (
            <button
              key={t.key}
              onClick={() => setFilter(t.key)}
              className={`rounded-lg px-2.5 py-1 text-xs transition-colors ${
                filter === t.key
                  ? 'bg-amber-400/15 font-medium text-amber-300'
                  : 'text-neutral-400 hover:bg-neutral-800'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="搜索租户…"
          className="h-8 w-40 rounded-lg border border-neutral-700 bg-neutral-800 px-2.5 text-xs text-neutral-100 placeholder:text-neutral-500 focus:outline-none focus:ring-1 focus:ring-amber-400/40"
        />
      </div>

      <div className="max-h-[560px] overflow-y-auto">
        <table className="w-full text-sm">
          <thead className="sticky top-0 bg-neutral-900 text-left text-[11px] uppercase tracking-wide text-neutral-500">
            <tr className="border-b border-neutral-800">
              <th className="px-4 py-2.5 font-medium">实例 / 租户</th>
              <th className="px-3 py-2.5 font-medium">状态</th>
              <th className="px-3 py-2.5 font-medium">健康分</th>
              <th className="hidden px-3 py-2.5 font-medium md:table-cell">主体</th>
              <th className="hidden px-3 py-2.5 font-medium md:table-cell">近30天笔数</th>
              <th className="hidden px-3 py-2.5 font-medium lg:table-cell">近30天收入</th>
              <th className="hidden px-3 py-2.5 font-medium lg:table-cell">最近登录</th>
              <th className="px-3 py-2.5" />
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 && (
              <tr>
                <td colSpan={8} className="px-4 py-10 text-center text-sm text-neutral-500">
                  暂无匹配的实例
                </td>
              </tr>
            )}
            {filtered.map((r) => {
              const sk = r.isOnboarding ? 'onboarding' : r.status
              const meta = statusMeta[sk] ?? statusMeta.ok
              return (
                <tr
                  key={r.tenantId}
                  onClick={() => router.push(`/platform/tenants/${r.tenantId}`)}
                  className="cursor-pointer border-b border-neutral-800/60 transition-colors hover:bg-neutral-800/50"
                >
                  <td className="px-4 py-3">
                    <p className="font-medium text-neutral-100">{r.tenantName}</p>
                  </td>
                  <td className="px-3 py-3">
                    <span className={`inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[11px] ${meta.chip}`}>
                      <span className={`size-1.5 rounded-full ${meta.dot}`} />
                      {meta.label}
                    </span>
                  </td>
                  <td className="px-3 py-3">
                    <span className={`font-semibold ${meta.text}`}>{r.healthScore}</span>
                  </td>
                  <td className="hidden px-3 py-3 text-neutral-300 md:table-cell">{r.entityCount}</td>
                  <td className="hidden px-3 py-3 text-neutral-300 md:table-cell">
                    {r.txnCount30d.toLocaleString('zh-CN')}
                  </td>
                  <td className="hidden px-3 py-3 text-neutral-300 lg:table-cell">
                    {r.isOnboarding ? '—' : `¥${fmtMoney(r.revenue30d)}`}
                  </td>
                  <td className="hidden px-3 py-3 text-neutral-400 lg:table-cell">{relTime(r.lastLoginAt)}</td>
                  <td className="px-3 py-3 text-right text-neutral-600">
                    <ChevronRight className="ml-auto size-4" />
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}
