import { getPlatformAlerts } from '@/app/actions/platform'
import { AlertsBoard } from '@/components/platform/alerts-board'

export const dynamic = 'force-dynamic'
export const metadata = { title: '使用预警 · 运营中控台' }

export default async function AlertsPage() {
  const alerts = await getPlatformAlerts('open')
  return (
    <div className="space-y-6 p-6">
      <header>
        <h1 className="text-xl font-semibold text-neutral-100">使用预警</h1>
        <p className="mt-1 text-sm text-neutral-500">
          跨客户的运营预警:税务风险超期、订阅到期、实例离线、数据断流等,可逐项处理
        </p>
      </header>
      <AlertsBoard alerts={alerts} />
    </div>
  )
}
