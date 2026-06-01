'use client'

import { useRouter, useSearchParams } from 'next/navigation'
import { Download, Printer } from 'lucide-react'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Button } from '@/components/ui/button'

type EntityOpt = { id: number; name: string }

export function TaxFilingSelector({
  entities,
  entityId,
  year,
  quarter,
}: {
  entities: EntityOpt[]
  entityId: number | null
  year: number
  quarter: number
}) {
  const router = useRouter()
  const sp = useSearchParams()

  const update = (patch: Record<string, string>) => {
    const next = new URLSearchParams(sp.toString())
    for (const [k, v] of Object.entries(patch)) next.set(k, v)
    router.push(`/tax-filing?${next.toString()}`)
  }

  const years = [year, year - 1, year - 2]
  const qParam = entityId
    ? `entity=${entityId}&year=${year}&quarter=${quarter}`
    : ''

  return (
    <div className="flex flex-wrap items-end gap-3 rounded-lg border border-border bg-card p-4">
      <div className="flex flex-col gap-1.5">
        <label className="text-xs text-muted-foreground">纳税主体</label>
        <Select
          value={entityId ? String(entityId) : undefined}
          onValueChange={(v) => update({ entity: v })}
        >
          <SelectTrigger className="h-9 w-48 text-sm">
            <SelectValue placeholder="选择主体" />
          </SelectTrigger>
          <SelectContent>
            {entities.map((e) => (
              <SelectItem key={e.id} value={String(e.id)}>
                {e.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="flex flex-col gap-1.5">
        <label className="text-xs text-muted-foreground">所属年度</label>
        <Select value={String(year)} onValueChange={(v) => update({ year: v })}>
          <SelectTrigger className="h-9 w-28 text-sm">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {years.map((y) => (
              <SelectItem key={y} value={String(y)}>
                {y}年
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="flex flex-col gap-1.5">
        <label className="text-xs text-muted-foreground">申报期间</label>
        <Select value={String(quarter)} onValueChange={(v) => update({ quarter: v })}>
          <SelectTrigger className="h-9 w-32 text-sm">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {[1, 2, 3, 4].map((q) => (
              <SelectItem key={q} value={String(q)}>
                第{q}季度
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {entityId && (
        <div className="ml-auto flex items-center gap-2">
          <Button
            asChild
            size="sm"
            variant="outline"
            className="gap-1.5"
          >
            <a href={`/api/reports/export?kind=filing&${qParam}&format=xlsx`}>
              <Download className="size-4" />
              导出 Excel
            </a>
          </Button>
          <Button asChild size="sm" variant="outline" className="gap-1.5">
            <a href={`/reports-print?kind=filing&${qParam}`} target="_blank" rel="noreferrer">
              <Printer className="size-4" />
              打印 / PDF
            </a>
          </Button>
        </div>
      )}
    </div>
  )
}
