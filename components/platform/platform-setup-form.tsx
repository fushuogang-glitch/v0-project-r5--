'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { bootstrapPlatformAdmin } from '@/app/actions/platform-auth'
import { authClient } from '@/lib/auth-client'
import { looksLikeEmail } from '@/lib/account-id'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { ShieldPlus } from 'lucide-react'

export function PlatformSetupForm() {
  const router = useRouter()
  const [name, setName] = useState('')
  const [account, setAccount] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setLoading(true)
    const res = await bootstrapPlatformAdmin({ name, account, password })
    if (!res.ok) {
      setLoading(false)
      setError(res.error ?? '创建失败')
      return
    }
    // 创建成功后自动登录并进入中控台(邮箱走邮箱通道,其余走用户名通道)
    const acc = account.trim()
    const { error: signErr } = looksLikeEmail(acc)
      ? await authClient.signIn.email({ email: acc, password, rememberMe: true })
      : await authClient.signIn.username({ username: acc, password, rememberMe: true })
    setLoading(false)
    if (signErr) {
      // 创建成功但自动登录失败,引导去登录页
      router.push('/platform/login')
      return
    }
    router.push('/platform')
    router.refresh()
  }

  return (
    <main className="flex min-h-svh items-center justify-center bg-neutral-950 px-4">
      <div className="w-full max-w-sm rounded-2xl border border-neutral-800 bg-neutral-900 p-8 shadow-2xl">
        <div className="mb-6 flex flex-col items-center gap-3 text-center">
          <span className="flex size-12 items-center justify-center rounded-xl bg-amber-400/15 text-amber-400">
            <ShieldPlus className="size-6" />
          </span>
          <div>
            <h1 className="text-lg font-semibold text-neutral-50">初始化运营超管</h1>
            <p className="mt-1 text-xs text-neutral-400">
              首次设置 · 创建后此页面将自动关闭
            </p>
          </div>
        </div>

        <form onSubmit={submit} className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="s-name" className="text-xs text-neutral-300">
              姓名
            </Label>
            <Input
              id="s-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              placeholder="运营负责人姓名"
              className="h-9 border-neutral-700 bg-neutral-800 text-sm text-neutral-100 placeholder:text-neutral-500"
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="s-account" className="text-xs text-neutral-300">
              超管账号
            </Label>
            <Input
              id="s-account"
              value={account}
              onChange={(e) => setAccount(e.target.value)}
              required
              autoCapitalize="none"
              autoCorrect="off"
              spellCheck={false}
              placeholder="手机号 / 用户名 / 邮箱"
              className="h-9 border-neutral-700 bg-neutral-800 text-sm text-neutral-100 placeholder:text-neutral-500"
            />
            <p className="text-[11px] leading-relaxed text-neutral-500">
              支持手机号、用户名或邮箱(2-30 位)
            </p>
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="s-password" className="text-xs text-neutral-300">
              密码
            </Label>
            <Input
              id="s-password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              placeholder="至少 8 位"
              className="h-9 border-neutral-700 bg-neutral-800 text-sm text-neutral-100 placeholder:text-neutral-500"
            />
          </div>

          {error && <p className="text-xs text-red-400">{error}</p>}

          <Button
            type="submit"
            disabled={loading}
            className="mt-2 h-9 bg-amber-400 text-sm font-medium text-neutral-950 hover:bg-amber-300"
          >
            {loading ? '创建中…' : '创建并进入中控台'}
          </Button>
        </form>
      </div>
    </main>
  )
}
