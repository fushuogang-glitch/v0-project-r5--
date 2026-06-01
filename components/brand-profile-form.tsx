'use client'

import { useState, useTransition } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Building2, Check } from 'lucide-react'
import { saveBrandProfile, type BrandProfile } from '@/app/actions/org-profile'

export function BrandProfileForm({ initial }: { initial: BrandProfile }) {
  const [form, setForm] = useState({
    brandName: initial.brandName,
    groupName: initial.groupName,
    shortName: initial.shortName,
    slogan: initial.slogan,
    legalEntity: initial.legalEntity,
    industry: initial.industry,
    contactName: initial.contactName,
    contactPhone: initial.contactPhone,
    contactEmail: initial.contactEmail,
    headquarters: initial.headquarters,
    website: initial.website,
  })
  const [pending, startTransition] = useTransition()
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState<string | null>(null)

  function set<K extends keyof typeof form>(k: K, v: string) {
    setForm((f) => ({ ...f, [k]: v }))
    setSaved(false)
  }

  function submit() {
    setError(null)
    startTransition(async () => {
      const res = await saveBrandProfile(form)
      if (res.ok) {
        setSaved(true)
        setTimeout(() => setSaved(false), 2000)
      } else {
        setError(res.error)
      }
    })
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Building2 className="size-4" />
          品牌信息登记
        </CardTitle>
        <CardDescription>
          登记贵集团的品牌信息,将用于集团驾驶舱标题、财务报表抬头等展示位
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label="品牌名" hint="如「双美」">
            <Input
              value={form.brandName}
              onChange={(e) => set('brandName', e.target.value)}
              placeholder="双美"
            />
          </Field>
          <Field label="集团全称" hint="显示在集团驾驶舱标题">
            <Input
              value={form.groupName}
              onChange={(e) => set('groupName', e.target.value)}
              placeholder="双美集团"
            />
          </Field>
          <Field label="简称">
            <Input
              value={form.shortName}
              onChange={(e) => set('shortName', e.target.value)}
              placeholder="双美"
            />
          </Field>
          <Field label="所属行业">
            <Input
              value={form.industry}
              onChange={(e) => set('industry', e.target.value)}
              placeholder="美业连锁 / 医美 / 生活美容"
            />
          </Field>
          <Field label="品牌运营主体">
            <Input
              value={form.legalEntity}
              onChange={(e) => set('legalEntity', e.target.value)}
              placeholder="双美企业管理有限公司"
            />
          </Field>
          <Field label="官网">
            <Input
              value={form.website}
              onChange={(e) => set('website', e.target.value)}
              placeholder="https://"
            />
          </Field>
        </div>

        <Field label="品牌标语">
          <Textarea
            value={form.slogan}
            onChange={(e) => set('slogan', e.target.value)}
            placeholder="一句话品牌主张"
            rows={2}
          />
        </Field>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <Field label="联系人">
            <Input
              value={form.contactName}
              onChange={(e) => set('contactName', e.target.value)}
            />
          </Field>
          <Field label="联系电话">
            <Input
              value={form.contactPhone}
              onChange={(e) => set('contactPhone', e.target.value)}
            />
          </Field>
          <Field label="联系邮箱">
            <Input
              value={form.contactEmail}
              onChange={(e) => set('contactEmail', e.target.value)}
            />
          </Field>
        </div>

        <Field label="总部地址">
          <Input
            value={form.headquarters}
            onChange={(e) => set('headquarters', e.target.value)}
          />
        </Field>

        {error && <p className="text-sm text-destructive">{error}</p>}

        <div className="flex items-center gap-3">
          <Button onClick={submit} disabled={pending}>
            {saved ? <Check className="size-4" /> : null}
            {saved ? '已保存' : pending ? '保存中…' : '保存品牌信息'}
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}

function Field({
  label,
  hint,
  children,
}: {
  label: string
  hint?: string
  children: React.ReactNode
}) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs font-medium text-foreground">
        {label}
        {hint ? <span className="ml-1 text-muted-foreground">· {hint}</span> : null}
      </Label>
      {children}
    </div>
  )
}
