'use client'

import { useState } from 'react'
import { FileSpreadsheet, FileText, Printer } from 'lucide-react'
import { Button } from '@/components/ui/button'

type EntityOpt = { id: number; name: string; code: string }

export function ReportExportToolbar({
  entities,
  canChoose,
}: {
  entities: EntityOpt[]
  canChoose: boolean
}) {
  const [target, setTarget] = useState<string>('group')

  const exportUrl = (format: 'xlsx' | 'csv') =>
    `/api/reports/export?target=${encodeURIComponent(target)}&format=${format}`

  const openPrint = () => {
    window.open(`/reports-print?target=${encodeURIComponent(target)}`, '_blank')
  }

  return (
    <div className="flex flex-wrap items-center gap-2 rounded-lg border border-border bg-card p-3">
      {canChoose && (
        <div className="flex items-center gap-2">
          <label htmlFor="report-target" className="text-sm text-muted-foreground">
            导出范围
          </label>
          <select
            id="report-target"
            value={target}
            onChange={(e) => setTarget(e.target.value)}
            className="h-9 rounded-md border border-input bg-background px-3 text-sm text-foreground"
          >
            <option value="group">集团合并(全部门店)</option>
            {entities.map((e) => (
              <option key={e.id} value={String(e.id)}>
                {e.name}({e.code})
              </option>
            ))}
          </select>
        </div>
      )}

      <div className="ml-auto flex flex-wrap items-center gap-2">
        <Button asChild size="sm" variant="outline" className="gap-1.5">
          <a href={exportUrl('xlsx')}>
            <FileSpreadsheet className="size-4" />
            导出 Excel
          </a>
        </Button>
        <Button asChild size="sm" variant="outline" className="gap-1.5">
          <a href={exportUrl('csv')}>
            <FileText className="size-4" />
            导出 CSV
          </a>
        </Button>
        <Button onClick={openPrint} size="sm" className="gap-1.5">
          <Printer className="size-4" />
          打印 / PDF
        </Button>
      </div>
    </div>
  )
}
