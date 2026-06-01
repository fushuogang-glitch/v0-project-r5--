import { getScope, getViewableEntities } from '@/lib/scope'
import { buildTaxFilingPackage } from '@/lib/tax-filing'
import { PageHeader } from '@/components/page-header'
import { TaxFilingSelector } from '@/components/tax-filing-selector'
import { ReportSheetsView } from '@/components/report-sheets-view'
import { FileText, AlertCircle } from 'lucide-react'

export const dynamic = 'force-dynamic'

export default async function TaxFilingPage({
  searchParams,
}: {
  searchParams: Promise<{ entity?: string; year?: string; quarter?: string }>
}) {
  const sp = await searchParams
  const scope = await getScope()
  const viewable = await getViewableEntities(scope)

  const now = new Date()
  const year = sp.year ? Number(sp.year) : now.getFullYear()
  const quarter = sp.quarter ? Number(sp.quarter) : Math.floor(now.getMonth() / 3) + 1

  // 默认主体:门店端取自身,集团端取第一个
  let entityId: number | null = sp.entity ? Number(sp.entity) : null
  if (entityId == null) {
    if (scope.role === 'store' && scope.entityId != null) entityId = scope.entityId
    else if (viewable.length > 0) entityId = viewable[0].id
  }

  const entityOpts = viewable.map((e) => ({ id: e.id, name: e.name }))

  let pkg = null
  let error: string | null = null
  if (entityId != null) {
    try {
      pkg = await buildTaxFilingPackage(entityId, { year, quarter })
    } catch (e) {
      error = e instanceof Error ? e.message : '生成申报表失败'
    }
  }

  return (
    <div className="mx-auto w-full max-w-6xl space-y-6 p-4 md:p-6 lg:p-8">
      <PageHeader
        title="税务申报表"
        description="按主体与申报期间自动生成增值税、所得税预缴及财务报送数据"
      />

      <TaxFilingSelector
        entities={entityOpts}
        entityId={entityId}
        year={year}
        quarter={quarter}
      />

      <div className="flex items-start gap-2 rounded-md border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
        <AlertCircle className="mt-0.5 size-4 shrink-0" />
        <p>
          以下为依据系统记账流水自动测算的申报预填数据,适用税率与减免口径已按主体类型自动套用。正式申报金额以税务机关电子税务局口径为准。
        </p>
      </div>

      {pkg && (
        <>
          <div className="rounded-lg border border-border bg-muted/30 px-4 py-3 text-sm">
            <span className="font-medium text-foreground">{pkg.scopeLabel}</span>
            <span className="ml-3 text-xs text-muted-foreground">生成时间 {pkg.generatedAt}</span>
          </div>
          <ReportSheetsView pkg={pkg} />
        </>
      )}

      {error && (
        <div className="flex flex-col items-center gap-2 rounded-lg border border-border bg-card py-16 text-center">
          <FileText className="size-8 text-muted-foreground" />
          <p className="text-sm text-muted-foreground">{error}</p>
        </div>
      )}

      {!pkg && !error && (
        <div className="flex flex-col items-center gap-2 rounded-lg border border-border bg-card py-16 text-center">
          <FileText className="size-8 text-muted-foreground" />
          <p className="text-sm text-muted-foreground">请选择纳税主体以生成申报表</p>
        </div>
      )}
    </div>
  )
}
