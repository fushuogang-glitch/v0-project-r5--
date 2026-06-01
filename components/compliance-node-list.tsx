'use client'

import { useState, useTransition } from 'react'
import {
  CheckCircle2,
  Clock,
  AlertTriangle,
  XCircle,
  CalendarClock,
  RotateCcw,
} from 'lucide-react'
import { setComplianceStatus, type ComplianceItem } from '@/app/actions/compliance'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'

const LEVEL_STYLE: Record<
  ComplianceItem['level'],
  { dot: string; icon: typeof AlertTriangle }
> = {
  danger: { dot: 'bg-destructive', icon: XCircle },
  warning: { dot: 'bg-amber-500', icon: AlertTriangle },
  info: { dot: 'bg-primary', icon: CalendarClock },
}

function StatusBadge({ item }: { item: ComplianceItem }) {
  if (item.status === 'filed')
    return (
      <Badge variant="outline" className="gap-1 border-emerald-200 bg-emerald-50 text-emerald-700">
        <CheckCircle2 className="size-3" />
        已申报
      </Badge>
    )
  if (item.status === 'dismissed')
    return (
      <Badge variant="outline" className="gap-1 text-muted-foreground">
        已忽略
      </Badge>
    )
  if (item.status === 'overdue')
    return (
      <Badge variant="outline" className="gap-1 border-destructive/30 bg-red-50 text-destructive">
        <AlertTriangle className="size-3" />
        已逾期
      </Badge>
    )
  // pending
  if (item.daysLeft != null)
    return (
      <Badge
        variant="outline"
        className={
          item.daysLeft <= 7
            ? 'gap-1 border-amber-200 bg-amber-50 text-amber-700'
            : 'gap-1 text-muted-foreground'
        }
      >
        <Clock className="size-3" />
        {item.daysLeft === 0 ? '今日截止' : `剩 ${item.daysLeft} 天`}
      </Badge>
    )
  return (
    <Badge variant="outline" className="gap-1 text-muted-foreground">
      <Clock className="size-3" />
      待办
    </Badge>
  )
}

export function ComplianceNodeList({ items }: { items: ComplianceItem[] }) {
  const [list, setList] = useState(items)
  const [pendingId, setPendingId] = useState<number | null>(null)
  const [, startTransition] = useTransition()

  const act = (id: number, status: 'filed' | 'dismissed' | 'pending') => {
    setPendingId(id)
    startTransition(async () => {
      await setComplianceStatus(id, status)
      setList((prev) =>
        prev.map((x) =>
          x.id === id
            ? { ...x, status: status === 'pending' && x.daysLeft != null && x.daysLeft < 0 ? 'overdue' : status }
            : x,
        ),
      )
      setPendingId(null)
    })
  }

  if (list.length === 0) {
    return (
      <div className="rounded-lg border border-border py-16 text-center text-sm text-muted-foreground">
        暂无合规节点,点击右上角「刷新合规节点」生成本期提醒
      </div>
    )
  }

  return (
    <ul className="space-y-3">
      {list.map((item) => {
        const style = LEVEL_STYLE[item.level]
        const Icon = style.icon
        const muted = item.status === 'filed' || item.status === 'dismissed'
        return (
          <li
            key={item.id}
            className={`flex flex-col gap-3 rounded-lg border border-border p-4 sm:flex-row sm:items-center sm:justify-between ${
              muted ? 'opacity-60' : ''
            }`}
          >
            <div className="flex items-start gap-3">
              <span className={`mt-1 flex size-7 shrink-0 items-center justify-center rounded-full ${style.dot}/10`}>
                <Icon className={`size-4 ${item.level === 'danger' ? 'text-destructive' : item.level === 'warning' ? 'text-amber-600' : 'text-primary'}`} />
              </span>
              <div className="space-y-1">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="text-sm font-medium text-foreground">{item.title}</p>
                  <StatusBadge item={item} />
                </div>
                {item.detail && <p className="text-xs leading-relaxed text-muted-foreground">{item.detail}</p>}
                {item.dueDate && (
                  <p className="text-xs text-muted-foreground">
                    法定截止日:{item.dueDate}
                  </p>
                )}
              </div>
            </div>
            <div className="flex shrink-0 gap-2 sm:flex-col sm:items-end lg:flex-row">
              {item.status === 'pending' || item.status === 'overdue' ? (
                <>
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={pendingId === item.id}
                    onClick={() => act(item.id, 'filed')}
                    className="gap-1"
                  >
                    <CheckCircle2 className="size-3.5" />
                    标记已申报
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    disabled={pendingId === item.id}
                    onClick={() => act(item.id, 'dismissed')}
                    className="gap-1 text-muted-foreground"
                  >
                    忽略
                  </Button>
                </>
              ) : (
                <Button
                  size="sm"
                  variant="ghost"
                  disabled={pendingId === item.id}
                  onClick={() => act(item.id, 'pending')}
                  className="gap-1 text-muted-foreground"
                >
                  <RotateCcw className="size-3.5" />
                  恢复待办
                </Button>
              )}
            </div>
          </li>
        )
      })}
    </ul>
  )
}
