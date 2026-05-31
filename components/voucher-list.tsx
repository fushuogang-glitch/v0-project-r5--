import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { formatCurrency } from '@/lib/format'
import type { Voucher } from '@/lib/accounting'

export function VoucherList({ vouchers }: { vouchers: Voucher[] }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">记账凭证</CardTitle>
        <CardDescription>
          共 {vouchers.length} 张 · 由收支流水按复式记账规则自动生成,借贷自动平衡
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {vouchers.length === 0 && (
          <p className="py-8 text-center text-sm text-muted-foreground">
            暂无凭证,录入流水后自动生成
          </p>
        )}
        {[...vouchers].reverse().map((v) => (
          <div key={v.voucherNo} className="rounded-lg border border-border">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border bg-muted/40 px-3 py-2">
              <div className="flex items-center gap-2">
                <Badge variant="outline" className="font-mono text-xs">
                  {v.voucherNo}
                </Badge>
                <span className="text-sm font-medium text-foreground">{v.summary}</span>
              </div>
              <div className="flex items-center gap-3 text-xs text-muted-foreground">
                <span className="tabular-nums">{v.date}</span>
                <Badge
                  variant="outline"
                  className={
                    v.bizType === 'income'
                      ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
                      : 'border-border text-muted-foreground'
                  }
                >
                  {v.bizType === 'income' ? '收入' : '支出'}
                </Badge>
              </div>
            </div>
            <table className="w-full text-sm">
              <thead>
                <tr className="text-xs text-muted-foreground">
                  <th className="px-3 py-1.5 text-left font-normal">会计科目</th>
                  <th className="px-3 py-1.5 text-right font-normal">借方</th>
                  <th className="px-3 py-1.5 text-right font-normal">贷方</th>
                </tr>
              </thead>
              <tbody>
                {v.entries.map((e, i) => (
                  <tr key={i} className="border-t border-border/60">
                    <td className="px-3 py-1.5">
                      <span className="text-muted-foreground tabular-nums">{e.accountCode}</span>
                      <span className="ml-2 text-foreground">{e.account}</span>
                    </td>
                    <td className="px-3 py-1.5 text-right tabular-nums">
                      {e.debit > 0 ? formatCurrency(e.debit) : ''}
                    </td>
                    <td className="px-3 py-1.5 text-right tabular-nums">
                      {e.credit > 0 ? formatCurrency(e.credit) : ''}
                    </td>
                  </tr>
                ))}
                <tr className="border-t border-border bg-muted/30 text-xs font-medium">
                  <td className="px-3 py-1.5 text-muted-foreground">合计</td>
                  <td className="px-3 py-1.5 text-right tabular-nums">{formatCurrency(v.total)}</td>
                  <td className="px-3 py-1.5 text-right tabular-nums">{formatCurrency(v.total)}</td>
                </tr>
              </tbody>
            </table>
          </div>
        ))}
      </CardContent>
    </Card>
  )
}
