import { headers } from 'next/headers'
import { redirect } from 'next/navigation'
import { getScope } from '@/lib/scope'
import { getAgentApiKey } from '@/app/actions/org'
import { getBrandProfile } from '@/app/actions/org-profile'
import { getSaasSettings, getChannelHealth } from '@/app/actions/saas'
import { listFinanceStaff } from '@/app/actions/finance-staff'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { BrandProfileForm } from '@/components/brand-profile-form'
import { SyncHealthPanel } from '@/components/sync-health-panel'
import { SaasIntegrationManager } from '@/components/saas-integration-manager'
import { SecureApiSection } from '@/components/secure-api-section'
import { AgentApiDocs } from '@/components/agent-api-docs'
import { FinanceStaffManager } from '@/components/finance-staff-manager'

export default async function SettingsPage() {
  const scope = await getScope()
  // 仅"真正的集团管理员"可进入设置(财务子账号不可管理品牌/密钥/团队)
  if (!scope.isAdmin) redirect('/')

  const [apiKey, brand, saas, health, staff] = await Promise.all([
    getAgentApiKey(),
    getBrandProfile(),
    getSaasSettings(),
    getChannelHealth(),
    listFinanceStaff(),
  ])

  const h = await headers()
  const host = h.get('x-forwarded-host') ?? h.get('host') ?? 'localhost:3000'
  const proto = h.get('x-forwarded-proto') ?? 'https'
  const baseUrl = `${proto}://${host}`

  return (
    <div className="mx-auto max-w-3xl space-y-6 p-4 md:p-6">
      <header>
        <h1 className="text-xl font-semibold text-foreground">设置</h1>
        <p className="text-sm text-muted-foreground">
          管理品牌信息、门店数据同步与 API 密钥安全
        </p>
      </header>

      <Tabs defaultValue="brand" className="w-full">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="brand">品牌信息</TabsTrigger>
          <TabsTrigger value="sync">数据同步</TabsTrigger>
          <TabsTrigger value="team">财务团队</TabsTrigger>
          <TabsTrigger value="api">API 密钥</TabsTrigger>
        </TabsList>

        <TabsContent value="brand" className="mt-4">
          <BrandProfileForm initial={brand} />
        </TabsContent>

        <TabsContent value="sync" className="mt-4 space-y-6">
          <SyncHealthPanel
            health={health}
            initialEnabled={brand.autoSyncEnabled}
            initialInterval={brand.autoSyncIntervalMin}
            initialPrimary={brand.primaryChannel === 'auto' ? 'auto' : 'agent'}
          />
          <SaasIntegrationManager initial={saas} />
        </TabsContent>

        <TabsContent value="team" className="mt-4">
          <FinanceStaffManager staff={staff} />
        </TabsContent>

        <TabsContent value="api" className="mt-4 space-y-6">
          <SecureApiSection
            initialKey={apiKey}
            baseUrl={baseUrl}
            hasPin={brand.hasPin}
          />
          <AgentApiDocs />
        </TabsContent>
      </Tabs>
    </div>
  )
}
