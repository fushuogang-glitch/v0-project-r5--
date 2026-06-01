'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { UserPlus, Smartphone, KeyRound, User } from 'lucide-react'
import { createStoreAccount } from '@/app/actions/org'
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

type StoreUser = { id: string; name: string; loginId: string }

export function StoreAccountManager({
  entityId,
  entityName,
  accounts,
}: {
  entityId: number
  entityName: string
  accounts: StoreUser[]
}) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [name, setName] = useState('')
  const [account, setAccount] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()

  const submit = (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    startTransition(async () => {
      const res = await createStoreAccount({ entityId, name, account, password })
      if (!res.ok) {
        setError(res.error)
        return
      }
      setName('')
      setAccount('')
      setPassword('')
      setOpen(false)
      router.refresh()
    })
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          {accounts.length > 0
            ? `已绑定 ${accounts.length} 个门店登录账号`
            : '该门店还没有独立登录账号'}
        </p>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button size="sm" className="gap-1.5">
              <UserPlus className="size-4" />
              新建门店账号
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>为门店创建登录账号</DialogTitle>
              <DialogDescription>
                该账号登录后只能查看 {entityName} 的数据(门店端)。
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={submit} className="flex flex-col gap-4">
              <div className="flex flex-col gap-2">
                <Label htmlFor="sa-name">姓名 / 称呼</Label>
                <div className="relative">
                  <User className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    id="sa-name"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    required
                    className="pl-9"
                    placeholder="如:门店店长"
                  />
                </div>
              </div>
              <div className="flex flex-col gap-2">
                <Label htmlFor="sa-account">登录账号(手机号 / 用户名)</Label>
                <div className="relative">
                  <Smartphone className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    id="sa-account"
                    type="text"
                    value={account}
                    onChange={(e) => setAccount(e.target.value)}
                    required
                    autoCapitalize="none"
                    autoCorrect="off"
                    spellCheck={false}
                    className="pl-9"
                    placeholder="如:13800138000 或 store_wuhan"
                  />
                </div>
              </div>
              <div className="flex flex-col gap-2">
                <Label htmlFor="sa-pwd">初始密码</Label>
                <div className="relative">
                  <KeyRound className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    id="sa-pwd"
                    type="text"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    minLength={8}
                    className="pl-9"
                    placeholder="至少 8 位"
                  />
                </div>
              </div>
              {error && (
                <p className="text-sm text-destructive" role="alert">
                  {error}
                </p>
              )}
              <DialogFooter>
                <Button type="submit" disabled={pending} className="w-full">
                  {pending ? '创建中...' : '创建账号'}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {accounts.length > 0 && (
        <ul className="divide-y divide-border rounded-lg border border-border">
          {accounts.map((u) => (
            <li key={u.id} className="flex items-center justify-between gap-3 px-4 py-3">
              <div className="flex flex-col leading-tight">
                <span className="text-sm font-medium text-foreground">{u.name}</span>
                <span className="text-xs text-muted-foreground">{u.loginId}</span>
              </div>
              <span className="rounded-full bg-accent px-2.5 py-1 text-xs font-medium text-accent-foreground">
                门店端
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
