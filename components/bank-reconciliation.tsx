import type { BankReconciliation, ReconItem } from '@/app/actions/reconciliation'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion'
import { Badge } from '@/components/ui/badge'
import { Landmark, CheckCircle2, AlertCircle, ArrowDownLeft, ArrowUpRight } from 'lucide-react'
import { formatCurrency, formatCompactCurrency } from '@/lib/format'

export function BankReconciliation({ data }: { data: BankReconciliation[] }) {
  if (data.length === 0) return null

  const totalBook = data.reduce((s, r) => s + r.bookBalance, 0)
  const totalBank = data.reduce((s, r) => s + r.bankBalance, 0)
  const totalUnreconciled = data.reduce(
    (s, r) => s + r.bookOnly.length + r.bankOnly.length,
    0,
  )
  const balancedCount = data.filter((r) => r.isBalanced).length
  const allBalanced = balancedCount === data.length

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="space-y-1">
            <CardTitle className="flex items-center gap-2 text-base">
              <Landmark className="size-4 text-muted-foreground" />
              银行对账
            </CardTitle>
            <CardDescription>
              对公银行账户账面流水与银行对账单逐笔勾对,自动生成余额调节表
            </CardDescription>
          </div>
          <Badge
            variant={allBalanced ? 'secondary' : 'outline'}
            className={`gap-1 font-normal ${
              allBalanced ? '' : 'border-amber-500/40 text-amber-600'
            }`}
          >
            {allBalanced ? (
              <CheckCircle2 className="size-3.5" />
            ) : (
              <AlertCircle className="size-3.5" />
            )}
            {balancedCount}/{data.length} 账户已平
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-5">
        {/* 顶部汇总 */}
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <SummaryStat label="账面余额合计" value={formatCompactCurrency(totalBook)} />
          <SummaryStat label="对账单余额合计" value={formatCompactCurrency(totalBank)} />
          <SummaryStat
            label="账实差异"
            value={formatCompactCurrency(totalBook - totalBank)}
            hint={totalBook === totalBank ? '无差异' : '由未达账项产生'}
          />
          <SummaryStat label="待核未达账项" value={`${totalUnreconciled} 笔`} />
        </div>

        {/* 每账户对账明细 */}
        <Accordion type="single" collapsible defaultValue={`r-${data[0].entityId}`}>
          {data.map((r) => (
            <AccordionItem key={r.entityId} value={`r-${r.entityId}`}>
              <AccordionTrigger className="hover:no-underline">
                <div className="flex flex-1 flex-wrap items-center justify-between gap-2 pr-2">
                  <div className="flex flex-col items-start text-left">
                    <span className="font-medium text-foreground">{r.entityName}</span>
                    <span className="text-xs text-muted-foreground">
                      {r.accountName} · {r.accountNo ?? '—'}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    {r.bookOnly.length + r.bankOnly.length > 0 && (
                      <span className="text-xs text-muted-foreground">
                        {r.bookOnly.length + r.bankOnly.length} 笔未达
                      </span>
                    )}
                    <Badge
                      variant={r.isBalanced ? 'secondary' : 'outline'}
                      className={`font-normal ${
                        r.isBalanced ? '' : 'border-amber-500/40 text-amber-600'
                      }`}
                    >
                      {r.isBalanced ? '已平' : '待调节'}
                    </Badge>
                  </div>
                </div>
              </AccordionTrigger>
              <AccordionContent>
                <ReconciliationDetail r={r} />
              </AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>
      </CardContent>
    </Card>
  )
}

function SummaryStat({
  label,
  value,
  hint,
}: {
  label: string
  value: string
  hint?: string
}) {
  return (
    <div className="rounded-lg border bg-card p-3">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="mt-0.5 text-lg font-semibold tabular-nums tracking-tight">{value}</p>
      {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
    </div>
  )
}

function ReconciliationDetail({ r }: { r: BankReconciliation }) {
  const bookOnlyNet = netOf(r.bookOnly)
  const bankOnlyNet = netOf(r.bankOnly)

  return (
    <div className="space-y-5 pt-1">
      {/* 余额调节表 */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <div className="rounded-lg border p-4">
          <p className="mb-3 text-sm font-medium text-foreground">企业账面调节</p>
          <dl className="space-y-2 text-sm">
            <Row label="企业账面余额" value={formatCurrency(r.bookBalance)} />
            <Row
              label="加:银行已记企业未记"
              value={signed(bankOnlyNet)}
              muted
            />
            <div className="my-1 border-t" />
            <Row label="调节后余额" value={formatCurrency(r.adjustedBalance)} strong />
          </dl>
        </div>
        <div className="rounded-lg border p-4">
          <p className="mb-3 text-sm font-medium text-foreground">银行对账单调节</p>
          <dl className="space-y-2 text-sm">
            <Row label="银行对账单余额" value={formatCurrency(r.bankBalance)} />
            <Row label="加:企业已记银行未达" value={signed(bookOnlyNet)} muted />
            <div className="my-1 border-t" />
            <Row label="调节后余额" value={formatCurrency(r.adjustedBalance)} strong />
          </dl>
        </div>
      </div>

      {/* 勾对结果 */}
      <div className="flex flex-wrap gap-x-6 gap-y-1 rounded-lg bg-muted/50 px-4 py-3 text-sm">
        <span className="text-muted-foreground">
          已勾对 <span className="font-medium text-foreground">{r.matchedCount}</span> 笔
          {' · '}
          <span className="font-medium text-foreground tabular-nums">
            {formatCompactCurrency(r.matchedAmount)}
          </span>
        </span>
        <span className="text-muted-foreground">
          共 <span className="font-medium text-foreground">{r.totalLines}</span> 笔账面流水
        </span>
        {r.isBalanced && (
          <span className="ml-auto flex items-center gap-1 text-emerald-600">
            <CheckCircle2 className="size-4" />
            双方调节后一致,账户已平
          </span>
        )}
      </div>

      {/* 未达账项明细 */}
      {r.bookOnly.length + r.bankOnly.length > 0 ? (
        <div className="space-y-2">
          <p className="text-sm font-medium text-foreground">未达账项明细</p>
          <div className="overflow-hidden rounded-lg border">
            <table className="w-full text-sm">
              <thead className="bg-muted/50 text-xs text-muted-foreground">
                <tr>
                  <th className="px-3 py-2 text-left font-medium">日期</th>
                  <th className="px-3 py-2 text-left font-medium">摘要</th>
                  <th className="px-3 py-2 text-left font-medium">类型</th>
                  <th className="px-3 py-2 text-right font-medium">金额</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {[...r.bookOnly, ...r.bankOnly].map((item) => (
                  <ItemRow key={item.id} item={item} />
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        <p className="text-sm text-emerald-600">本账户全部流水已勾对,无未达账项。</p>
      )}
    </div>
  )
}

function ItemRow({ item }: { item: ReconItem }) {
  return (
    <tr>
      <td className="px-3 py-2 tabular-nums text-muted-foreground">{item.date}</td>
      <td className="px-3 py-2">
        <div className="flex flex-col">
          <span className="text-foreground">{item.summary}</span>
          <span className="text-xs text-muted-foreground">{item.note}</span>
        </div>
      </td>
      <td className="px-3 py-2">
        <Badge variant="outline" className="font-normal">
          {item.kind === 'book_only' ? '企业未达' : '银行单边'}
        </Badge>
      </td>
      <td className="px-3 py-2 text-right">
        <span
          className={`inline-flex items-center justify-end gap-1 tabular-nums font-medium ${
            item.direction === 'in' ? 'text-emerald-600' : 'text-foreground'
          }`}
        >
          {item.direction === 'in' ? (
            <ArrowDownLeft className="size-3.5" />
          ) : (
            <ArrowUpRight className="size-3.5 text-muted-foreground" />
          )}
          {item.direction === 'in' ? '+' : '-'}
          {formatCurrency(item.amount)}
        </span>
      </td>
    </tr>
  )
}

function Row({
  label,
  value,
  strong,
  muted,
}: {
  label: string
  value: string
  strong?: boolean
  muted?: boolean
}) {
  return (
    <div className="flex items-center justify-between">
      <dt className={muted ? 'text-muted-foreground' : 'text-foreground'}>{label}</dt>
      <dd
        className={`tabular-nums ${
          strong ? 'text-base font-semibold text-foreground' : 'text-foreground'
        }`}
      >
        {value}
      </dd>
    </div>
  )
}

function netOf(items: ReconItem[]): number {
  return items.reduce((s, i) => s + (i.direction === 'in' ? i.amount : -i.amount), 0)
}

function signed(n: number): string {
  return (n >= 0 ? '+' : '-') + formatCurrency(Math.abs(n))
}
