'use client'

import { useState } from 'react'
import { AlertTriangle, X } from 'lucide-react'

export function RenewBanner({
  daysLeft,
  inGrace,
  endsAt,
}: {
  daysLeft: number | null
  inGrace: boolean
  endsAt: string | null
}) {
  const [dismissed, setDismissed] = useState(false)
  if (dismissed) return null

  // 宽限期内(已过期)用更强的警示色
  const overdue = inGrace || (daysLeft !== null && daysLeft < 0)
  const dateText = endsAt ? new Date(endsAt).toLocaleDateString('zh-CN') : ''

  return (
    <div
      role="alert"
      className={[
        'flex items-center gap-3 border-b px-4 py-2.5 text-sm',
        overdue
          ? 'border-destructive/30 bg-destructive/10 text-destructive'
          : 'border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-400',
      ].join(' ')}
    >
      <AlertTriangle className="size-4 shrink-0" />
      <p className="flex-1 leading-relaxed">
        {overdue ? (
          <>
            您的订阅已于 {dateText} 到期,正处于 <strong>宽限期</strong>。
            为避免服务中断,请尽快联系客户经理续费。
          </>
        ) : (
          <>
            您的订阅将在 <strong>{daysLeft} 天</strong>后({dateText})到期,
            请及时续费以免影响正常使用。
          </>
        )}
      </p>
      <button
        type="button"
        onClick={() => setDismissed(true)}
        className="shrink-0 rounded p-1 opacity-70 transition hover:opacity-100"
        aria-label="关闭提醒"
      >
        <X className="size-4" />
      </button>
    </div>
  )
}
