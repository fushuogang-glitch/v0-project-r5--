'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Plus, X, CheckCircle2, Copy } from 'lucide-react'
import { createTenant } from '@/app/actions/platform'

const PLANS = [
  { value: 'trial', label: '试用' },
  { value: 'basic', label: '基础版' },
  { value: 'pro', label: '专业版' },
  { value: 'flagship', label: '旗舰版' },
]

const PROVINCES = [
  '北京', '上海', '广东', '江苏', '浙江', '山东', '四川', '湖北', '湖南', '河南',
  '河北', '福建', '安徽', '辽宁', '陕西', '江西', '重庆', '云南', '广西', '天津',
  '山西', '吉林', '黑龙江', '贵州', '甘肃', '海南', '内蒙古', '新疆', '宁夏', '青海', '西藏',
]

const SUB_OPTIONS = [
  { value: '0', label: '不设到期' },
  { value: '30', label: '1 个月' },
  { value: '90', label: '3 个月' },
  { value: '180', label: '半年' },
  { value: '365', label: '1 年' },
]

const inputCls =
  'h-9 w-full rounded-md border border-neutral-700 bg-neutral-800 px-3 text-sm text-neutral-100 outline-none placeholder:text-neutral-500 focus:border-amber-400/50'

export function CreateTenantDialog() {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [brandName, setBrandName] = useState('')
  const [account, setAccount] = useState('')
  const [password, setPassword] = useState('')
  const [province, setProvince] = useState('')
  const [plan, setPlan] = useState('trial')
  const [subscriptionDays, setSubscriptionDays] = useState('365')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [done, setDone] = useState<{ brandName: string; account: string; password: string } | null>(null)

  function reset() {
    setBrandName('')
    setAccount('')
    setPassword('')
    setProvince('')
    setPlan('trial')
    setSubscriptionDays('365')
    setError(null)
    setDone(null)
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setLoading(true)
    const res = await createTenant({
      brandName: brandName.trim(),
      account: account.trim(),
      password,
      province: province || null,
      plan,
      subscriptionDays: Number(subscriptionDays) || null,
    })
    setLoading(false)
    if (!res.ok) {
      setError(res.error)
      return
    }
    setDone({ brandName: brandName.trim(), account: account.trim(), password })
    router.refresh()
  }

  return (
    <>
      <button
        onClick={() => {
          reset()
          setOpen(true)
        }}
        className="flex items-center gap-1.5 rounded-md bg-amber-400 px-3 py-1.5 text-xs font-semibold text-neutral-900 transition-colors hover:bg-amber-300"
      >
        <Plus className="size-3.5" />
        开通品牌
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            className="absolute inset-0 bg-black/60"
            onClick={() => setOpen(false)}
            aria-hidden
          />
          <div className="relative z-10 w-full max-w-md rounded-2xl border border-neutral-800 bg-neutral-900 p-6 shadow-xl">
            <button
              onClick={() => setOpen(false)}
              className="absolute right-4 top-4 text-neutral-500 transition-colors hover:text-neutral-200"
              aria-label="关闭"
            >
              <X className="size-4" />
            </button>

            {done ? (
              <div className="flex flex-col items-center gap-4 py-2 text-center">
                <CheckCircle2 className="size-12 text-emerald-400" />
                <div>
                  <h3 className="text-base font-semibold text-neutral-100">品牌已开通</h3>
                  <p className="mt-1 text-xs text-neutral-500">
                    请将以下账号密码安全发送给客户,客户首次登录后可在「修改密码」处自行更改。
                  </p>
                </div>
                <div className="w-full space-y-2 rounded-lg border border-neutral-800 bg-neutral-800/40 p-3 text-left">
                  <Row label="品牌" value={done.brandName} />
                  <Row label="登录账号" value={done.account} />
                  <Row label="初始密码" value={done.password} />
                </div>
                <button
                  onClick={() =>
                    navigator.clipboard?.writeText(
                      `品牌:${done.brandName}\n登录账号:${done.account}\n初始密码:${done.password}`,
                    )
                  }
                  className="flex items-center gap-1.5 rounded-md border border-neutral-700 px-3 py-1.5 text-xs text-neutral-300 transition-colors hover:bg-neutral-800"
                >
                  <Copy className="size-3.5" />
                  复制开通信息
                </button>
                <div className="flex w-full gap-2 pt-1">
                  <button
                    onClick={() => reset()}
                    className="flex-1 rounded-md border border-neutral-700 py-2 text-xs text-neutral-300 transition-colors hover:bg-neutral-800"
                  >
                    继续开通
                  </button>
                  <button
                    onClick={() => setOpen(false)}
                    className="flex-1 rounded-md bg-amber-400 py-2 text-xs font-semibold text-neutral-900 transition-colors hover:bg-amber-300"
                  >
                    完成
                  </button>
                </div>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="flex flex-col gap-3">
                <div>
                  <h3 className="text-base font-semibold text-neutral-100">开通品牌</h3>
                  <p className="mt-0.5 text-xs text-neutral-500">
                    为客户创建集团管理员账号,该账号可自行开通名下门店与财务岗位
                  </p>
                </div>

                <Field label="品牌 / 公司名称">
                  <input
                    value={brandName}
                    onChange={(e) => setBrandName(e.target.value)}
                    required
                    placeholder="如:诺塔餐饮集团"
                    className={inputCls}
                  />
                </Field>

                <Field label="登录账号">
                  <input
                    value={account}
                    onChange={(e) => setAccount(e.target.value)}
                    required
                    autoCapitalize="none"
                    autoCorrect="off"
                    spellCheck={false}
                    placeholder="手机号 / 用户名 / 邮箱"
                    className={inputCls}
                  />
                </Field>

                <Field label="初始密码">
                  <input
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    minLength={8}
                    placeholder="至少 8 位,交付后由客户自行修改"
                    className={inputCls}
                  />
                </Field>

                <div className="grid grid-cols-2 gap-3">
                  <Field label="所属省份">
                    <select
                      value={province}
                      onChange={(e) => setProvince(e.target.value)}
                      className={inputCls}
                    >
                      <option value="">未设置</option>
                      {PROVINCES.map((p) => (
                        <option key={p} value={p}>
                          {p}
                        </option>
                      ))}
                    </select>
                  </Field>
                  <Field label="套餐">
                    <select
                      value={plan}
                      onChange={(e) => setPlan(e.target.value)}
                      className={inputCls}
                    >
                      {PLANS.map((p) => (
                        <option key={p.value} value={p.value}>
                          {p.label}
                        </option>
                      ))}
                    </select>
                  </Field>
                </div>

                <Field label="订阅时长">
                  <select
                    value={subscriptionDays}
                    onChange={(e) => setSubscriptionDays(e.target.value)}
                    className={inputCls}
                  >
                    {SUB_OPTIONS.map((o) => (
                      <option key={o.value} value={o.value}>
                        {o.label}
                      </option>
                    ))}
                  </select>
                </Field>

                {error && (
                  <p className="rounded-md bg-red-500/10 px-3 py-2 text-xs text-red-300">{error}</p>
                )}

                <button
                  type="submit"
                  disabled={loading}
                  className="mt-1 h-9 rounded-md bg-amber-400 text-sm font-semibold text-neutral-900 transition-colors hover:bg-amber-300 disabled:opacity-60"
                >
                  {loading ? '开通中...' : '开通并生成账号'}
                </button>
              </form>
            )}
          </div>
        </div>
      )}
    </>
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

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-3 text-sm">
      <span className="text-neutral-500">{label}</span>
      <span className="font-medium text-neutral-100">{value}</span>
    </div>
  )
}
