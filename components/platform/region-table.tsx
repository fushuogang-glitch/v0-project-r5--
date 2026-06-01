'use client'

import Link from 'next/link'
import { ChevronRight } from 'lucide-react'
import type { ProvinceStat } from '@/app/actions/platform'

function fmtMoney(n: number) {
  if (n >= 10000) return `¥${(n / 10000).toFixed(1)}万`
  return `¥${n.toFixed(0)}`
}

export function RegionTable({ stats }: { stats: ProvinceStat[] }) {
  const sorted = [...stats].sort((a, b) => b.tenants - a.tenants)
  return (
    <div className="overflow-hidden rounded-xl border border-neutral-800 bg-neutral-900/40">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-neutral-800 bg-neutral-900/60 text-left text-xs text-neutral-500">
            <th className="px-4 py-2.5 font-medium">地区</th>
            <th className="px-4 py-2.5 text-right font-medium">客户数</th>
            <th className="px-4 py-2.5 text-right font-medium">活跃</th>
            <th className="px-4 py-2.5 text-right font-medium">风险</th>
            <th className="hidden px-4 py-2.5 text-right font-medium sm:table-cell">即将到期</th>
            <th className="hidden px-4 py-2.5 text-right font-medium md:table-cell">近30天收入</th>
            <th className="px-4 py-2.5 text-right font-medium">健康分</th>
            <th className="w-8 px-2 py-2.5" />
          </tr>
        </thead>
        <tbody className="divide-y divide-neutral-800/70">
          {sorted.map((s) => (
            <tr key={s.province} className="transition-colors hover:bg-neutral-800/40">
              <td className="px-4 py-3">
                <Link
                  href={`/platform/tenants?province=${encodeURIComponent(s.province)}`}
                  className="font-medium text-neutral-100 hover:text-amber-300"
                >
                  {s.province}
                </Link>
              </td>
              <td className="px-4 py-3 text-right tabular-nums text-neutral-200">{s.tenants}</td>
              <td className="px-4 py-3 text-right tabular-nums text-emerald-300">{s.active}</td>
              <td className="px-4 py-3 text-right tabular-nums">
                {s.risk > 0 ? <span className="text-red-300">{s.risk}</span> : <span className="text-neutral-600">0</span>}
              </td>
              <td className="hidden px-4 py-3 text-right tabular-nums sm:table-cell">
                {s.expiringSoon > 0 ? <span className="text-amber-300">{s.expiringSoon}</span> : <span className="text-neutral-600">0</span>}
              </td>
              <td className="hidden px-4 py-3 text-right tabular-nums text-neutral-300 md:table-cell">{fmtMoney(s.revenue30d)}</td>
              <td className="px-4 py-3 text-right tabular-nums text-neutral-200">{s.avgHealthScore}</td>
              <td className="px-2 py-3 text-right">
                <Link href={`/platform/tenants?province=${encodeURIComponent(s.province)}`}>
                  <ChevronRight className="size-4 text-neutral-600" aria-hidden />
                </Link>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
