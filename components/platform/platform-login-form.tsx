'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { authClient } from '@/lib/auth-client'
import { looksLikeEmail } from '@/lib/account-id'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { ShieldCheck } from 'lucide-react'

export function PlatformLoginForm() {
  const router = useRouter()
  const [account, setAccount] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setLoading(true)
    const value = account.trim()
    const { error } = looksLikeEmail(value)
      ? await authClient.signIn.email({ email: value, password, rememberMe: true })
      : await authClient.signIn.username({ username: value, password, rememberMe: true })
    setLoading(false)
    if (error) {
      setError(error.message ?? '账号或密码错误')
      return
    }
    // 角色校验交给 /platform 控制台布局:非平台超管会被引导回客户系统
    router.push('/platform')
    router.refresh()
  }

  return (
    <main className="flex min-h-svh items-center justify-center bg-neutral-950 px-4">
      <div className="w-full max-w-sm rounded-2xl border border-neutral-800 bg-neutral-900 p-8 shadow-2xl">
        <div className="mb-6 flex flex-col items-center gap-3 text-center">
          <span className="flex size-12 items-center justify-center rounded-xl bg-amber-400/15 text-amber-400">
            <ShieldCheck className="size-6" />
          </span>
          <div>
            <h1 className="text-lg font-semibold text-neutral-50">运营中控台</h1>
            <p className="mt-1 text-xs text-neutral-400">平台方专属入口 · 监控全部软件实例</p>
          </div>
        </div>

        <form onSubmit={submit} className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="p-account" className="text-xs text-neutral-300">
              超管账号
            </Label>
            <Input
              id="p-account"
              name="username"
              type="text"
              value={account}
              onChange={(e) => setAccount(e.target.value)}
              required
              autoComplete="username"
              autoCapitalize="none"
              autoCorrect="off"
              spellCheck={false}
              placeholder="手机号 / 用户名"
              className="h-9 border-neutral-700 bg-neutral-800 text-sm text-neutral-100 placeholder:text-neutral-500"
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="p-password" className="text-xs text-neutral-300">
              密码
            </Label>
            <Input
              id="p-password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              autoComplete="current-password"
              placeholder="请输入密码"
              className="h-9 border-neutral-700 bg-neutral-800 text-sm text-neutral-100 placeholder:text-neutral-500"
            />
          </div>

          {error && <p className="text-xs text-red-400">{error}</p>}

          <Button
            type="submit"
            disabled={loading}
            className="mt-2 h-9 bg-amber-400 text-sm font-medium text-neutral-950 hover:bg-amber-300"
          >
            {loading ? '登录中…' : '进入中控台'}
          </Button>
        </form>
      </div>
    </main>
  )
}
