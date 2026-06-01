'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import type { PlatformAlertRow } from '@/app/actions/platform'
import { resolvePlatformAlert } from '@/app/actions/platform'
import { AlertTriangle, Check, ChevronRight } from 'lucide-react'
import { cn } from '@/lib/utils'

const LEVEL_STYLE: Record<string, string> = {
  risk: 'border-l-red-500 bg-red-500/5',
  warn: 'border-l-amber-500 bg-amber-500/5',
  info: 'border-l-sky-500 bg-sky-500/5',
}
const LEVEL_DOT: Record<string, string> = {
  risk: 'bg-red-500',
  warn: 'bg-amber-500',
  info: 'bg-sky-500',
}
const DIM_LABEL: Record<string, string> = {
  offline: '离线',
  data: '数据断流',
  sync: '同步',
  audit: '审计',
  tax: '税务',
  billing: '订阅',
  churn: '流失',
}

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime()
  const h = Math.floor(diff / 3600000)
  if (h < 1) return '刚刚'
  if (h < 24) return `${h} 小时前`
  return `${Math.floor(h / 24)} 天前`
}

export function AlertFeed({
  alerts,
  compact = false,
}: {
  alerts: PlatformAlertRow[]
  compact?: boolean
}) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [resolvingId, setResolvingId] = useState<number | null>(null)

  const resolve = (id: number) => {
    setResolvingId(id)
    startTransition(async () => {
      await resolvePlatformAlert(id)
      setResolvingId(null)
      router.refresh()
    })
  }

  if (alerts.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-neutral-800 py-12 text-center">
        <Check className="size-6 text-emerald-400" />
        <p className="text-sm text-neutral-400">暂无未处理预警,所有实例运行正常</p>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-2">
      {alerts.map((a) => (
        <div
          key={a.id}
          className={cn(
            'flex items-start gap-3 rounded-lg border border-neutral-800 border-l-2 p-3',
            LEVEL_STYLE[a.level] ?? LEVEL_STYLE.info,
          )}
        >
          <span className={cn('mt-1.5 size-2 shrink-0 rounded-full', LEVEL_DOT[a.level] ?? LEVEL_DOT.info)} />
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <span className="rounded bg-neutral-800 px-1.5 py-0.5 text-[10px] text-neutral-400">
                {DIM_LABEL[a.dimension] ?? a.dimension}
              </span>
              <p className="truncate text-sm font-medium text-neutral-100">{a.title}</p>
            </div>
            <p className="mt-0.5 truncate text-xs text-neutral-400">
              <button
                onClick={() => router.push(`/platform/tenants/${a.tenantId}`)}
                className="text-neutral-300 underline-offset-2 hover:underline"
              >
                {a.tenantName}
              </button>
              {a.detail ? <span className="text-neutral-500"> · {a.detail}</span> : null}
            </p>
            {!compact && (
              <p className="mt-1 text-[11px] text-neutral-600">
                首次出现 {timeAgo(a.firstSeenAt)}
              </p>
            )}
          </div>
          <div className="flex shrink-0 items-center gap-1">
            <button
              onClick={() => resolve(a.id)}
              disabled={pending && resolvingId === a.id}
              className="rounded-md border border-neutral-700 px-2 py-1 text-[11px] text-neutral-300 transition-colors hover:border-emerald-500/50 hover:text-emerald-400 disabled:opacity-50"
            >
              {pending && resolvingId === a.id ? '处理中' : '标记处理'}
            </button>
            <button
              onClick={() => router.push(`/platform/tenants/${a.tenantId}`)}
              className="rounded-md p-1 text-neutral-500 hover:text-neutral-200"
              aria-label="查看实例"
            >
              <ChevronRight className="size-4" />
            </button>
          </div>
        </div>
      ))}
    </div>
  )
}

export { AlertTriangle }
