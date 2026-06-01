import type { PlatformOverview } from '@/app/actions/platform'
import { Activity, AlertTriangle, Building2, HeartPulse } from 'lucide-react'

function fmtMoney(n: number): string {
  if (n >= 1e8) return `${(n / 1e8).toFixed(2)} 亿`
  if (n >= 1e4) return `${(n / 1e4).toFixed(1)} 万`
  return n.toLocaleString('zh-CN')
}

export function KpiBand({ overview }: { overview: PlatformOverview }) {
  const o = overview
  const cards = [
    {
      label: '租户实例',
      value: o.totalTenants.toLocaleString('zh-CN'),
      sub: `在营 ${o.okTenants} · 待激活 ${o.onboardingTenants}`,
      icon: Building2,
      tint: 'text-sky-400 bg-sky-400/10',
    },
    {
      label: '平台健康分',
      value: String(o.avgHealthScore),
      sub: `主体合计 ${o.totalEntities.toLocaleString('zh-CN')} 个`,
      icon: HeartPulse,
      tint: 'text-emerald-400 bg-emerald-400/10',
    },
    {
      label: '风险 / 异常实例',
      value: `${o.riskTenants} / ${o.downTenants}`,
      sub: o.downTenants > 0 ? '存在异常实例,需介入' : '运行平稳',
      icon: Activity,
      tint: o.downTenants > 0 ? 'text-red-400 bg-red-400/10' : 'text-amber-400 bg-amber-400/10',
    },
    {
      label: '未处理告警',
      value: o.openAlerts.toLocaleString('zh-CN'),
      sub: `其中严重 ${o.riskAlerts} 条`,
      icon: AlertTriangle,
      tint: o.riskAlerts > 0 ? 'text-red-400 bg-red-400/10' : 'text-neutral-400 bg-neutral-700/40',
    },
  ]

  return (
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
      {cards.map((c) => {
        const Icon = c.icon
        return (
          <div
            key={c.label}
            className="rounded-xl border border-neutral-800 bg-neutral-900 p-4"
          >
            <div className="flex items-center justify-between">
              <span className="text-xs text-neutral-400">{c.label}</span>
              <span className={`flex size-7 items-center justify-center rounded-lg ${c.tint}`}>
                <Icon className="size-4" />
              </span>
            </div>
            <p className="mt-2 text-2xl font-semibold tracking-tight text-neutral-50">{c.value}</p>
            <p className="mt-1 text-[11px] text-neutral-500">{c.sub}</p>
          </div>
        )
      })}
    </div>
  )
}

export { fmtMoney }
