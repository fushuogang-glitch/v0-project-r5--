import Link from 'next/link'
import { Bell } from 'lucide-react'
import { getComplianceSummary } from '@/app/actions/compliance'

export async function ComplianceBell() {
  let summary = { pending: 0, overdue: 0, urgent: 0 }
  try {
    summary = await getComplianceSummary()
  } catch {
    // 未配置或无数据时静默
  }
  const count = summary.pending
  const hasUrgent = summary.urgent > 0 || summary.overdue > 0

  return (
    <Link
      href="/compliance"
      aria-label={`合规待办 ${count} 项`}
      className="relative inline-flex size-9 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground"
    >
      <Bell className="size-[18px]" />
      {count > 0 && (
        <span
          className={`absolute -right-0.5 -top-0.5 flex min-w-4 items-center justify-center rounded-full px-1 text-[10px] font-semibold leading-4 text-white ${
            hasUrgent ? 'bg-destructive' : 'bg-primary'
          }`}
        >
          {count > 99 ? '99+' : count}
        </span>
      )}
    </Link>
  )
}
