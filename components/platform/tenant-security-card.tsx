'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Eye, EyeOff, KeyRound, Lock, ShieldCheck, ShieldX, Copy } from 'lucide-react'
import {
  viewTenantPassword,
  resetTenantPassword,
  setTenantStatus,
  type TenantProfile,
} from '@/app/actions/platform'

const inputCls =
  'h-9 w-full rounded-md border border-neutral-700 bg-neutral-800 px-3 text-sm text-neutral-100 outline-none placeholder:text-neutral-500 focus:border-amber-400/50'

export function TenantSecurityCard({ profile }: { profile: TenantProfile }) {
  const router = useRouter()
  const suspended = profile.accountStatus === 'suspended'

  return (
    <section className="rounded-xl border border-neutral-800 bg-neutral-900/40 p-5">
      <h2 className="text-sm font-semibold text-neutral-200">账号与安全</h2>

      <dl className="mt-4 space-y-3 text-sm">
        <div className="flex items-center justify-between gap-3">
          <dt className="text-neutral-500">登录账号</dt>
          <dd className="font-medium text-neutral-200">{profile.loginAccount}</dd>
        </div>
        <div className="flex items-center justify-between gap-3">
          <dt className="text-neutral-500">账号状态</dt>
          <dd>
            <StatusBadge status={profile.accountStatus} />
          </dd>
        </div>
        <div className="flex items-center justify-between gap-3">
          <dt className="text-neutral-500">密码更新</dt>
          <dd className="text-neutral-300">
            {profile.pwdUpdatedAt ? new Date(profile.pwdUpdatedAt).toLocaleString('zh-CN') : '—'}
          </dd>
        </div>
      </dl>

      {!profile.pwdVaultReady && (
        <p className="mt-3 rounded-md bg-amber-400/10 px-3 py-2 text-[11px] text-amber-300">
          服务器未配置 PWD_ENC_KEY,「查看明文密码」不可用。配置后新设置/重置的密码即可查看。
        </p>
      )}

      <div className="mt-4 grid grid-cols-1 gap-3">
        <ViewPasswordBlock profile={profile} />
        <ResetPasswordBlock tenantId={profile.id} onDone={() => router.refresh()} />
      </div>

      <div className="mt-4 flex items-center justify-between rounded-lg border border-neutral-800 bg-neutral-800/20 p-3">
        <div>
          <p className="text-xs font-medium text-neutral-300">{suspended ? '账号已停用' : '账号正常'}</p>
          <p className="mt-0.5 text-[11px] text-neutral-500">
            {suspended ? '该客户全员当前无法登录系统' : '停用后该客户名下全部账号将无法登录'}
          </p>
        </div>
        <StatusToggle tenantId={profile.id} suspended={suspended} onDone={() => router.refresh()} />
      </div>
    </section>
  )
}

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, { label: string; cls: string }> = {
    active: { label: '正常', cls: 'bg-emerald-400/10 text-emerald-300' },
    suspended: { label: '已停用', cls: 'bg-red-500/15 text-red-300' },
    expired: { label: '已到期', cls: 'bg-neutral-700/40 text-neutral-300' },
  }
  const m = map[status] ?? map.active
  return <span className={`rounded px-2 py-0.5 text-xs font-medium ${m.cls}`}>{m.label}</span>
}

function ViewPasswordBlock({ profile }: { profile: TenantProfile }) {
  const [open, setOpen] = useState(false)
  const [adminPwd, setAdminPwd] = useState('')
  const [revealed, setRevealed] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  const disabled = !profile.pwdVaultReady || !profile.hasPlainPwd

  async function reveal() {
    setError(null)
    setLoading(true)
    const res = await viewTenantPassword(profile.id, adminPwd)
    setLoading(false)
    if (!res.ok) {
      setError(res.error)
      return
    }
    setRevealed(res.password)
    setAdminPwd('')
  }

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        disabled={disabled}
        className="flex items-center justify-center gap-1.5 rounded-md border border-neutral-700 py-2 text-xs text-neutral-300 transition-colors hover:bg-neutral-800 disabled:cursor-not-allowed disabled:opacity-50"
        title={disabled ? '无明文副本,请先重置密码以启用查看' : ''}
      >
        <Eye className="size-3.5" />
        查看明文密码
      </button>
    )
  }

  return (
    <div className="space-y-2 rounded-lg border border-neutral-800 bg-neutral-800/20 p-3">
      <p className="flex items-center gap-1.5 text-xs font-medium text-neutral-300">
        <Lock className="size-3.5" />
        身份验证后查看
      </p>
      {revealed ? (
        <div className="flex items-center justify-between gap-2 rounded-md border border-amber-400/30 bg-amber-400/10 px-3 py-2">
          <code className="text-sm font-semibold text-amber-200">{revealed}</code>
          <button
            onClick={() => navigator.clipboard?.writeText(revealed)}
            className="text-amber-300 hover:text-amber-200"
            aria-label="复制"
          >
            <Copy className="size-3.5" />
          </button>
        </div>
      ) : (
        <>
          <input
            type="password"
            value={adminPwd}
            onChange={(e) => setAdminPwd(e.target.value)}
            placeholder="输入您(超管)的登录密码"
            className={inputCls}
          />
          {error && <p className="rounded-md bg-red-500/10 px-3 py-2 text-xs text-red-300">{error}</p>}
          <div className="flex gap-2">
            <button
              onClick={() => {
                setOpen(false)
                setError(null)
                setAdminPwd('')
              }}
              className="flex-1 rounded-md border border-neutral-700 py-1.5 text-xs text-neutral-300 hover:bg-neutral-800"
            >
              取消
            </button>
            <button
              onClick={reveal}
              disabled={loading}
              className="flex-1 rounded-md bg-amber-400 py-1.5 text-xs font-semibold text-neutral-900 hover:bg-amber-300 disabled:opacity-60"
            >
              {loading ? '验证中...' : '查看'}
            </button>
          </div>
        </>
      )}
      <p className="text-[11px] text-neutral-500">每次查看都会记录审计日志。</p>
    </div>
  )
}

