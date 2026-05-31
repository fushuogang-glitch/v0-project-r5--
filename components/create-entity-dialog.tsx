'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Plus, Loader2 } from 'lucide-react'
import { createEntity } from '@/app/actions/org'

export function CreateEntityDialog() {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [form, setForm] = useState({
    name: '',
    city: '',
    entityType: 'store',
    taxpayerType: 'small',
    legalPerson: '',
  })

  function update(key: keyof typeof form, value: string) {
    setForm((f) => ({ ...f, [key]: value }))
  }

  async function handleSubmit() {
    setError('')
    setLoading(true)
    const res = await createEntity(form)
    setLoading(false)
    if (!res.ok) {
      setError(res.error)
      return
    }
    setOpen(false)
    setForm({ name: '', city: '', entityType: 'store', taxpayerType: 'small', legalPerson: '' })
    router.push(`/entities/${res.entityId}`)
    router.refresh()
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>
          <Plus className="size-4" />
          开设新门店
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>开设新门店</DialogTitle>
          <DialogDescription>
            创建新的纳税主体,系统将自动套帐(生成一套默认收款账户)。
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-2">
          <div className="grid gap-2">
            <Label htmlFor="name">门店名称</Label>
            <Input
              id="name"
              placeholder="如:璞境·杭州西湖店"
              value={form.name}
              onChange={(e) => update('name', e.target.value)}
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="grid gap-2">
              <Label htmlFor="city">所在城市</Label>
              <Input
                id="city"
                placeholder="如:杭州"
                value={form.city}
                onChange={(e) => update('city', e.target.value)}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="legalPerson">法人(选填)</Label>
              <Input
                id="legalPerson"
                placeholder="负责人姓名"
                value={form.legalPerson}
                onChange={(e) => update('legalPerson', e.target.value)}
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="grid gap-2">
              <Label>主体类型</Label>
              <Select
                value={form.entityType}
                onValueChange={(v) => update('entityType', v)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="store">门店</SelectItem>
                  <SelectItem value="company">公司</SelectItem>
                  <SelectItem value="sole">个体户</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-2">
              <Label>纳税人身份</Label>
              <Select
                value={form.taxpayerType}
                onValueChange={(v) => update('taxpayerType', v)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="small">小规模纳税人</SelectItem>
                  <SelectItem value="general">一般纳税人</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          {error ? <p className="text-sm text-destructive">{error}</p> : null}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)} disabled={loading}>
            取消
          </Button>
          <Button onClick={handleSubmit} disabled={loading}>
            {loading ? <Loader2 className="size-4 animate-spin" /> : null}
            确认开设
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
