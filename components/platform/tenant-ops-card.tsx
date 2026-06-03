'use client'

import type { TenantProfile, TenantDetail } from '@/app/actions/platform'
import { Store, Users, Activity, FileWarning } from 'lucide-react'

export function TenantOpsCard({
  profile,
  health,
}: {
  profile: TenantProfile
  health: TenantDetail | null
}) {
  const row = health?.row ?? null

  const stats = [
    { icon: Store, label: '门店数', value: profile.storeCount },
    { icon: Users, label: '子账号', value: profile.memberCount },
    { icon: Activity, label: '健康分', value: row?.healthScore ?? '—' },
    { icon: FileWarning, label: '税务超期', value: row?.taxRiskOverdue ?? 0 },
  ]

  return (
    <section className="rounded-xl border border-neutral-800 bg-neutral-900/40 p-5">
      <h2 className="text-sm font-semibold text-neutral-200">运营数据</h2>

      <div className="mt-4 grid grid-cols-2 gap-3">
        {stats.map((s) => (
          <div key={s.label} className="rounded-lg border border-neutral-800 bg-neutral-800/30 p-3">
            <div className="flex items-center gap-1.5 text-neutral-500">
              <s.icon className="size-3.5" />
              <span className="text-xs">{s.label}</span>
            </div>
            <p className="mt-1.5 text-lg font-semibold tabular-nums text-neutral-100">{s.value}</p>
          </div>
        ))}
      </div>

      <dl className="mt-4 space-y-2 text-sm">
        <div className="flex justify-between">
          <dt className="text-neutral-500">近30天处理笔数</dt>
          <dd className="text-neutral-300 tabular-nums">{row?.txnCount30d ?? 0} 笔</dd>
        </div>
        <div className="flex justify-between">
          <dt className="text-neutral-500">最近同步</dt>
          <dd className="text-neutral-300">
            {health?.lastSyncAt ? new Date(health.lastSyncAt).toLocaleString('zh-CN') : '未同步'}
          </dd>
        </div>
        <div className="flex justify-between">
          <dt className="text-neutral-500">最近登录</dt>
          <dd className="text-neutral-300">
            {row?.lastLoginAt ? new Date(row.lastLoginAt).toLocaleString('zh-CN') : '从未'}
          </dd>
        </div>
      </dl>

      {health && health.trend.length > 1 && (
        <div className="mt-4">
          <p className="mb-2 text-xs text-neutral-500">健康分趋势(近 {health.trend.length} 天)</p>
          <Sparkline data={health.trend.map((t) => t.score)} />
        </div>
      )}
    </section>
  )
}

function Sparkline({ data }: { data: number[] }) {
  if (data.length < 2) return null
  const w = 240
  const h = 40
  const max = Math.max(...data, 100)
  const min = Math.min(...data, 0)
  const range = max - min || 1
  const pts = data
    .map((v, i) => {
      const x = (i / (data.length - 1)) * w
      const y = h - ((v - min) / range) * h
      return `${x.toFixed(1)},${y.toFixed(1)}`
    })
    .join(' ')
  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="h-10 w-full" preserveAspectRatio="none" aria-hidden>
      <polyline points={pts} fill="none" stroke="currentColor" strokeWidth="1.5" className="text-amber-400" />
    </svg>
  )
}
