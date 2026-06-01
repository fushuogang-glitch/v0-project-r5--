import { auth } from '@/lib/auth'
import { headers } from 'next/headers'
import { redirect } from 'next/navigation'
import { ensureSeedData } from '@/app/actions/finance'
import { autoSyncIfDue } from '@/app/actions/saas'
import { generateComplianceNodes, getComplianceBadges } from '@/app/actions/compliance'
import { autoRunAuditIfDue } from '@/app/actions/audit'
import { getScope, getViewableEntities } from '@/lib/scope'
import { AppSidebar } from '@/components/app-sidebar'
import { ViewSwitcher } from '@/components/view-switcher'
import { ComplianceBanner } from '@/components/compliance-banner'
import { SidebarInset, SidebarProvider, SidebarTrigger } from '@/components/ui/sidebar'

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session?.user) redirect('/sign-in')

  // 平台运营方超管不进入客户系统,跳转到独立的运营中台
  if ((session.user as { role?: string }).role === 'platform') redirect('/platform')

  // 首次进入自动生成演示数据(集团管理员;门店端会跳过)
  await ensureSeedData()

  const scope = await getScope()
  const viewable = await getViewableEntities(scope)

  // 双架构:进入系统时若开启自动同步且已到间隔,静默从 SaaS 补齐流水(失败不影响渲染)
  await autoSyncIfDue().catch(() => {})

  // 生成/刷新本期合规节点(幂等),并取栏目角标
  await generateComplianceNodes().catch(() => {})
  const { byRoute } = await getComplianceBadges()

  // 进入系统时若本月尚未审计则自动跑一次月度审计(幂等,失败不影响渲染)
  await autoRunAuditIfDue().catch(() => {})

  return (
    <SidebarProvider>
      <AppSidebar
        user={{ name: session.user.name, email: session.user.email }}
        role={scope.role}
        storeEntityId={scope.role === 'store' ? scope.entityId : null}
        badges={byRoute}
        financeRole={scope.financeRole}
        isAdmin={scope.isAdmin}
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
        <ComplianceBanner />
        {children}
      </SidebarInset>
    </SidebarProvider>
  )
}
