'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Plus, Loader2, Trash2, ShieldCheck } from 'lucide-react'
import {
  createFinanceStaff,
  removeFinanceStaff,
  type FinanceStaff,
} from '@/app/actions/finance-staff'
import { FINANCE_ROLES, financeRoleDef, type FinanceRole } from '@/lib/finance-roles'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'

export function FinanceStaffManager({ staff }: { staff: FinanceStaff[] }) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [pending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const [form, setForm] = useState({
    name: '',
    email: '',
    password: '',
    financeRole: 'cashier' as FinanceRole,
  })

  function update<K extends keyof typeof form>(k: K, v: (typeof form)[K]) {
    setForm((f) => ({ ...f, [k]: v }))
  }

  function submit() {
    setError(null)
    if (!form.name.trim() || !form.email.trim()) {
      setError('请填写姓名与邮箱')
      return
    }
    startTransition(async () => {
      const res = await createFinanceStaff(form)
      if (!res.ok) {
        setError(res.error)
        return
      }
      setForm({ name: '', email: '', password: '', financeRole: 'cashier' })
      setOpen(false)
      router.refresh()
    })
  }

  function remove(id: string) {
    startTransition(async () => {
      await removeFinanceStaff(id)
      router.refresh()
    })
  }

  const activeDef = financeRoleDef(form.financeRole)

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h3 className="flex items-center gap-2 text-sm font-semibold text-foreground">
            <ShieldCheck className="size-4 text-primary" />
            财务团队成员
          </h3>
          <p className="mt-1 text-sm text-muted-foreground">
            出纳、会计、审计、税务专员可各自登录,按岗位职责访问对应模块,配合月度自动审计。
          </p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button size="sm" className="shrink-0">
              <Plus className="size-4" />
              新增成员
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>新增财务成员</DialogTitle>
              <DialogDescription>
                为财务团队创建一个可登录的子账号,并指定岗位角色。
              </DialogDescription>
            </DialogHeader>
            <div className="flex flex-col gap-4 py-2">
              <div className="grid gap-2">
                <Label htmlFor="fs-role">岗位角色</Label>
                <Select
                  value={form.financeRole}
                  onValueChange={(v) => update('financeRole', v as FinanceRole)}
                >
                  <SelectTrigger id="fs-role">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {FINANCE_ROLES.map((r) => (
                      <SelectItem key={r.value} value={r.value}>
                        {r.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {activeDef && (
                  <p className="text-xs text-muted-foreground">{activeDef.duty}</p>
                )}
              </div>
              <div className="grid gap-2">
                <Label htmlFor="fs-name">姓名</Label>
                <Input
                  id="fs-name"
                  value={form.name}
                  onChange={(e) => update('name', e.target.value)}
                  placeholder="如:张会计"
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="fs-email">登录邮箱</Label>
                <Input
                  id="fs-email"
                  type="email"
                  value={form.email}
                  onChange={(e) => update('email', e.target.value)}
                  placeholder="staff@company.com"
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="fs-pwd">初始密码</Label>
                <Input
                  id="fs-pwd"
                  type="password"
                  value={form.password}
                  onChange={(e) => update('password', e.target.value)}
                  placeholder="至少 8 位"
                />
              </div>
              {error && <p className="text-sm text-destructive">{error}</p>}
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setOpen(false)} disabled={pending}>
                取消
              </Button>
              <Button onClick={submit} disabled={pending}>
                {pending && <Loader2 className="size-4 animate-spin" />}
                创建账号
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {staff.length === 0 ? (
        <div className="rounded-lg border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
          还没有财务成员。点击「新增成员」创建出纳、会计、审计或税务专员账号。
        </div>
      ) : (
        <div className="rounded-lg border border-border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>姓名</TableHead>
                <TableHead>岗位</TableHead>
                <TableHead>登录邮箱</TableHead>
                <TableHead className="w-16 text-right">操作</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {staff.map((s) => {
                const def = financeRoleDef(s.financeRole)
                return (
                  <TableRow key={s.id}>
                    <TableCell className="font-medium text-foreground">{s.name}</TableCell>
                    <TableCell>
                      <Badge variant="secondary" className="font-normal">
                        {def?.label ?? s.financeRole}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-muted-foreground">{s.email}</TableCell>
                    <TableCell className="text-right">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="size-8 text-muted-foreground hover:text-destructive"
                        onClick={() => remove(s.id)}
                        disabled={pending}
                        aria-label="删除成员"
                      >
                        <Trash2 className="size-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                )
              })}
            </TableBody>
          </Table>
        </div>
      )}

      <div className="rounded-lg border border-border bg-muted/40 p-4">
        <p className="text-xs font-medium text-foreground">岗位职责一览</p>
        <ul className="mt-2 flex flex-col gap-1.5">
          {FINANCE_ROLES.map((r) => (
            <li key={r.value} className="flex gap-2 text-xs text-muted-foreground">
              <span className="min-w-12 font-medium text-foreground">{r.label}</span>
              <span>{r.duty}</span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  )
}
