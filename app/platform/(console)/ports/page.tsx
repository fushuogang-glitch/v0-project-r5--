import { getPortMonitor } from '@/app/actions/platform'
import { PortTable } from '@/components/platform/port-table'

export const dynamic = 'force-dynamic'
export const metadata = { title: '端口监控 · 运营中控台' }

export default async function PortsPage() {
  const rows = await getPortMonitor()
  return (
    <div className="space-y-6 p-6">
      <header>
        <h1 className="text-xl font-semibold text-neutral-100">端口监控</h1>
        <p className="mt-1 text-sm text-neutral-500">各客户 SaaS 接口对接状态与数据同步心跳,及时发现断连与停滞</p>
      </header>
      <PortTable rows={rows} />
    </div>
  )
}
