import { auth } from '@/lib/auth'
import { headers } from 'next/headers'
import { redirect } from 'next/navigation'
import { ensureSeedData } from '@/app/actions/finance'
import { getScope, getViewableEntities } from '@/lib/scope'
import { AppSidebar } from '@/components/app-sidebar'
import { ViewSwitcher } from '@/components/view-switcher'
import { SidebarInset, SidebarProvider, SidebarTrigger } from '@/components/ui/sidebar'

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session?.user) redirect('/sign-in')

  // 首次进入自动生成演示数据(集团管理员;门店端会跳过)
  await ensureSeedData()

  const scope = await getScope()
  const viewable = await getViewableEntities(scope)

  return (
    <SidebarProvider>
      <AppSidebar
        user={{ name: session.user.name, email: session.user.email }}
        role={scope.role}
        storeEntityId={scope.role === 'store' ? scope.entityId : null}
      />
      <SidebarInset>
        <header className="sticky top-0 z-10 flex items-center gap-3 border-b border-border bg-background/80 px-4 py-2.5 backdrop-blur">
          <SidebarTrigger className="md:hidden" />
          <ViewSwitcher
            role={scope.role}
            entities={viewable}
            currentEntityId={scope.entityId}
          />
          <div className="ml-auto hidden items-center gap-2 text-xs text-muted-foreground sm:flex">
            <span className="rounded-full bg-accent px-2.5 py-1 font-medium text-accent-foreground">
              {scope.role === 'store' ? '门店端' : '集团端'}
            </span>
          </div>
        </header>
        {children}
      </SidebarInset>
    </SidebarProvider>
  )
}
