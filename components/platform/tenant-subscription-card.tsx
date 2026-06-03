'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { CalendarPlus } from 'lucide-react'
import { renewTenant, type TenantProfile } from '@/app/actions/platform'
import { planLabel, expiryMeta } from './status'

const PLANS = [
  { value: 'trial', label: '试用' },
  { value: 'basic', label: '基础版' },
  { value: 'pro', label: '专业版' },
  { value: 'flagship', label: '旗舰版' },
]

const RENEW_OPTIONS = [
  { value: 30, label: '1 个月' },
  { value: 90, label: '3 个月' },
  { value: 180, label: '半年' },
  { value: 365, label: '1 年' },
  { value: 730, label: '2 年' },
]

const inputCls =
  'h-9 w-full rounded-md border border-neutral-700 bg-neutral-800 px-3 text-sm text-neutral-100 outline-none focus:border-amber-400/50'

export function TenantSubscriptionCard({ profile }: { profile: TenantProfile }) {
  const router = useRouter()
  const [days, setDays] = useState(365)
  const [plan, setPlan] = useState(profile.plan ?? 'trial')
  const [note, setNote] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [ok, setOk] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  const em = expiryMeta(profile.daysLeft)
  const pm = planLabel(profile.plan)

  async function handleRenew() {
    setError(null)
    setOk(null)
    setLoading(true)
    const res = await renewTenant(profile.id, days, { plan, note: note.trim() || undefined })
    setLoading(false)
    if (!res.ok) {
      setError(res.error)
      return
    }
    setOk(`续费成功,新到期日 ${new Date(res.endsAt).toLocaleDateString('zh-CN')}`)
    setNote('')
    router.refresh()
  }

  return (
    <section className="rounded-xl border border-neutral-800 bg-neutral-900/40 p-5">
      <h2 className="text-sm font-semibold text-neutral-200">订阅管理</h2>

      <div className="mt-4 grid grid-cols-2 gap-3">
        <div className="rounded-lg border border-neutral-800 bg-neutral-800/30 p-3">
          <p className="text-xs text-neutral-500">当前套餐</p>
          <span className={`mt-1.5 inline-block rounded px-2 py-0.5 text-xs font-medium ${pm.chip}`}>{pm.label}</span>
        </div>
        <div className="rounded-lg border border-neutral-800 bg-neutral-800/30 p-3">
          <p className="text-xs text-neutral-500">到期状态</p>
          <span className={`mt-1.5 inline-block rounded px-2 py-0.5 text-xs font-medium ${em.chip}`}>{em.label}</span>
        </div>
      </div>

      <dl className="mt-3 space-y-2 text-sm">
        <div className="flex justify-between">
          <dt className="text-neutral-500">开通日期</dt>
          <dd className="text-neutral-300">
            {profile.subscriptionStartAt ? new Date(profile.subscriptionStartAt).toLocaleDateString('zh-CN') : '—'}
          </dd>
        </div>
        <div className="flex justify-between">
          <dt className="text-neutral-500">到期日期</dt>
          <dd className="text-neutral-300">
            {profile.subscriptionEndsAt ? new Date(profile.subscriptionEndsAt).toLocaleDateString('zh-CN') : '未设置'}
          </dd>
        </div>
      </dl>

      <div className="mt-4 space-y-3 rounded-lg border border-neutral-800 bg-neutral-800/20 p-3">
        <p className="text-xs font-medium text-neutral-300">续费 / 升级</p>
        <div className="grid grid-cols-2 gap-3">
          <label className="flex flex-col gap-1.5">
            <span className="text-xs text-neutral-400">续费时长</span>
            <select value={days} onChange={(e) => setDays(Number(e.target.value))} className={inputCls}>
              {RENEW_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-1.5">
            <span className="text-xs text-neutral-400">套餐(可调整)</span>
            <select value={plan} onChange={(e) => setPlan(e.target.value)} className={inputCls}>
              {PLANS.map((p) => (
                <option key={p.value} value={p.value}>{p.label}</option>
              ))}
            </select>
          </label>
        </div>
        <input
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="备注(选填,如:客户已付款 ¥9800)"
          className={inputCls}
        />
        {error && <p className="rounded-md bg-red-500/10 px-3 py-2 text-xs text-red-300">{error}</p>}
        {ok && <p className="rounded-md bg-emerald-500/10 px-3 py-2 text-xs text-emerald-300">{ok}</p>}
        <button
          onClick={handleRenew}
          disabled={loading}
          className="flex w-full items-center justify-center gap-1.5 rounded-md bg-amber-400 py-2 text-xs font-semibold text-neutral-900 transition-colors hover:bg-amber-300 disabled:opacity-60"
        >
          <CalendarPlus className="size-3.5" />
          {loading ? '处理中...' : '确认续费'}
        </button>
        {profile.daysLeft != null && profile.daysLeft <= 0 && (
          <p className="text-center text-[11px] text-neutral-500">已过期账号续费后将自动恢复为「正常」状态</p>
        )}
      </div>
    </section>
  )
}
