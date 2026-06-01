import type { PlatformOverview } from '@/app/actions/platform'
import Link from 'next/link'
import { CalendarClock, CalendarX, ShieldAlert } from 'lucide-react'

export function ExpiryPanel({ overview }: { overview: PlatformOverview }) {
  const items = [
    {
      label: '即将到期',
      value: overview.expiringSoon,
      icon: CalendarClock,
      tint: 'text-amber-400 bg-amber-400/10',
      href: '/platform/tenants?filter=expiring',
      hint: '7 天内到期,建议跟进续费',
    },
    {
      label: '已到期',
      value: overview.expired,
      icon: CalendarX,
      tint: 'text-red-400 bg-red-400/10',
      href: '/platform/tenants?filter=expiring',
      hint: '订阅已过期,功能可能受限',
    },
    {
      label: '税务风险超期',
      value: overview.taxOverdueTenants,
      icon: ShieldAlert,
      tint: 'text-orange-400 bg-orange-400/10',
      href: '/platform/tenants?filter=tax',
      hint: '风险超 7 天未处理,应提醒客户',
    },
  ]
  return (
    <div className="rounded-xl border border-neutral-800 bg-neutral-900 p-4">
      <h2 className="mb-3 text-sm font-semibold text-neutral-100">订阅与风险跟进</h2>
      <div className="flex flex-col gap-2">
        {items.map((it) => {
          const Icon = it.icon
          return (
            <Link
              key={it.label}
              href={it.href}
              className="flex items-center gap-3 rounded-lg border border-neutral-800 p-3 transition-colors hover:border-neutral-700 hover:bg-neutral-800/50"
            >
              <span className={`flex size-9 items-center justify-center rounded-lg ${it.tint}`}>
                <Icon className="size-4.5" />
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-sm text-neutral-300">{it.label}</p>
                <p className="truncate text-[11px] text-neutral-500">{it.hint}</p>
              </div>
              <span className="text-xl font-semibold text-neutral-50">{it.value}</span>
            </Link>
          )
        })}
      </div>
    </div>
  )
}
