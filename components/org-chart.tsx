'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Plus, Trash2, Users, Building2, Crown } from 'lucide-react'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
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
  addEmployee,
  removeEmployee,
  type OrgChart as OrgChartData,
  type EmployeeRow,
  type JobLevel,
} from '@/app/actions/hr'

const JOB_LEVEL_LABEL: Record<JobLevel, string> = {
  exec: '高管',
  manager: '店长',
  supervisor: '主管',
  staff: '员工',
}

const JOB_LEVEL_BADGE: Record<JobLevel, string> = {
  exec: 'border-primary/30 bg-primary/10 text-primary',
  manager: 'border-chart-2/30 bg-chart-2/10 text-chart-2',
  supervisor: 'border-chart-4/30 bg-chart-4/10 text-chart-4',
  staff: 'border-border bg-muted text-muted-foreground',
}

type EntityOption = { id: number; name: string }

export function OrgChart({
  chart,
  entities,
  canEdit,
}: {
  chart: OrgChartData
  entities: EntityOption[]
  canEdit: boolean
}) {
  const router = useRouter()

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap gap-3">
          <StatChip icon={<Users className="size-4" />} label="在职员工" value={chart.totalActive} />
          <StatChip
            icon={<Building2 className="size-4" />}
            label="门店"
            value={chart.entities.length}
          />
          <StatChip
            icon={<Crown className="size-4" />}
            label="集团高管"
            value={chart.groupEmployees.length}
          />
        </div>
        {canEdit && <AddEmployeeDialog entities={entities} onDone={() => router.refresh()} />}
      </div>

      {/* 组织架构树状图 */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">组织架构</CardTitle>
          <CardDescription>集团总部 → 门店 → 岗位人员的层级关系</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col items-center">
            {/* 集团总部根节点 */}
            <div className="flex flex-col items-center gap-1 rounded-lg border-2 border-primary/40 bg-primary/5 px-6 py-3">
              <span className="flex items-center gap-2 font-semibold text-foreground">
                <Building2 className="size-4 text-primary" />
                {chart.groupName}
              </span>
              {chart.groupEmployees.length > 0 && (
                <div className="mt-1 flex flex-wrap justify-center gap-1.5">
                  {chart.groupEmployees.map((e) => (
                    <PersonPill key={e.id} emp={e} />
                  ))}
                </div>
              )}
            </div>

            {chart.entities.length > 0 && (
              <>
                {/* 连接竖线 */}
                <div className="h-6 w-px bg-border" />
                {/* 门店节点横向排列 */}
                <div className="flex w-full flex-wrap justify-center gap-4">
                  {chart.entities.map((node) => (
                    <div
                      key={node.entityId}
                      className="flex min-w-56 flex-1 flex-col rounded-lg border bg-card"
                    >
                      <div className="flex items-center gap-2 border-b bg-muted/40 px-4 py-2.5">
                        <Building2 className="size-4 text-muted-foreground" />
                        <span className="font-medium text-foreground">{node.entityName}</span>
                        <Badge variant="secondary" className="ml-auto tabular-nums">
                          {node.employees.length} 人
                        </Badge>
                      </div>
                      <div className="flex flex-col gap-2 p-3">
                        {node.employees.length === 0 ? (
                          <p className="py-3 text-center text-xs text-muted-foreground">
                            暂无在职员工
                          </p>
                        ) : (
                          node.employees.map((e) => (
                            <EmployeeCard
                              key={e.id}
                              emp={e}
                              canEdit={canEdit}
                              onDone={() => router.refresh()}
                            />
                          ))
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>
        </CardContent>
      </Card>

      {/* 集团高管台账(仅集团端,有数据时) */}
      {chart.groupEmployees.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">集团高管</CardTitle>
            <CardDescription>不隶属单一门店的集团层人员</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex flex-col gap-2">
              {chart.groupEmployees.map((e) => (
                <EmployeeCard
                  key={e.id}
                  emp={e}
                  canEdit={canEdit}
                  onDone={() => router.refresh()}
                  showLevel
                />
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}

function StatChip({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode
  label: string
  value: number
}) {
  return (
    <div className="flex items-center gap-2 rounded-lg border bg-card px-3 py-2">
      <span className="flex size-8 items-center justify-center rounded-md bg-muted text-muted-foreground">
        {icon}
      </span>
      <div className="flex flex-col">
        <span className="text-lg font-semibold leading-none tabular-nums text-foreground">
          {value}
        </span>
        <span className="text-xs text-muted-foreground">{label}</span>
      </div>
    </div>
  )
}

function PersonPill({ emp }: { emp: EmployeeRow }) {
  return (
    <span className="inline-flex items-center gap-1 rounded-full border bg-card px-2.5 py-0.5 text-xs">
      <span className="font-medium text-foreground">{emp.name}</span>
      <span className="text-muted-foreground">{emp.position ?? JOB_LEVEL_LABEL[emp.jobLevel]}</span>
    </span>
  )
}

function EmployeeCard({
  emp,
  canEdit,
  onDone,
  showLevel = false,
}: {
  emp: EmployeeRow
  canEdit: boolean
  onDone: () => void
  showLevel?: boolean
}) {
  return (
    <div className="flex items-center gap-3 rounded-md border bg-background px-3 py-2">
      <div className="flex min-w-0 flex-col">
        <div className="flex items-center gap-2">
          <span className="truncate font-medium text-foreground">{emp.name}</span>
          <Badge variant="outline" className={JOB_LEVEL_BADGE[emp.jobLevel]}>
            {JOB_LEVEL_LABEL[emp.jobLevel]}
          </Badge>
        </div>
        <span className="truncate text-xs text-muted-foreground">
          {emp.position ?? '—'}
          {emp.phone ? ` · ${emp.phone}` : ''}
          {emp.hireDate ? ` · 入职 ${emp.hireDate}` : ''}
        </span>
      </div>
      {canEdit && <RemoveButton id={emp.id} onDone={onDone} />}
    </div>
  )
}

function RemoveButton({ id, onDone }: { id: number; onDone: () => void }) {
  const [pending, startTransition] = useTransition()
  return (
    <Button
      size="icon"
      variant="ghost"
      className="ml-auto size-7 shrink-0 text-muted-foreground hover:text-destructive"
      disabled={pending}
      onClick={() =>
        startTransition(async () => {
          await removeEmployee(id)
          onDone()
        })
      }
      aria-label="删除员工"
    >
      <Trash2 className="size-4" />
    </Button>
  )
}

function AddEmployeeDialog({
  entities,
  onDone,
}: {
  entities: EntityOption[]
  onDone: () => void
}) {
  const [open, setOpen] = useState(false)
  const [pending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const [form, setForm] = useState({
    level: 'entity' as 'group' | 'entity',
    entityId: entities[0]?.id ? String(entities[0].id) : '',
    name: '',
    position: '',
    jobLevel: 'staff' as JobLevel,
    phone: '',
    hireDate: '',
  })

  function update<K extends keyof typeof form>(k: K, v: (typeof form)[K]) {
    setForm((f) => ({ ...f, [k]: v }))
  }

  function submit() {
    setError(null)
    startTransition(async () => {
      const res = await addEmployee({
        level: form.level,
        entityId: form.level === 'entity' ? Number(form.entityId) : undefined,
        name: form.name,
        position: form.position,
        jobLevel: form.jobLevel,
        phone: form.phone,
        hireDate: form.hireDate || undefined,
      })
      if (!res.ok) {
        setError(res.error)
        return
      }
      setForm({
        level: 'entity',
        entityId: entities[0]?.id ? String(entities[0].id) : '',
        name: '',
        position: '',
        jobLevel: 'staff',
        phone: '',
        hireDate: '',
      })
      setOpen(false)
      onDone()
    })
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm">
          <Plus className="size-4" />
          添加员工
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>添加员工</DialogTitle>
          <DialogDescription>员工主数据将贯穿组织架构、工资与股权</DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-2">
          <div className="grid gap-2">
            <Label>归属层级</Label>
            <Select
              value={form.level}
              onValueChange={(v) => update('level', v as 'group' | 'entity')}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="entity">门店员工</SelectItem>
                <SelectItem value="group">集团高管</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {form.level === 'entity' && (
            <div className="grid gap-2">
              <Label>所属门店</Label>
              <Select value={form.entityId} onValueChange={(v) => update('entityId', v)}>
                <SelectTrigger>
                  <SelectValue placeholder="选择门店" />
                </SelectTrigger>
                <SelectContent>
                  {entities.map((e) => (
                    <SelectItem key={e.id} value={String(e.id)}>
                      {e.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <div className="grid gap-2">
              <Label htmlFor="emp-name">姓名</Label>
              <Input
                id="emp-name"
                value={form.name}
                onChange={(e) => update('name', e.target.value)}
                placeholder="张三"
              />
            </div>
            <div className="grid gap-2">
              <Label>职级</Label>
              <Select
                value={form.jobLevel}
                onValueChange={(v) => update('jobLevel', v as JobLevel)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {form.level === 'group' && <SelectItem value="exec">高管</SelectItem>}
                  <SelectItem value="manager">店长</SelectItem>
                  <SelectItem value="supervisor">主管</SelectItem>
                  <SelectItem value="staff">员工</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid gap-2">
            <Label htmlFor="emp-position">岗位</Label>
            <Input
              id="emp-position"
              value={form.position}
              onChange={(e) => update('position', e.target.value)}
              placeholder="美容顾问 / 技师 / 运营总监"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="grid gap-2">
              <Label htmlFor="emp-phone">手机号</Label>
              <Input
                id="emp-phone"
                value={form.phone}
                onChange={(e) => update('phone', e.target.value)}
                placeholder="选填"
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="emp-hire">入职日期</Label>
              <Input
                id="emp-hire"
                type="date"
                value={form.hireDate}
                onChange={(e) => update('hireDate', e.target.value)}
              />
            </div>
          </div>

          {error && <p className="text-sm text-destructive">{error}</p>}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)} disabled={pending}>
            取消
          </Button>
          <Button onClick={submit} disabled={pending}>
            {pending ? '保存中...' : '保存'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
