import { getAuditReport, autoRunAuditIfDue } from '@/app/actions/audit'
import { PageHeader } from '@/components/page-header'
import { AuditReportView } from '@/components/audit-report'

export const dynamic = 'force-dynamic'

export default async function AuditPage() {
  // 进入审计页时,若本月尚未跑过则自动执行月度审计(幂等)
  await autoRunAuditIfDue()
  const report = await getAuditReport()

  return (
    <div className="mx-auto w-full max-w-5xl space-y-6 p-4 md:p-6 lg:p-8">
      <PageHeader
        title="财务审计"
        description="每月自动稽核各主体的收支、对账、税务、工资分红与收款账户,手工做账数据由系统自动复核,异常即时预警"
      />
      <AuditReportView report={report} />
    </div>
  )
}
