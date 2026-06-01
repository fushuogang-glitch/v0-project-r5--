import Link from 'next/link'
import { AlertTriangle, BellRing, ChevronRight } from 'lucide-react'
import { getComplianceSummary } from '@/app/actions/compliance'

export async function ComplianceBanner() {
  let summary = { pending: 0, overdue: 0, urgent: 0 }
  try {
    summary = await getComplianceSummary()
  } catch {
    return null
  }

  // 无待办时不显示通知栏
  if (summary.pending === 0) return null

  const isRed = summary.urgent > 0 || summary.overdue > 0
  const Icon = isRed ? AlertTriangle : BellRing

  const parts: string[] = [`您有 ${summary.pending} 项合规事项待处理`]
  if (summary.overdue > 0) parts.push(`其中 ${summary.overdue} 项已逾期`)
  else if (summary.urgent > 0) parts.push(`其中 ${summary.urgent} 项 7 日内到期`)

  return (
    <Link
      href="/compliance"
      className={`group flex items-center gap-2.5 px-4 py-2.5 text-sm transition-colors md:px-6 ${
        isRed
          ? 'bg-destructive/10 text-destructive hover:bg-destructive/15'
          : 'bg-accent text-accent-foreground hover:bg-accent/80'
      }`}
    >
      <Icon className="size-4 shrink-0" />
      <span className="font-medium">{parts.join(',')}</span>
      <span className="ml-auto inline-flex items-center gap-0.5 text-xs opacity-80 group-hover:opacity-100">
        前往处理
        <ChevronRight className="size-3.5" />
      </span>
    </Link>
  )
}
