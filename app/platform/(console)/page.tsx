import {
  getPlatformOverview,
  getProvinceStats,
  getDailySummary,
  getPlatformAlerts,
} from '@/app/actions/platform'
import { KpiBand } from '@/components/platform/kpi-band'
import { DailySummaryStrip } from '@/components/platform/daily-summary'
import { ChinaMap } from '@/components/platform/china-map'
import { AlertFeed } from '@/components/platform/alert-feed'
import { ExpiryPanel } from '@/components/platform/expiry-panel'
import Link from 'next/link'

export const dynamic = 'force-dynamic'

export default async function PlatformDashboardPage() {
  const [overview, provinceStats, summary, alerts] = await Promise.all([
    getPlatformOverview(),
    getProvinceStats(),
    getDailySummary(),
    getPlatformAlerts('open'),
  ])

  return (
    <div className="flex flex-col gap-5 p-6">
      <header>
        <h1 className="text-xl font-semibold text-neutral-50">运营中控台</h1>
        <p className="mt-1 text-sm text-neutral-400">
          实时监控全部软件实例的运行健康、地区分布与使用预警
        </p>
      </header>

      <KpiBand overview={overview} />
      <DailySummaryStrip summary={summary} />

      <div className="grid gap-5 lg:grid-cols-[1.6fr_1fr]">
        <ChinaMap stats={provinceStats} />

        <div className="flex flex-col gap-5">
          <ExpiryPanel overview={overview} />

          <div className="rounded-xl border border-neutral-800 bg-neutral-900 p-4">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-sm font-semibold text-neutral-100">实时预警流</h2>
              <Link
                href="/platform/alerts"
                className="text-[11px] text-amber-400 hover:text-amber-300"
              >
                查看全部 →
              </Link>
            </div>
            <AlertFeed alerts={alerts.slice(0, 6)} compact />
          </div>
        </div>
      </div>
    </div>
  )
}
