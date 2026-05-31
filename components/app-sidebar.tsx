'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import {
  LayoutDashboard,
  BarChart3,
  Building2,
  ShieldAlert,
  Wallet,
  Store,
  PieChart,
  Network,
  Settings,
  LogOut,
} from 'lucide-react'
import { authClient } from '@/lib/auth-client'
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from '@/components/ui/sidebar'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'

type NavItem = { title: string; href: string; icon: typeof LayoutDashboard }

const groupNav: NavItem[] = [
  { title: '集团驾驶舱', href: '/', icon: LayoutDashboard },
  { title: '主体管理', href: '/entities', icon: Building2 },
  { title: '收款账户', href: '/accounts', icon: Wallet },
  { title: '财务报表', href: '/reports', icon: BarChart3 },
  { title: '股权管理', href: '/equity', icon: PieChart },
  { title: '人力架构', href: '/org', icon: Network },
  { title: '税务预警', href: '/tax-alerts', icon: ShieldAlert },
  { title: '设置', href: '/settings', icon: Settings },
]

function storeNav(entityId: number | null): NavItem[] {
  return [
    { title: '门店驾驶舱', href: '/', icon: LayoutDashboard },
    {
      title: '门店详情',
      href: entityId ? `/entities/${entityId}` : '/entities',
      icon: Store,
    },
    { title: '收款账户', href: '/accounts', icon: Wallet },
    { title: '财务报表', href: '/reports', icon: BarChart3 },
    { title: '股权分红', href: '/equity', icon: PieChart },
    { title: '人力架构', href: '/org', icon: Network },
    { title: '税务预警', href: '/tax-alerts', icon: ShieldAlert },
  ]
}

export function AppSidebar({
  user,
  role = 'group',
  storeEntityId = null,
}: {
  user: { name: string; email: string }
  role?: 'group' | 'store'
  storeEntityId?: number | null
}) {
  const pathname = usePathname()
  const router = useRouter()
  const navItems = role === 'store' ? storeNav(storeEntityId) : groupNav

  const handleSignOut = async () => {
    await authClient.signOut()
    router.push('/sign-in')
    router.refresh()
  }

  return (
    <Sidebar>
      <SidebarHeader className="border-b border-sidebar-border">
        <div className="flex items-center gap-2.5 px-2 py-3">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-sidebar-primary text-sidebar-primary-foreground font-semibold">
            美
          </div>
          <div className="flex flex-col leading-tight">
            <span className="text-sm font-semibold text-sidebar-foreground">
              诺塔智 · 财务大脑
            </span>
            <span className="text-xs text-muted-foreground">美业多主体财税管理</span>
          </div>
        </div>
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>财税管理</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {navItems.map((item) => {
                const active =
                  item.href === '/'
                    ? pathname === '/'
                    : pathname.startsWith(item.href)
                return (
                  <SidebarMenuItem key={item.href}>
                    <SidebarMenuButton asChild isActive={active}>
                      <Link href={item.href}>
                        <item.icon className="size-4" />
                        <span>{item.title}</span>
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                )
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter className="border-t border-sidebar-border">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <SidebarMenuButton className="h-auto py-2">
              <Avatar className="h-7 w-7">
                <AvatarFallback className="bg-accent text-accent-foreground text-xs">
                  {user.name?.slice(0, 1) || 'U'}
                </AvatarFallback>
              </Avatar>
              <div className="flex flex-col items-start leading-tight overflow-hidden">
                <span className="text-sm font-medium truncate max-w-[140px]">
                  {user.name}
                </span>
                <span className="text-xs text-muted-foreground truncate max-w-[140px]">
                  {user.email}
                </span>
              </div>
            </SidebarMenuButton>
          </DropdownMenuTrigger>
          <DropdownMenuContent side="top" align="start" className="w-56">
            <DropdownMenuLabel>我的账户</DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={handleSignOut}>
              <LogOut className="size-4" />
              退出登录
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </SidebarFooter>
    </Sidebar>
  )
}
