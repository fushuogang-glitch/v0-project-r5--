import { headers } from 'next/headers'
import { redirect } from 'next/navigation'
import { getScope } from '@/lib/scope'
import { getAgentApiKey } from '@/app/actions/org'
import { getBrandProfile } from '@/app/actions/org-profile'
import { getSaasSettings, getChannelHealth } from '@/app/actions/saas'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { BrandProfileForm } from '@/components/brand-profile-form'
import { SyncHealthPanel } from '@/components/sync-health-panel'
import { SaasIntegrationManager } from '@/components/saas-integration-manager'
import { SecureApiSection } from '@/components/secure-api-section'
import { AgentApiDocs } from '@/components/agent-api-docs'

export default async function SettingsPage() {
  const scope = await getScope()
  if (scope.role !== 'group') redirect('/')

  const [apiKey, brand, saas, health] = await Promise.all([
    getAgentApiKey(),
    getBrandProfile(),
    getSaasSettings(),
    getChannelHealth(),
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
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="brand">品牌信息</TabsTrigger>
          <TabsTrigger value="sync">数据同步</TabsTrigger>
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
