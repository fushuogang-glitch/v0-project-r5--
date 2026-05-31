import { headers } from 'next/headers'
import { redirect } from 'next/navigation'
import { getScope } from '@/lib/scope'
import { getAgentApiKey } from '@/app/actions/org'
import { AgentApiManager } from '@/components/agent-api-manager'
import { AgentApiDocs } from '@/components/agent-api-docs'

export default async function SettingsPage() {
  const scope = await getScope()
  if (scope.role !== 'group') redirect('/')

  const apiKey = await getAgentApiKey()
  const h = await headers()
  const host = h.get('x-forwarded-host') ?? h.get('host') ?? 'localhost:3000'
  const proto = h.get('x-forwarded-proto') ?? 'https'
  const baseUrl = `${proto}://${host}`

  return (
    <div className="mx-auto max-w-3xl space-y-6 p-4 md:p-6">
      <header>
        <h1 className="text-xl font-semibold text-foreground">设置</h1>
        <p className="text-sm text-muted-foreground">
          管理财务 Agent API 接入,供公司侧 Agent 抓取门店数据
        </p>
      </header>

      <AgentApiManager initialKey={apiKey} baseUrl={baseUrl} />
      <AgentApiDocs />
    </div>
  )
}
