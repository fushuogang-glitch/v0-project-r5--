'use client'

import { useState, useTransition, type ReactNode } from 'react'
import { useRouter } from 'next/navigation'
import { Plus, Loader2, Pencil } from 'lucide-react'
import { toast } from 'sonner'
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
import { CONTRACT_CATEGORIES, CONTRACT_DIRECTIONS, CONTRACT_STATUSES } from '@/lib/contract-meta'
import { createContract, updateContract, type ContractInput } from '@/app/actions/contracts'

type EntityOption = { id: number; name: string; code: string }

export type ContractFormValue = {
  id?: number
  entityId: number | null
  contractNo: string
  title: string
  counterparty: string
  counterpartyContact: string
  counterpartyPhone: string
  category: string
  direction: string
  amount: string
  signDate: string
  startDate: string
  endDate: string
  status: string
  summary: string
}

function emptyForm(defaultEntityId: number | null): ContractFormValue {
  return {
    entityId: defaultEntityId,
    contractNo: '',
    title: '',
    counterparty: '',
    counterpartyContact: '',
    counterpartyPhone: '',
    category: 'service',
    direction: 'income',
    amount: '',
    signDate: new Date().toISOString().slice(0, 10),
    startDate: '',
    endDate: '',
    status: 'pending',
    summary: '',
  }
}

export function ContractFormDialog({
  entities,
  defaultEntityId = null,
  initial,
  mode = 'create',
  trigger,
}: {
  entities: EntityOption[]
  defaultEntityId?: number | null
  initial?: ContractFormValue
  mode?: 'create' | 'edit'
  trigger?: ReactNode
}) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [pending, startTransition] = useTransition()
  const [form, setForm] = useState<ContractFormValue>(
    initial ?? emptyForm(defaultEntityId ?? entities[0]?.id ?? null),
  )

  function update<K extends keyof ContractFormValue>(k: K, v: ContractFormValue[K]) {
    setForm((f) => ({ ...f, [k]: v }))
  }

  function submit() {
    if (form.entityId == null) {
      toast.error('请选择签约主体')
      return
    }
    const payload: ContractInput = {
      entityId: form.entityId,
      contractNo: form.contractNo,
      title: form.title,
      counterparty: form.counterparty,
      counterpartyContact: form.counterpartyContact,
      counterpartyPhone: form.counterpartyPhone,
      category: form.category,
      direction: form.direction,
      amount: Number(form.amount) || 0,
      signDate: form.signDate || null,
      startDate: form.startDate || null,
      endDate: form.endDate || null,
      status: form.status,
      summary: form.summary,
    }
    startTransition(async () => {
      try {
        if (mode === 'edit' && form.id) {
          await updateContract(form.id, payload)
          toast.success('合同已更新')
        } else {
          const res = await createContract(payload)
          toast.success('合同已登记')
          setOpen(false)
          router.push(`/contracts/${res.id}`)
          router.refresh()
          return
        }
        setOpen(false)
        router.refresh()
      } catch (e) {
        toast.error(e instanceof Error ? e.message : '操作失败')
      }
    })
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        setOpen(o)
        if (o && mode === 'create') setForm(emptyForm(defaultEntityId ?? entities[0]?.id ?? null))
      }}
    >
      <DialogTrigger asChild>
        {trigger ?? (
          <Button size="sm">
            {mode === 'edit' ? <Pencil className="size-4" /> : <Plus className="size-4" />}
            {mode === 'edit' ? '编辑合同' : '登记合同'}
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{mode === 'edit' ? '编辑合同' : '登记新合同'}</DialogTitle>
          <DialogDescription>
            登记合同基础信息与编号,保存后可上传扫描件并发起在线签署。
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 py-2">
          <div className="grid gap-2">
            <Label>签约主体</Label>
            <Select
              value={form.entityId != null ? String(form.entityId) : ''}
              onValueChange={(v) => update('entityId', Number(v))}
            >
              <SelectTrigger>
                <SelectValue placeholder="选择我方签约主体" />
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

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="grid gap-2">
              <Label htmlFor="contractNo">合同编号</Label>
              <Input
                id="contractNo"
                placeholder="如:HT-2026-001"
                value={form.contractNo}
                onChange={(e) => update('contractNo', e.target.value)}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="amount">合同金额(元)</Label>
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
            <Label htmlFor="title">合同名称</Label>
            <Input
              id="title"
              placeholder="如:年度美容服务采购合同"
              value={form.title}
              onChange={(e) => update('title', e.target.value)}
            />
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="grid gap-2">
              <Label htmlFor="counterparty">对方单位</Label>
              <Input
                id="counterparty"
                placeholder="客户 / 供应商名称"
                value={form.counterparty}
                onChange={(e) => update('counterparty', e.target.value)}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="counterpartyContact">对方联系人</Label>
              <Input
                id="counterpartyContact"
                placeholder="选填"
                value={form.counterpartyContact}
                onChange={(e) => update('counterpartyContact', e.target.value)}
              />
            </div>
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="grid gap-2">
              <Label>合同类型</Label>
              <Select value={form.category} onValueChange={(v) => update('category', v)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {CONTRACT_CATEGORIES.map((c) => (
                    <SelectItem key={c.value} value={c.value}>
                      {c.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-2">
              <Label>资金方向</Label>
              <Select value={form.direction} onValueChange={(v) => update('direction', v)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {CONTRACT_DIRECTIONS.map((c) => (
                    <SelectItem key={c.value} value={c.value}>
                      {c.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <div className="grid gap-2">
              <Label htmlFor="signDate">签订日期</Label>
              <Input
                id="signDate"
                type="date"
                value={form.signDate}
                onChange={(e) => update('signDate', e.target.value)}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="startDate">履行开始</Label>
              <Input
                id="startDate"
                type="date"
                value={form.startDate}
                onChange={(e) => update('startDate', e.target.value)}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="endDate">履行结束</Label>
              <Input
                id="endDate"
                type="date"
                value={form.endDate}
                onChange={(e) => update('endDate', e.target.value)}
              />
            </div>
          </div>

          <div className="grid gap-2">
            <Label>合同状态</Label>
            <Select value={form.status} onValueChange={(v) => update('status', v)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {CONTRACT_STATUSES.map((s) => (
                  <SelectItem key={s.value} value={s.value}>
                    {s.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid gap-2">
            <Label htmlFor="summary">合同摘要 / 备注</Label>
            <Textarea
              id="summary"
              placeholder="选填:合同主要内容、付款方式等"
              rows={2}
              value={form.summary}
              onChange={(e) => update('summary', e.target.value)}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)} disabled={pending}>
            取消
          </Button>
          <Button onClick={submit} disabled={pending}>
            {pending && <Loader2 className="size-4 animate-spin" />}
            {mode === 'edit' ? '保存修改' : '确认登记'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
