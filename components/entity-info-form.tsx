'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Save, Loader2, Check } from 'lucide-react'
import { updateEntityInfo } from '@/app/actions/org'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

type EntityInfo = {
  id: number
  legalPerson: string | null
  creditCode: string | null
  region: string | null
  city: string | null
  address: string | null
  phone: string | null
  taxAuthority: string | null
  bankName: string | null
  bankAccount: string | null
  establishDate: string | null
}

export function EntityInfoForm({ entity }: { entity: EntityInfo }) {
  const router = useRouter()
  const [error, setError] = useState<string | null>(null)
  const [saved, setSaved] = useState(false)
  const [pending, startTransition] = useTransition()
  const [form, setForm] = useState({
    creditCode: entity.creditCode ?? '',
    legalPerson: entity.legalPerson ?? '',
    establishDate: entity.establishDate ?? '',
    region: entity.region ?? '',
    city: entity.city ?? '',
    address: entity.address ?? '',
    phone: entity.phone ?? '',
    taxAuthority: entity.taxAuthority ?? '',
    bankName: entity.bankName ?? '',
    bankAccount: entity.bankAccount ?? '',
  })

  const update = (k: keyof typeof form, v: string) => {
    setForm((f) => ({ ...f, [k]: v }))
    setSaved(false)
  }

  const submit = () => {
    setError(null)
    startTransition(async () => {
      const res = await updateEntityInfo({ entityId: entity.id, ...form })
      if (!res.ok) {
        setError(res.error)
        return
      }
      setSaved(true)
      router.refresh()
    })
  }

  const field = (
    key: keyof typeof form,
    label: string,
    placeholder?: string,
    type = 'text',
  ) => (
    <div className="grid gap-2">
      <Label htmlFor={`ei-${key}`}>{label}</Label>
      <Input
        id={`ei-${key}`}
        type={type}
        placeholder={placeholder}
        value={form[key]}
        onChange={(e) => update(key, e.target.value)}
      />
    </div>
  )

  return (
    <div className="space-y-6">
      <section className="space-y-4">
        <h3 className="text-sm font-semibold text-foreground">工商登记</h3>
        <div className="grid gap-4 sm:grid-cols-2">
          {field('creditCode', '统一社会信用代码', '91xxxxxxxxxxxxxxxx')}
          {field('legalPerson', '法定代表人 / 负责人', '如:张三')}
          {field('establishDate', '成立日期', undefined, 'date')}
          {field('phone', '联系电话', '如:020-12345678')}
          {field('region', '所属区域 / 大区', '如:华南区')}
          {field('city', '所在城市', '如:广州')}
        </div>
        <div className="grid gap-2">
          <Label htmlFor="ei-address">注册地址</Label>
          <Input
            id="ei-address"
            placeholder="营业执照登记地址"
            value={form.address}
            onChange={(e) => update('address', e.target.value)}
          />
        </div>
      </section>

      <section className="space-y-4">
        <h3 className="text-sm font-semibold text-foreground">税务与银行</h3>
        <div className="grid gap-4 sm:grid-cols-2">
          {field('taxAuthority', '主管税务局', '如:广州市天河区税务局')}
          {field('bankName', '开户行', '如:工商银行天河支行')}
        </div>
        <div className="grid gap-2">
          <Label htmlFor="ei-bankAccount">对公银行账号</Label>
          <Input
            id="ei-bankAccount"
            placeholder="基本存款账户账号"
            value={form.bankAccount}
            onChange={(e) => update('bankAccount', e.target.value)}
          />
        </div>
      </section>

      {error && (
        <p className="text-sm text-destructive" role="alert">
          {error}
        </p>
      )}

      <div className="flex items-center gap-3">
        <Button onClick={submit} disabled={pending} className="gap-1.5">
          {pending ? (
            <Loader2 className="size-4 animate-spin" />
          ) : saved ? (
            <Check className="size-4" />
          ) : (
            <Save className="size-4" />
          )}
          {pending ? '保存中...' : saved ? '已保存' : '保存登记信息'}
        </Button>
        {saved && !pending && (
          <span className="text-sm text-emerald-600">登记信息已更新</span>
        )}
      </div>
    </div>
  )
}
