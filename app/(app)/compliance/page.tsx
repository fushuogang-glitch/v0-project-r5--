import {
  generateComplianceNodes,
  getComplianceNodes,
} from '@/app/actions/compliance'
import { PageHeader } from '@/components/page-header'
import { ComplianceNodeList } from '@/components/compliance-node-list'
import { ComplianceRefreshButton } from '@/components/compliance-refresh-button'
import {
  Card,
  CardContent,
} from '@/components/ui/card'
import { AlertTriangle, Clock, CheckCircle2 } from 'lucide-react'

export const dynamic = 'force-dynamic'

export default async function CompliancePage() {
  // 首次进入自动生成本期合规节点(幂等,不会重复)
  await generateComplianceNodes()
  const items = await getComplianceNodes()

  const overdue = items.filter((i) => i.status === 'overdue')
  const pending = items.filter((i) => i.status === 'pending')
  const urgent = pending.filter(
    (i) => i.level === 'danger' || (i.daysLeft != null && i.daysLeft <= 7),
  )

  return (
    <div className="mx-auto w-full max-w-5xl space-y-6 p-4 md:p-6 lg:p-8">
      <div className="flex items-start justify-between gap-4">
        <PageHeader
          title="合规节点提醒"
          description="自动生成申报截止日、税务临界点等合规待办,确保各主体不漏报、不逾期"
        />
        <div className="pt-1">
          <ComplianceRefreshButton />
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <Card>
          <CardContent className="flex items-center gap-3 p-5">
            <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-red-50 text-destructive">
              <AlertTriangle className="size-5" />
            </span>
            <div>
              <p className="text-sm text-muted-foreground">已逾期</p>
              <p className="text-xl font-semibold tracking-tight">{overdue.length} 项</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-3 p-5">
            <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-amber-50 text-amber-600">
              <Clock className="size-5" />
            </span>
            <div>
              <p className="text-sm text-muted-foreground">7 日内 / 紧急</p>
              <p className="text-xl font-semibold tracking-tight">{urgent.length} 项</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-3 p-5">
            <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-emerald-50 text-emerald-600">
              <CheckCircle2 className="size-5" />
            </span>
            <div>
              <p className="text-sm text-muted-foreground">待办合计</p>
              <p className="text-xl font-semibold tracking-tight">{pending.length + overdue.length} 项</p>
            </div>
          </CardContent>
        </Card>
      </div>

      <ComplianceNodeList items={items} />
    </div>
  )
}