function ResetPasswordBlock({ tenantId, onDone }: { tenantId: string; onDone: () => void }) {
  const [open, setOpen] = useState(false)
  const [pwd, setPwd] = useState('')
  const [note, setNote] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [ok, setOk] = useState(false)
  const [loading, setLoading] = useState(false)

  async function submit() {
    setError(null)
    setLoading(true)
    const res = await resetTenantPassword(tenantId, pwd, note.trim() || undefined)
    setLoading(false)
    if (!res.ok) {
      setError(res.error)
      return
    }
    setOk(true)
    setPwd('')
    setNote('')
    onDone()
    setTimeout(() => {
      setOk(false)
      setOpen(false)
    }, 1500)
  }

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="flex items-center justify-center gap-1.5 rounded-md border border-neutral-700 py-2 text-xs text-neutral-300 transition-colors hover:bg-neutral-800"
      >
        <KeyRound className="size-3.5" />
        重置密码
      </button>
    )
  }

  return (
    <div className="space-y-2 rounded-lg border border-neutral-800 bg-neutral-800/20 p-3">
      <p className="text-xs font-medium text-neutral-300">为客户设置新密码</p>
      <input
        value={pwd}
        onChange={(e) => setPwd(e.target.value)}
        minLength={8}
        placeholder="新密码,至少 8 位"
        className={inputCls}
      />
      <input
        value={note}
        onChange={(e) => setNote(e.target.value)}
        placeholder="备注(选填,如:客户遗忘密码)"
        className={inputCls}
      />
      {error && <p className="rounded-md bg-red-500/10 px-3 py-2 text-xs text-red-300">{error}</p>}
      {ok && <p className="rounded-md bg-emerald-500/10 px-3 py-2 text-xs text-emerald-300">已重置,请通知客户</p>}
      <div className="flex gap-2">
        <button
          onClick={() => {
            setOpen(false)
            setError(null)
            setPwd('')
          }}
          className="flex-1 rounded-md border border-neutral-700 py-1.5 text-xs text-neutral-300 hover:bg-neutral-800"
        >
          取消
        </button>
        <button
          onClick={submit}
          disabled={loading}
          className="flex-1 rounded-md bg-amber-400 py-1.5 text-xs font-semibold text-neutral-900 hover:bg-amber-300 disabled:opacity-60"
        >
          {loading ? '提交中...' : '确认重置'}
        </button>
      </div>
    </div>
  )
}

function StatusToggle({
  tenantId,
  suspended,
  onDone,
}: {
  tenantId: string
  suspended: boolean
  onDone: () => void
}) {
  const [loading, setLoading] = useState(false)

  async function toggle() {
    setLoading(true)
    await setTenantStatus(tenantId, suspended ? 'active' : 'suspended')
    setLoading(false)
    onDone()
  }

  return (
    <button
      onClick={toggle}
      disabled={loading}
      className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-semibold transition-colors disabled:opacity-60 ${
        suspended
          ? 'bg-emerald-500/15 text-emerald-300 hover:bg-emerald-500/25'
          : 'bg-red-500/15 text-red-300 hover:bg-red-500/25'
      }`}
    >
      {suspended ? <ShieldCheck className="size-3.5" /> : <ShieldX className="size-3.5" />}
      {loading ? '处理中...' : suspended ? '恢复启用' : '停用账号'}
    </button>
  )
}
