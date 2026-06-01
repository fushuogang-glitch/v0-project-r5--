'use client'

import { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { ComposableMap, Geographies, Geography } from 'react-simple-maps'
import type { ProvinceStat } from '@/app/actions/platform'

const GEO_URL = '/geo/china-provinces.json'

// 热力色阶(琥珀色系,与中控台主题一致):值越高越亮
function heatColor(value: number, max: number): string {
  if (value <= 0) return '#33333a' // 无客户:可见的中性陆地色
  const t = Math.min(1, value / Math.max(1, max))
  // 从深棕到亮琥珀插值
  const stops = ['#3a2f12', '#6b521a', '#a87d1f', '#d99a2b', '#f5b73d']
  const idx = Math.min(stops.length - 1, Math.floor(t * (stops.length - 1)))
  return stops[idx]
}

type Metric = 'tenants' | 'risk' | 'expiringSoon'

const METRIC_LABEL: Record<Metric, string> = {
  tenants: '客户数',
  risk: '风险实例',
  expiringSoon: '即将到期',
}

export function ChinaMap({ stats }: { stats: ProvinceStat[] }) {
  const router = useRouter()
  const [metric, setMetric] = useState<Metric>('tenants')
  const [hover, setHover] = useState<{ name: string; stat?: ProvinceStat; x: number; y: number } | null>(null)

  const byName = useMemo(() => {
    const m = new Map<string, ProvinceStat>()
    for (const s of stats) m.set(s.province, s)
    return m
  }, [stats])

  const max = useMemo(
    () => Math.max(1, ...stats.map((s) => s[metric] as number)),
    [stats, metric],
  )

  return (
    <div className="relative rounded-xl border border-neutral-800 bg-neutral-900 p-4">
      <div className="mb-3 flex items-center justify-between">
        <div>
          <h2 className="text-sm font-semibold text-neutral-100">客户地区分布</h2>
          <p className="text-[11px] text-neutral-500">按省份热力 · 点击省份查看该地区客户</p>
        </div>
        <div className="flex gap-1 rounded-lg bg-neutral-800 p-0.5">
          {(Object.keys(METRIC_LABEL) as Metric[]).map((m) => (
            <button
              key={m}
              onClick={() => setMetric(m)}
              className={
                'rounded-md px-2.5 py-1 text-[11px] transition-colors ' +
                (metric === m
                  ? 'bg-amber-400 font-medium text-neutral-950'
                  : 'text-neutral-400 hover:text-neutral-200')
              }
            >
              {METRIC_LABEL[m]}
            </button>
          ))}
        </div>
      </div>

      <div className="relative w-full" style={{ aspectRatio: '4 / 3' }}>
        <ComposableMap
          projection="geoMercator"
          projectionConfig={{ scale: 560, center: [104, 36] }}
          width={640}
          height={480}
          style={{ width: '100%', height: '100%' }}
        >
          <Geographies geography={GEO_URL}>
            {({ geographies }) =>
              geographies.map((geo) => {
                const name: string = geo.properties.name
                const stat = byName.get(name)
                const value = stat ? (stat[metric] as number) : 0
                return (
                  <Geography
                    key={geo.rsmKey}
                    geography={geo}
                    onMouseEnter={(e) =>
                      setHover({ name, stat, x: e.clientX, y: e.clientY })
                    }
                    onMouseMove={(e) =>
                      setHover((h) => (h ? { ...h, x: e.clientX, y: e.clientY } : h))
                    }
                    onMouseLeave={() => setHover(null)}
                    onClick={() => {
                      if (stat && stat.tenants > 0)
                        router.push(`/platform/tenants?province=${encodeURIComponent(name)}`)
                    }}
                    style={{
                      default: {
                        fill: heatColor(value, max),
                        stroke: '#0a0a0a',
                        strokeWidth: 0.6,
                        outline: 'none',
                      },
                      hover: {
                        fill: value > 0 ? '#fbbf24' : '#52525b',
                        stroke: '#0a0a0a',
                        strokeWidth: 0.8,
                        outline: 'none',
                        cursor: value > 0 ? 'pointer' : 'default',
                      },
                      pressed: { fill: '#f59e0b', outline: 'none' },
                    }}
                  />
                )
              })
            }
          </Geographies>
        </ComposableMap>

        {hover && (
          <div
            className="pointer-events-none fixed z-50 rounded-lg border border-neutral-700 bg-neutral-950/95 px-3 py-2 text-xs shadow-xl"
            style={{ left: hover.x + 12, top: hover.y + 12 }}
          >
            <p className="font-semibold text-neutral-100">{hover.name}</p>
            {hover.stat && hover.stat.tenants > 0 ? (
              <div className="mt-1 space-y-0.5 text-neutral-400">
                <p>客户数:<span className="text-neutral-100">{hover.stat.tenants}</span></p>
                <p>活跃:<span className="text-emerald-400">{hover.stat.active}</span> · 风险:<span className="text-red-400">{hover.stat.risk}</span></p>
                <p>即将到期:<span className="text-amber-400">{hover.stat.expiringSoon}</span></p>
                <p>近30天收入:<span className="text-neutral-100">¥{hover.stat.revenue30d.toLocaleString('zh-CN')}</span></p>
              </div>
            ) : (
              <p className="mt-1 text-neutral-500">暂无客户</p>
            )}
          </div>
        )}
      </div>

      {/* 图例 */}
      <div className="mt-3 flex items-center gap-2 text-[11px] text-neutral-500">
        <span>少</span>
        <div className="flex h-2 flex-1 overflow-hidden rounded-full">
          {['#1f1f23', '#3a2f12', '#6b521a', '#a87d1f', '#d99a2b', '#f5b73d'].map((c) => (
            <div key={c} className="flex-1" style={{ backgroundColor: c }} />
          ))}
        </div>
        <span>多</span>
      </div>
    </div>
  )
}
