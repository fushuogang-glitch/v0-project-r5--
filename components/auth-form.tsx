'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Eye, EyeOff } from 'lucide-react'
import { authClient } from '@/lib/auth-client'
import { looksLikeEmail } from '@/lib/account-id'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Checkbox } from '@/components/ui/checkbox'

const STATS = [
  { value: '200+', label: '服务品牌' },
  { value: '1000+', label: '覆盖门店' },
  { value: '50,000+', label: '日均处理' },
  { value: '92%', label: 'AI决策精准度', accent: true },
]

// 财务合作客户(连锁美业品牌)
const FINANCE_CLIENTS = [
  '武汉一二一',
  '美研造型',
  '尚format美学',
  '丝域养发',
  '伊莱美容',
  '卡迪雅连锁',
]

export function AuthForm() {
  const router = useRouter()
  const [account, setAccount] = useState('') // 手机号 / 用户名 / 邮箱
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [remember, setRemember] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)

    const value = account.trim()
    // 登录:含 @ 走邮箱通道,否则走用户名 / 手机号通道
    setLoading(true)
    const { error } = looksLikeEmail(value)
      ? await authClient.signIn.email({ email: value, password, rememberMe: remember })
      : await authClient.signIn.username({ username: value, password, rememberMe: remember })
    setLoading(false)
    if (error) {
      setError(error.message ?? '账号或密码错误,请重试')
      return
    }

    router.push('/')
    router.refresh()
  }

  return (
    <main className="grid min-h-svh lg:grid-cols-3">
      {/* 左侧:深色品牌展示区(占 2/3) */}
      <aside className="relative hidden flex-col justify-between overflow-hidden bg-neutral-950 px-10 py-12 text-neutral-100 lg:col-span-2 lg:flex xl:px-16">
        {/* 品牌 */}
        <div>
          <h1 className="text-3xl font-light tracking-wide">诺塔智控</h1>
          <p className="mt-1 text-sm font-light tracking-[0.25em] text-neutral-500">
            NOTA CORECONTROL™
          </p>
          <p className="mt-3 text-sm text-neutral-400">美业连锁化智能财务管理系统</p>
        </div>

        {/* 主标语 + 数据 */}
        <div className="space-y-12">
          <div className="flex items-start gap-3">
            <span className="mt-1.5 h-7 w-1 rounded-full bg-primary" aria-hidden />
            <div>
              <h2 className="text-2xl font-semibold tracking-tight">新美业智控领跑者</h2>
              <p className="mt-2 text-sm text-neutral-500">用 AI 让美业达到极限</p>
            </div>
          </div>

          <dl className="grid grid-cols-2 gap-x-8 gap-y-10">
            {STATS.map((s) => (
              <div key={s.label}>
                <dt className="text-4xl font-bold tracking-tight">
                  {s.accent ? (
                    <>
                      {s.value.replace('+', '').replace('%', '')}
                      <span className="text-primary">
                        {s.value.includes('+') ? '+' : ' %'}
                      </span>
                    </>
                  ) : (
                    <>
                      {s.value.replace(/\+/g, '')}
                      {s.value.includes('+') && <span className="text-primary">+</span>}
                    </>
                  )}
                </dt>
                <dd className="mt-1 text-sm text-neutral-500">{s.label}</dd>
              </div>
            ))}
          </dl>
        </div>

        {/* 底部:财务合作客户 */}
        <div className="space-y-5">
          <div className="h-px w-full bg-neutral-800" />
          <div>
            <p className="text-xs uppercase tracking-[0.2em] text-neutral-500">
              财务合作客户
            </p>
            <p className="mt-1.5 text-xs text-neutral-400">
              已为以下连锁品牌提供智能财税托管与多店账务核算服务
            </p>
            <ul className="mt-3 flex flex-wrap gap-2">
              {FINANCE_CLIENTS.map((c) => (
                <li
                  key={c}
                  className="rounded-full border border-neutral-800 bg-neutral-900 px-3 py-1 text-xs text-neutral-300"
                >
                  {c}
                </li>
              ))}
            </ul>
          </div>
          <p className="text-xs text-neutral-600">© 2026 诺塔智控 · NOTA CoreControl™</p>
        </div>
      </aside>

      {/* 右侧:登录表单(占 1/3) */}
      <section className="flex items-center justify-center bg-background px-6 py-10">
        <div className="w-full max-w-xs">
          {/* 移动端品牌头 */}
          <div className="mb-6 lg:hidden">
            <h1 className="text-xl font-light tracking-wide text-foreground">诺塔智控</h1>
            <p className="mt-1 text-[11px] tracking-[0.2em] text-muted-foreground">
              NOTA CORECONTROL™
            </p>
          </div>

          <div className="mb-6">
            <p className="text-xs text-muted-foreground">欢迎回来</p>
            <h2 className="mt-1 text-xl font-semibold tracking-tight text-foreground text-balance">
              登录您的账户
            </h2>
            <p className="mt-1.5 text-xs text-muted-foreground">
              登录您的 NOTA CoreControl™ 账户
            </p>
          </div>

          <form onSubmit={handleSubmit} className="flex flex-col gap-3">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="account" className="text-xs">
                手机号 / 用户名 / 邮箱
              </Label>
              <Input
                id="account"
                name="username"
                type="text"
                value={account}
                onChange={(e) => setAccount(e.target.value)}
                required
                autoComplete="username"
                autoCapitalize="none"
                autoCorrect="off"
                spellCheck={false}
                placeholder="请输入手机号、用户名或邮箱"
                className="h-9 text-sm"
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <Label htmlFor="password" className="text-xs">密码</Label>
              <div className="relative">
                <Input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  minLength={8}
                  autoComplete="current-password"
                  placeholder="至少 8 位字符"
                  className="h-9 pr-9 text-sm"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground transition-colors hover:text-foreground"
                  aria-label={showPassword ? '隐藏密码' : '显示密码'}
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            <div className="flex items-center justify-between text-xs">
              <label className="flex cursor-pointer items-center gap-2 text-foreground">
                <Checkbox
                  checked={remember}
                  onCheckedChange={(v) => setRemember(v === true)}
                />
                记住我
              </label>
              <span className="text-muted-foreground">忘记密码请联系管理员</span>
            </div>

            {error && (
              <p className="text-xs text-destructive" role="alert">
                {error}
              </p>
            )}

            <Button type="submit" disabled={loading} className="h-9 w-full text-sm">
              {loading ? '请稍候...' : '登录'}
            </Button>
          </form>

          <p className="mt-6 text-center text-xs text-muted-foreground">
            首次使用?账号由您的管理员或服务商开通
          </p>

          <p className="mt-2 text-center text-xs text-muted-foreground">
            关联 NOTA CoreControl™ 全智能 SaaS 系统
          </p>
        </div>
      </section>
    </main>
  )
}
