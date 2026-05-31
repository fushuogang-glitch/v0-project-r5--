import { auth } from '@/lib/auth'
import { headers } from 'next/headers'
import { redirect } from 'next/navigation'
import { ensureSeedData } from '@/app/actions/finance'
import { AppSidebar } from '@/components/app-sidebar'
import { SidebarInset, SidebarProvider, SidebarTrigger } from '@/components/ui/sidebar'

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session?.user) redirect('/sign-in')

  // 首次进入自动生成演示数据(已有数据则跳过)
  await ensureSeedData()

  return (
    <SidebarProvider>
      <AppSidebar user={{ name: session.user.name, email: session.user.email }} />
      <SidebarInset>
        <div className="flex items-center gap-2 border-b border-border bg-background/80 px-4 py-2.5 backdrop-blur sticky top-0 z-10 md:hidden">
          <SidebarTrigger />
          <span className="text-sm font-medium">美业财务 ERP</span>
        </div>
        {children}
      </SidebarInset>
    </SidebarProvider>
  )
}
