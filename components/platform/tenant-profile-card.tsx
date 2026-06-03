'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Pencil, X } from 'lucide-react'
import { updateTenantProfile, type TenantProfile } from '@/app/actions/platform'

const PROVINCES = [
  '北京', '上海', '广东', '江苏', '浙江', '山东', '四川', '湖北', '湖南', '河南',
  '河北', '福建', '安徽', '辽宁', '陕西', '江西', '重庆', '云南', '广西', '天津',
  '山西', '吉林', '黑龙江', '贵州', '甘肃', '海南', '内蒙古', '新疆', '宁夏', '青海', '西藏',
]

const inputCls =
  'h-9 w-full rounded-md border border-neutral-700 bg-neutral-800 px-3 text-sm text-neutral-100 outline-none placeholder:text-neutral-500 focus:border-amber-400/50'

export function TenantProfileCard({ profile }: { profile: TenantProfile }) {
  const router = useRouter()
  const [editing, setEditing] = useState(false)
  const [brandName, setBrandName] = useState(profile.brandName)
  const [bossName, setBossName] = useState(profile.bossName ?? '')
  const [province, setProvince] = useState(profile.province ?? '')
  const [city, setCity] = useState(profile.city ?? '')
  const [address, setAddress] = useState(profile.address ?? '')
  const [contactPhone, setContactPhone] = useState(profile.contactPhone ?? '')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  async function save(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setLoading(true)
    const res = await updateTenantProfile(profile.id, {
      brandName,
      bossName,
      province: province || null,
      city,
      address,
      contactPhone,
    })
    setLoading(false)
    if (!res.ok) {
      setError(res.error)
      return
    }
    setEditing(false)
    router.refresh()
  }

  return (
    <section className="rounded-xl border border-neutral-800 bg-neutral-900/40 p-5">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold text-neutral-200">基本信息</h2>
        {!editing && (
          <button
            onClick={() => setEditing(true)}
            className="flex items-center gap-1 rounded-md border border-neutral-700 px-2.5 py-1 text-xs text-neutral-300 transition-colors hover:bg-neutral-800"
          >
            <Pencil className="size-3" />
            编辑
          </button>
        )}
      </div>

      {editing ? (
        <form onSubmit={save} className="mt-4 flex flex-col gap-3">
          <Field label="品牌 / 公司名称">
            <input value={brandName} onChange={(e) => setBrandName(e.target.value)} required className={inputCls} />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="负责人">
              <input value={bossName} onChange={(e) => setBossName(e.target.value)} placeholder="老板姓名" className={inputCls} />
            </Field>
            <Field label="联系电话">
              <input value={contactPhone} onChange={(e) => setContactPhone(e.target.value)} placeholder="手机号" className={inputCls} />
            </Field>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Field label="省份">
              <select value={province} onChange={(e) => setProvince(e.target.value)} className={inputCls}>
                <option value="">未设置</option>
                {PROVINCES.map((p) => (
                  <option key={p} value={p}>{p}</option>
                ))}
              </select>
            </Field>
            <Field label="城市">
              <input value={city} onChange={(e) => setCity(e.target.value)} placeholder="如:武汉" className={inputCls} />
            </Field>
          </div>
          <Field label="详细地址">
            <input value={address} onChange={(e) => setAddress(e.target.value)} placeholder="门牌 / 写字楼" className={inputCls} />
          </Field>
          {error && <p className="rounded-md bg-red-500/10 px-3 py-2 text-xs text-red-300">{error}</p>}
          <div className="flex gap-2 pt-1">
            <button
              type="button"
              onClick={() => setEditing(false)}
              className="flex flex-1 items-center justify-center gap-1 rounded-md border border-neutral-700 py-2 text-xs text-neutral-300 transition-colors hover:bg-neutral-800"
            >
              <X className="size-3.5" />
              取消
            </button>
            <button
              type="submit"
              disabled={loading}
              className="flex-1 rounded-md bg-amber-400 py-2 text-xs font-semibold text-neutral-900 transition-colors hover:bg-amber-300 disabled:opacity-60"
            >
              {loading ? '保存中...' : '保存'}
            </button>
          </div>
        </form>
      ) : (
        <dl className="mt-4 space-y-3">
          <Row label="品牌 / 公司" value={profile.brandName} />
          <Row label="负责人" value={profile.bossName} />
          <Row label="联系电话" value={profile.contactPhone} />
          <Row label="所在地区" value={[profile.province, profile.city].filter(Boolean).join(' · ') || null} />
          <Row label="详细地址" value={profile.address} />
          <Row label="开户时间" value={new Date(profile.createdAt).toLocaleDateString('zh-CN')} />
        </dl>
      )}
    </section>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="text-xs text-neutral-400">{label}</span>
      {children}
    </label>
  )
}

function Row({ label, value }: { label: string; value: string | null | undefined }) {
  return (
    <div className="flex items-start justify-between gap-3 text-sm">
      <dt className="shrink-0 text-neutral-500">{label}</dt>
      <dd className="text-right font-medium text-neutral-200">{value || <span className="text-neutral-600">未填写</span>}</dd>
    </div>
  )
}
