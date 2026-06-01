'use client'

import { useState, useMemo, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Plus, Loader2 } from 'lucide-react'
import { createTransaction } from '@/app/actions/finance'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  INVOICE_MEDIUMS,
  INVOICE_KINDS,
  categoriesFor,
} from '@/lib/invoice-meta'
import { formatCurrency } from '@/lib/format'

type Profile = {
  vatRate: number
  surtaxRate: number
  vatLabel: string
}

type ContractOption = { id: number; contractNo: string; title: string; counterparty: string }

export function TransactionForm({
  entityId,
  profile,
  expenseOnly = false,
  contractOptions = [],
}: {
  entityId: number
  profile: Profile
  expenseOnly?: boolean
  contractOptions?: ContractOption[]
}) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [pending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)

  const today = new Date().toISOString().slice(0, 10)
  const [form, setForm] = useState({
    bizType: (expenseOnly ? 'expense' : 'income') as 'income' | 'expense',
    bizDate: today,
    category: expenseOnly ? categoriesFor('expense')[0] : '护理服务',
    channel: expenseOnly ? '银行卡' : '微信',
    amount: '',
    invoiceMedium: 'none',
    invoiceKind: 'none',
    invoiceNo: '',
    contractId: 'none',
    summary: '',
  })

  // 对公进账(银行/对公/转账渠道的收入)建议关联合同,满足三流合一
  const isPublicIncome =
    form.bizType === 'income' &&
    ['银行', '对公', '公户', '转账'].some((k) => form.channel.includes(k))

  function update<K extends keyof typeof form>(k: K, v: (typeof form)[K]) {
    setForm((f) => ({ ...f, [k]: v }))
  }

  // 实时算税预览(账目标准随主体税政自动变化)
  const preview = useMemo(() => {
    const gross = Number(form.amount) || 0
    const invoiced = form.invoiceMedium !== 'none'
    const rate = invoiced ? profile.vatRate : 0
    const net = rate > 0 ? gross / (1 + rate) : gross
    const vat = gross - net
    const surtax = vat * profile.surtaxRate
    return { gross, net, vat, surtax, rate, invoiced }
  }, [form.amount, form.invoiceMedium, profile])

  function submit() {
    setError(null)
    startTransition(async () => {
      const res = await createTransaction({
        entityId,
        bizType: form.bizType,
        bizDate: form.bizDate,
        category: form.category,
        channel: form.channel,
        amount: Number(form.amount),
        invoiceMedium: form.invoiceMedium,
        invoiceKind: form.invoiceKind,
        invoiceNo: form.invoiceNo,
        contractId: form.contractId !== 'none' ? Number(form.contractId) : null,
        summary: form.summary,
      })
      if (!res.ok) {
        setError(res.error)
        return
      }
      setOpen(false)
      setForm((f) => ({ ...f, amount: '', invoiceNo: '', contractId: 'none', summary: '' }))
      router.refresh()
    })
  }

  const categories = categoriesFor(form.bizType)

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm">
          <Plus className="size-4" />
          {expenseOnly ? '费用填报' : '录入流水'}
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{expenseOnly ? '费用填报' : '录入收支流水'}</DialogTitle>
          <DialogDescription>
            {expenseOnly
              ? '按标准费用分类填报门店支出,上传发票后自动计算可抵扣进项。'
              : `系统按本主体税政(${profile.vatLabel})自动价税分离并计税。`}
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 py-2">
          <div className="grid grid-cols-2 gap-3">
            {!expenseOnly && (
              <div className="grid gap-2">
                <Label>收支类型</Label>
                <Select
                  value={form.bizType}
                  onValueChange={(v) => {
                    const t = v as 'income' | 'expense'
                    update('bizType', t)
                    update('category', categoriesFor(t)[0])
                  }}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="income">收入</SelectItem>
                    <SelectItem value="expense">支出</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            )}
            <div className="grid gap-2">
              <Label htmlFor="bizDate">业务日期</Label>
              <Input
                id="bizDate"
                type="date"
                value={form.bizDate}
                onChange={(e) => update('bizDate', e.target.value)}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="grid gap-2">
              <Label>业务分类</Label>
              <Select value={form.category} onValueChange={(v) => update('category', v)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {categories.map((c) => (
                    <SelectItem key={c} value={c}>
                      {c}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="amount">含税金额(元)</Label>
              <Input
                id="amount"
                inputMode="decimal"
                placeholder="0.00"
                value={form.amount}
                onChange={(e) => update('amount', e.target.value)}
              />
            </div>
          </div>

          <div className="grid gap-2">
            <Label htmlFor="channel">收付渠道</Label>
            <Input
              id="channel"
              placeholder="微信 / 支付宝 / 银行卡 / 现金"
              value={form.channel}
              onChange={(e) => update('channel', e.target.value)}
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="grid gap-2">
              <Label>发票介质</Label>
              <Select
                value={form.invoiceMedium}
                onValueChange={(v) => {
                  update('invoiceMedium', v)
                  if (v === 'none') update('invoiceKind', 'none')
                  else if (form.invoiceKind === 'none') update('invoiceKind', 'general')
                }}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {INVOICE_MEDIUMS.map((m) => (
                    <SelectItem key={m.value} value={m.value}>
                      {m.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-2">
              <Label>票种</Label>
              <Select
                value={form.invoiceKind}
                onValueChange={(v) => update('invoiceKind', v)}
                disabled={form.invoiceMedium === 'none'}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {INVOICE_KINDS.map((k) => (
                    <SelectItem key={k.value} value={k.value}>
                      {k.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {form.invoiceMedium !== 'none' && (
            <div className="grid gap-2">
              <Label htmlFor="invoiceNo">发票号码</Label>
              <Input
                id="invoiceNo"
                placeholder="选填"
                value={form.invoiceNo}
                onChange={(e) => update('invoiceNo', e.target.value)}
              />
            </div>
          )}

          {form.bizType === 'income' && (
            <div className="grid gap-2">
              <Label>
                关联合同
                {isPublicIncome && (
                  <span className="ml-2 text-xs font-normal text-amber-600">
                    对公进账建议挂合同(三流合一)
                  </span>
                )}
              </Label>
              <Select value={form.contractId} onValueChange={(v) => update('contractId', v)}>
                <SelectTrigger>
                  <SelectValue placeholder="选择合同(选填)" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">不关联</SelectItem>
                  {contractOptions.map((c) => (
                    <SelectItem key={c.id} value={String(c.id)}>
                      {c.contractNo} · {c.title}({c.counterparty})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {contractOptions.length === 0 && (
                <p className="text-xs text-muted-foreground">
                  暂无可选合同,可先在「合同管理」登记后再关联。
                </p>
              )}
            </div>
          )}

          <div className="grid gap-2">
            <Label htmlFor="summary">摘要</Label>
            <Textarea
              id="summary"
              placeholder="选填"
              rows={2}
              value={form.summary}
              onChange={(e) => update('summary', e.target.value)}
            />
          </div>

          {/* 自动算税预览 */}
          <div className="rounded-lg border border-border bg-muted/40 p-3 text-sm">
            <div className="mb-2 text-xs font-medium text-muted-foreground">
              账目标准预览 · {preview.invoiced ? `税率 ${(preview.rate * 100).toFixed(0)}%` : '未开票 · 不计销项税'}
            </div>
            <dl className="grid grid-cols-3 gap-2 tabular-nums">
              <Stat label="不含税" value={formatCurrency(Math.round(preview.net))} />
              <Stat label="增值税" value={formatCurrency(Math.round(preview.vat))} />
              <Stat label="附加税费" value={formatCurrency(Math.round(preview.surtax))} />
            </dl>
          </div>

          {error && <p className="text-sm text-destructive">{error}</p>}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)} disabled={pending}>
            取消
          </Button>
          <Button onClick={submit} disabled={pending}>
            {pending && <Loader2 className="size-4 animate-spin" />}
            确认录入
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="font-medium text-foreground">{value}</dd>
    </div>
  )
}
