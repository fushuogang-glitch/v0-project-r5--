'use client'

import { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { ComposableMap, Geographies, Geography, Marker } from 'react-simple-maps'
import type { ProvinceStat } from '@/app/actions/platform'
import { toEnglishProvince } from '@/lib/province-i18n'

const GEO_URL = '/geo/china-provinces.json'

// 五个运营维度
type Metric = 'active' | 'expiringSoon' | 'risk' | 'revenue30d' | 'tenants'

const METRICS: { key: Metric; label: string; dot: string; legend: string[] }[] = [
  { key: 'active', label: '使用中', dot: '#34d399', legend: ['#10261d', '#15422f', '#1f6e4a', '#2fa56a', '#34d399'] },
  { key: 'expiringSoon', label: '即将到期', dot: '#fbbf24', legend: ['#3a2f12', '#6b521a', '#a87d1f', '#d99a2b', '#fbbf24'] },
  { key: 'risk', label: '故障', dot: '#f87171', legend: ['#2a1212', '#5a1d1d', '#8f2a2a', '#c43a3a', '#f87171'] },
  { key: 'revenue30d', label: '营收', dot: '#f5b73d', legend: ['#1f1f23', '#3a2f12', '#6b521a', '#a87d1f', '#f5b73d'] },
  { key: 'tenants', label: '客户数', dot: '#60a5fa', legend: ['#10203a', '#163052', '#1f4a85', '#2f6ec4', '#60a5fa'] },
]

// 热力色阶:按当前维度的 5 段插值
function heatColor(value: number, max: number, legend: string[]): string {
  if (value <= 0) return '#33333a'
  const t = Math.min(1, value / Math.max(1, max))
  const idx = Math.min(legend.length - 1, Math.floor(t * (legend.length - 1)))
  return legend[idx]
}

export function ChinaMap({ stats }: { stats: ProvinceStat[] }) {
  const router = useRouter()
  const [metric, setMetric] = useState<Metric>('active')
  const [hover, setHover] = useState<{ name: string; stat?: ProvinceStat; x: number; y: number } | null>(null)

  const conf = METRICS.find((m) => m.key === metric)!

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
      <div className="mb-3 flex items-center justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold text-neutral-100">客户地区分布</h2>
          <p className="text-[11px] text-neutral-500">按省份热力 · 脉冲点为活跃地区 · 点击下钻</p>
        </div>
        <div className="flex flex-wrap gap-1 rounded-lg bg-neutral-800 p-0.5">
          {METRICS.map((m) => (
            <button
              key={m.key}
              onClick={() => setMetric(m.key)}
              className={
                'rounded-md px-2.5 py-1 text-[11px] transition-colors ' +
                (metric === m.key
                  ? 'bg-amber-400 font-medium text-neutral-950'
                  : 'text-neutral-400 hover:text-neutral-200')
              }
            >
              {m.label}
            </button>
          ))}
        </div>
      </div>

      <div className="relative w-full" style={{ aspectRatio: '4 / 3' }}>
        <ComposableMap
          projection="geoMercator"
          projectionConfig={{ scale: 430, center: [104, 37.5] }}
          width={640}
          height={480}
          style={{ width: '100%', height: '100%' }}
        >
          <Geographies geography={GEO_URL}>
            {({ geographies }) => (
              <>
                {geographies.map((geo) => {
                  const name: string = geo.properties.name
                  const stat = byName.get(name)
                  const value = stat ? (stat[metric] as number) : 0
                  return (
                    <Geography
                      key={geo.rsmKey}
                      geography={geo}
                      onMouseEnter={(e) => setHover({ name, stat, x: e.clientX, y: e.clientY })}
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
                          fill: heatColor(value, max, conf.legend),
                          stroke: '#0a0a0a',
                          strokeWidth: 0.6,
                          outline: 'none',
                        },
                        hover: {
                          fill: value > 0 ? conf.dot : '#52525b',
                          stroke: '#0a0a0a',
                          strokeWidth: 0.8,
                          outline: 'none',
                          cursor: value > 0 ? 'pointer' : 'default',
                        },
                        pressed: { fill: conf.dot, outline: 'none' },
                      }}
                    />
                  )
                })}

                {/* 脉冲发光点:当前维度有值的省份,半径随数值大小变化 */}
                {geographies.map((geo) => {
                  const name: string = geo.properties.name
                  const stat = byName.get(name)
                  const value = stat ? (stat[metric] as number) : 0
                  if (value <= 0) return null
                  const center = geo.properties.center as [number, number] | undefined
                  if (!center) return null
                  const t = Math.min(1, value / max)
                  const r = 2.5 + t * 4 // 核心点半径 2.5~6.5
                  return (
                    <Marker key={`pulse-${geo.rsmKey}`} coordinates={center}>
                      {/* 外层涟漪 */}
                      <circle r={r} fill={conf.dot} opacity={0.6}>
                        <animate
                          attributeName="r"
                          from={r}
                          to={r * 3.2}
                          dur="2s"
                          begin="0s"
                          repeatCount="indefinite"
                        />
                        <animate
                          attributeName="opacity"
                          from={0.6}
                          to={0}
                          dur="2s"
                          begin="0s"
                          repeatCount="indefinite"
                        />
                      </circle>
                      {/* 核心点 + 发光 */}
                      <circle
                        r={r}
                        fill={conf.dot}
                        style={{ filter: `drop-shadow(0 0 ${2 + t * 4}px ${conf.dot})` }}
                      />
                    </Marker>
                  )
                })}
              </>
            )}
          </Geographies>
        </ComposableMap>

        {hover && (
          <div
            className="pointer-events-none fixed z-50 rounded-lg border border-neutral-700 bg-neutral-950/95 px-3 py-2 text-xs shadow-xl"
            style={{ left: hover.x + 12, top: hover.y + 12 }}
          >
            <p className="font-semibold text-neutral-100">
              {hover.name}
              <span className="ml-1.5 font-normal text-neutral-500">{toEnglishProvince(hover.name)}</span>
            </p>
            {hover.stat && hover.stat.tenants > 0 ? (
              <div className="mt-1 space-y-0.5 text-neutral-400">
                <p>客户数:<span className="text-neutral-100">{hover.stat.tenants}</span></p>
                <p>
                  使用中:<span className="text-emerald-400">{hover.stat.active}</span> · 故障:
                  <span className="text-red-400">{hover.stat.risk}</span>
                </p>
                <p>即将到期:<span className="text-amber-400">{hover.stat.expiringSoon}</span></p>
                <p>近30天营收:<span className="text-neutral-100">¥{hover.stat.revenue30d.toLocaleString('zh-CN')}</span></p>
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
          {['#33333a', ...conf.legend].map((c) => (
            <div key={c} className="flex-1" style={{ backgroundColor: c }} />
          ))}
        </div>
        <span>多</span>
        <span className="ml-2 flex items-center gap-1">
          <span className="inline-block size-2 rounded-full" style={{ backgroundColor: conf.dot }} />
          {conf.label}脉冲
        </span>
      </div>
    </div>
  )
}
