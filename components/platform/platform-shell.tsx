'use client'

import { useState } from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { authClient } from '@/lib/auth-client'
import { LayoutDashboard, Building2, BellRing, LogOut, ShieldCheck, MapPinned, Plug, KeyRound } from 'lucide-react'
import { cn } from '@/lib/utils'
import { ChangePasswordDialog } from '@/components/change-password-dialog'

type NavItem = { title: string; href: string; icon: React.ElementType; badge?: number }

export function PlatformShell({
  admin,
  alertCount,
  children,
}: {
  admin: { name: string; loginId: string }
  alertCount: number
  children: React.ReactNode
}) {
  const pathname = usePathname()
  const router = useRouter()
  const [pwOpen, setPwOpen] = useState(false)

  const nav: NavItem[] = [
    { title: '运营中控台', href: '/platform', icon: LayoutDashboard },
    { title: '地区分布', href: '/platform/regions', icon: MapPinned },
    { title: '客户明细', href: '/platform/tenants', icon: Building2 },
    { title: '端口监控', href: '/platform/ports', icon: Plug },
    { title: '使用预警', href: '/platform/alerts', icon: BellRing, badge: alertCount },
  ]

  const isActive = (href: string) =>
    href === '/platform' ? pathname === '/platform' : pathname.startsWith(href)

  const signOut = async () => {
    await authClient.signOut()
    router.push('/platform/login')
    router.refresh()
  }

  return (
    <div className="flex min-h-svh bg-neutral-950 text-neutral-100">
      <aside className="flex w-60 shrink-0 flex-col border-r border-neutral-800 bg-neutral-900">
        <div className="flex items-center gap-2.5 border-b border-neutral-800 px-5 py-4">
          <span className="flex size-8 items-center justify-center rounded-lg bg-amber-400/15 text-amber-400">
            <ShieldCheck className="size-4.5" />
          </span>
          <div className="leading-tight">
            <p className="text-sm font-semibold text-neutral-50">运营中控台</p>
            <p className="text-[11px] text-neutral-500">平台方 · SaaS 监控</p>
          </div>
        </div>

        <nav className="flex flex-1 flex-col gap-1 p-3">
          {nav.map((item) => {
            const Icon = item.icon
            const active = isActive(item.href)
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  'flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors',
                  active
                    ? 'bg-amber-400/15 font-medium text-amber-300'
                    : 'text-neutral-400 hover:bg-neutral-800 hover:text-neutral-100',
                )}
              >
                <Icon className="size-4" />
                <span className="flex-1">{item.title}</span>
                {item.badge ? (
                  <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-red-500 px-1.5 text-[11px] font-semibold text-white">
                    {item.badge > 99 ? '99+' : item.badge}
                  </span>
                ) : null}
              </Link>
            )
          })}
        </nav>

        <div className="border-t border-neutral-800 p-3">
          <div className="mb-2 px-2">
            <p className="truncate text-sm font-medium text-neutral-200">{admin.name}</p>
            <p className="truncate text-[11px] text-neutral-500">{admin.loginId}</p>
          </div>
          <button
            onClick={() => setPwOpen(true)}
            className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm text-neutral-400 transition-colors hover:bg-neutral-800 hover:text-neutral-100"
          >
            <KeyRound className="size-4" />
            修改密码
          </button>
          <button
            onClick={signOut}
            className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm text-neutral-400 transition-colors hover:bg-neutral-800 hover:text-neutral-100"
          >
            <LogOut className="size-4" />
            退出登录
          </button>
        </div>
      </aside>

      <main className="flex-1 overflow-x-hidden">{children}</main>

      <ChangePasswordDialog open={pwOpen} onOpenChange={setPwOpen} />
    </div>
  )
}
