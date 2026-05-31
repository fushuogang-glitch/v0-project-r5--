'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Plus, Loader2 } from 'lucide-react'
import { createAccount } from '@/app/actions/org'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'

// 账户类型与默认渠道(渠道需与流水 channel 对应才能汇总收款)
const ACCOUNT_TYPES = [
  { value: 'wechat', label: '微信', channel: '微信' },
  { value: 'alipay', label: '支付宝', channel: '支付宝' },
  { value: 'bank', label: '对公银行', channel: '银行卡' },
  { value: 'cash', label: '现金', channel: '现金' },
  { value: 'pos', label: 'POS 刷卡', channel: 'POS' },
  { value: 'stored_value', label: '会员储值', channel: '储值余额' },
]

export function AccountForm({ entityId }: { entityId: number }) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()
  const [form, setForm] = useState({
    name: '',
    accountType: 'bank',
    channel: '银行卡',
    accountNo: '',
    holder: '',
  })

  const update = (k: keyof typeof form, v: string) =>
    setForm((f) => ({ ...f, [k]: v }))

  const onType = (v: string) => {
    const t = ACCOUNT_TYPES.find((x) => x.value === v)
    setForm((f) => ({ ...f, accountType: v, channel: t?.channel ?? f.channel }))
  }

  const submit = () => {
    setError(null)
    startTransition(async () => {
      const res = await createAccount({ entityId, ...form })
      if (!res.ok) {
        setError(res.error)
        return
      }
      setForm({ name: '', accountType: 'bank', channel: '银行卡', accountNo: '', holder: '' })
      setOpen(false)
      router.refresh()
    })
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" className="gap-1.5">
          <Plus className="size-4" />
          添加账户
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>添加收款账户</DialogTitle>
          <DialogDescription>
            为该主体新增一个收款渠道账户,流水按渠道自动汇总到对应账户。
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-2">
          <div className="grid gap-2">
            <Label htmlFor="acc-name">账户名称</Label>
            <Input
              id="acc-name"
              placeholder="如:对公基本户 / 前台微信"
              value={form.name}
              onChange={(e) => update('name', e.target.value)}
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="grid gap-2">
              <Label>账户类型</Label>
              <Select value={form.accountType} onValueChange={onType}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {ACCOUNT_TYPES.map((t) => (
                    <SelectItem key={t.value} value={t.value}>
                      {t.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="acc-channel">收款渠道</Label>
              <Input
                id="acc-channel"
                value={form.channel}
                onChange={(e) => update('channel', e.target.value)}
              />
            </div>
          </div>
          <div className="grid gap-2">
            <Label htmlFor="acc-no">账号 / 卡号(选填)</Label>
            <Input
              id="acc-no"
              placeholder="可脱敏,如 **** 1234"
              value={form.accountNo}
              onChange={(e) => update('accountNo', e.target.value)}
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="acc-holder">开户名 / 持有人(选填)</Label>
            <Input
              id="acc-holder"
              value={form.holder}
              onChange={(e) => update('holder', e.target.value)}
            />
          </div>
          {error && (
            <p className="text-sm text-destructive" role="alert">
              {error}
            </p>
          )}
        </div>
        <DialogFooter>
          <Button onClick={submit} disabled={pending} className="w-full">
            {pending && <Loader2 className="size-4 animate-spin" />}
            {pending ? '添加中...' : '确认添加'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
