'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Plus, Trash2, Users, Building2, Network, Settings2, X } from 'lucide-react'
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
  addDepartment,
  removeDepartment,
  addPosition,
  removePosition,
  setEntityDepartment,
  type OrgChart as OrgChartData,
  type OrgEntityNode,
  type EmployeeRow,
  type JobLevel,
  type DeptItem,
  type PositionItem,
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

type EntityOption = { id: number; name: string; departmentId: number | null }

export function OrgChart({
  chart,
  entities,
  departments,
  positions,
  canEdit,
}: {
  chart: OrgChartData
  entities: EntityOption[]
  departments: DeptItem[]
  positions: PositionItem[]
  canEdit: boolean
}) {
  const router = useRouter()
  const refresh = () => router.refresh()

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap gap-3">
          <StatChip icon={<Users className="size-4" />} label="在职员工" value={chart.totalActive} />
          <StatChip icon={<Network className="size-4" />} label="中控部门" value={chart.deptCount} />
          <StatChip icon={<Building2 className="size-4" />} label="门店" value={chart.entityCount} />
        </div>
        {canEdit && (
          <div className="flex flex-wrap gap-2">
            <ManageDeptDialog departments={departments} onDone={refresh} />
            <ManagePositionDialog positions={positions} onDone={refresh} />
            <AddEmployeeDialog
              entities={entities}
              departments={departments}
              positions={positions}
              onDone={refresh}
            />
          </div>
        )}
      </div>

      {departments.length === 0 && canEdit && (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center gap-2 py-8 text-center">
            <Network className="size-8 text-muted-foreground" />
            <p className="text-sm text-muted-foreground">
              还没有中控部门。先点击「管理部门」添加运营中心、财务中心等,再把门店挂到部门下。
            </p>
          </CardContent>
        </Card>
      )}

      {/* 组织架构树:集团 → 部门 → 门店 → 岗位人员 */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">组织架构</CardTitle>
          <CardDescription>集团总部 → 中控部门 → 门店 → 岗位人员的层级关系</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col items-center">
            {/* 集团总部根节点 */}
            <div className="flex flex-col items-center gap-1 rounded-lg border-2 border-primary/40 bg-primary/5 px-6 py-3">
              <span className="flex items-center gap-2 font-semibold text-foreground">
                <Building2 className="size-4 text-primary" />
                {chart.groupName}
              </span>
            </div>

            {(chart.departments.length > 0 || chart.unassignedEntities.length > 0) && (
              <div className="h-6 w-px bg-border" />
            )}

            {/* 部门节点横向排列 */}
            <div className="flex w-full flex-wrap justify-center gap-4">
              {chart.departments.map((dept) => (
                <div
                  key={dept.departmentId}
                  className="flex min-w-72 flex-1 flex-col rounded-lg border bg-card"
                >
                  <div className="flex items-center gap-2 border-b bg-primary/5 px-4 py-2.5">
                    <Network className="size-4 text-primary" />
                    <span className="font-semibold text-foreground">{dept.departmentName}</span>
                    <Badge variant="secondary" className="ml-auto tabular-nums">
                      {dept.entities.length} 店
                    </Badge>
                  </div>
                  <div className="flex flex-col gap-3 p-3">
                    {/* 部门直属(集团层)员工 */}
                    {dept.deptEmployees.length > 0 && (
                      <div className="flex flex-wrap gap-1.5">
                        {dept.deptEmployees.map((e) => (
                          <PersonPill
                            key={e.id}
                            emp={e}
                            canEdit={canEdit}
                            onDone={refresh}
                          />
                        ))}
                      </div>
                    )}
                    {/* 门店 */}
                    {dept.entities.length === 0 ? (
                      <p className="py-3 text-center text-xs text-muted-foreground">
                        暂无门店挂在该部门下
                      </p>
                    ) : (
                      dept.entities.map((node) => (
                        <StoreNode
                          key={node.entityId}
                          node={node}
                          departments={departments}
                          currentDeptId={dept.departmentId}
                          canEdit={canEdit}
                          onDone={refresh}
                        />
                      ))
                    )}
                  </div>
                </div>
              ))}

              {/* 未归属部门的门店 */}
              {chart.unassignedEntities.length > 0 && (
                <div className="flex min-w-72 flex-1 flex-col rounded-lg border border-dashed bg-card">
                  <div className="flex items-center gap-2 border-b bg-muted/40 px-4 py-2.5">
                    <Building2 className="size-4 text-muted-foreground" />
                    <span className="font-medium text-muted-foreground">未归属部门</span>
                    <Badge variant="outline" className="ml-auto tabular-nums">
                      {chart.unassignedEntities.length} 店
                    </Badge>
                  </div>
                  <div className="flex flex-col gap-3 p-3">
                    {chart.unassignedEntities.map((node) => (
                      <StoreNode
                        key={node.entityId}
                        node={node}
                        departments={departments}
                        currentDeptId={null}
                        canEdit={canEdit}
                        onDone={refresh}
                      />
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* 未归属部门的集团员工 */}
      {chart.unassignedGroup.length > 0 && (
        <Card className="border-dashed">
          <CardHeader>
            <CardTitle className="text-base">未归属部门的集团员工</CardTitle>
            <CardDescription>删除部门后这些集团层员工暂未重新归属</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2">
              {chart.unassignedGroup.map((e) => (
                <PersonPill key={e.id} emp={e} canEdit={canEdit} onDone={refresh} />
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}

function StoreNode({
  node,
  departments,
  currentDeptId,
  canEdit,
  onDone,
}: {
  node: OrgEntityNode
  departments: DeptItem[]
  currentDeptId: number | null
  canEdit: boolean
  onDone: () => void
}) {
  const [pending, startTransition] = useTransition()

  return (
    <div className="flex flex-col rounded-md border bg-background">
      <div className="flex items-center gap-2 border-b px-3 py-2">
        <Building2 className="size-4 text-muted-foreground" />
        <span className="font-medium text-foreground">{node.entityName}</span>
        <Badge variant="secondary" className="ml-auto tabular-nums">
          {node.employees.length} 人
        </Badge>
      </div>
      {canEdit && (
        <div className="flex items-center gap-2 border-b px-3 py-2">
          <span className="text-xs text-muted-foreground">归属部门</span>
          <Select
            value={currentDeptId != null ? String(currentDeptId) : 'none'}
            onValueChange={(v) =>
              startTransition(async () => {
                await setEntityDepartment(node.entityId, v === 'none' ? null : Number(v))
                onDone()
              })
            }
            disabled={pending}
          >
            <SelectTrigger className="h-7 flex-1 text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="none">未归属</SelectItem>
              {departments.map((d) => (
                <SelectItem key={d.id} value={String(d.id)}>
                  {d.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}
      <div className="flex flex-col gap-1.5 p-2.5">
        {node.employees.length === 0 ? (
          <p className="py-2 text-center text-xs text-muted-foreground">暂无在职员工</p>
        ) : (
          node.employees.map((e) => (
            <EmployeeRowItem key={e.id} emp={e} canEdit={canEdit} onDone={onDone} />
          ))
        )}
      </div>
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

function PersonPill({
  emp,
  canEdit,
  onDone,
}: {
  emp: EmployeeRow
  canEdit: boolean
  onDone: () => void
}) {
  const [pending, startTransition] = useTransition()
  return (
    <span className="inline-flex items-center gap-1 rounded-full border bg-card py-0.5 pl-2.5 pr-1 text-xs">
      <span className="font-medium text-foreground">{emp.name}</span>
      <span className="text-muted-foreground">{emp.position ?? JOB_LEVEL_LABEL[emp.jobLevel]}</span>
      {canEdit && (
        <button
          type="button"
          className="flex size-4 items-center justify-center rounded-full text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
          disabled={pending}
          onClick={() =>
            startTransition(async () => {
              await removeEmployee(emp.id)
              onDone()
            })
          }
          aria-label={`移除 ${emp.name}`}
        >
          <X className="size-3" />
        </button>
      )}
    </span>
  )
}

function EmployeeRowItem({
  emp,
  canEdit,
  onDone,
}: {
  emp: EmployeeRow
  canEdit: boolean
  onDone: () => void
}) {
  return (
    <div className="flex items-center gap-2 rounded-md border bg-card px-2.5 py-1.5">
      <div className="flex min-w-0 flex-col">
        <div className="flex items-center gap-2">
          <span className="truncate text-sm font-medium text-foreground">{emp.name}</span>
          <Badge variant="outline" className={JOB_LEVEL_BADGE[emp.jobLevel]}>
            {emp.position ?? JOB_LEVEL_LABEL[emp.jobLevel]}
          </Badge>
        </div>
        {(emp.phone || emp.hireDate) && (
          <span className="truncate text-xs text-muted-foreground">
            {emp.phone ?? ''}
            {emp.phone && emp.hireDate ? ' · ' : ''}
            {emp.hireDate ? `入职 ${emp.hireDate}` : ''}
          </span>
        )}
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

// ---------------------------------------------------------------------------
// 部门管理
// ---------------------------------------------------------------------------
function ManageDeptDialog({
  departments,
  onDone,
}: {
  departments: DeptItem[]
  onDone: () => void
}) {
  const [open, setOpen] = useState(false)
  const [name, setName] = useState('')
  const [pending, startTransition] = useTransition()
  const presets = ['运营中心', '财务中心', '人力中心', '市场中心', '供应链中心']
  const existing = new Set(departments.map((d) => d.name))

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" variant="outline">
          <Network className="size-4" />
          管理部门
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>中控部门管理</DialogTitle>
          <DialogDescription>集团中控由多个部门组合,门店挂在部门下</DialogDescription>
        </DialogHeader>
        <div className="flex flex-col gap-4 py-2">
          <div className="flex flex-col gap-2">
            {departments.length === 0 ? (
              <p className="py-2 text-center text-sm text-muted-foreground">暂无部门</p>
            ) : (
              departments.map((d) => (
                <div
                  key={d.id}
                  className="flex items-center gap-2 rounded-md border bg-card px-3 py-2"
                >
                  <Network className="size-4 text-primary" />
                  <span className="text-sm font-medium text-foreground">{d.name}</span>
                  <Button
                    size="icon"
                    variant="ghost"
                    className="ml-auto size-7 text-muted-foreground hover:text-destructive"
                    disabled={pending}
                    onClick={() =>
                      startTransition(async () => {
                        await removeDepartment(d.id)
                        onDone()
                      })
                    }
                    aria-label={`删除 ${d.name}`}
                  >
                    <Trash2 className="size-4" />
                  </Button>
                </div>
              ))
            )}
          </div>

          <div className="flex flex-wrap gap-1.5">
            {presets
              .filter((p) => !existing.has(p))
              .map((p) => (
                <Button
                  key={p}
                  size="sm"
                  variant="secondary"
                  className="h-7"
                  disabled={pending}
                  onClick={() =>
                    startTransition(async () => {
                      await addDepartment(p)
                      onDone()
                    })
                  }
                >
                  <Plus className="size-3" />
                  {p}
                </Button>
              ))}
          </div>

          <div className="flex items-end gap-2">
            <div className="grid flex-1 gap-2">
              <Label htmlFor="dept-name">新增部门</Label>
              <Input
                id="dept-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="自定义部门名称"
              />
            </div>
            <Button
              disabled={pending || !name.trim()}
              onClick={() =>
                startTransition(async () => {
                  const res = await addDepartment(name)
                  if (res.ok) {
                    setName('')
                    onDone()
                  }
                })
              }
            >
              添加
            </Button>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>
            完成
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// ---------------------------------------------------------------------------
// 岗位管理
// ---------------------------------------------------------------------------
function ManagePositionDialog({
  positions,
  onDone,
}: {
  positions: PositionItem[]
  onDone: () => void
}) {
  const [open, setOpen] = useState(false)
  const [name, setName] = useState('')
  const [pending, startTransition] = useTransition()
  const presets = ['店长', '顾问', '美容师', '前台', '阿姨', '医生', '护士']
  const existing = new Set(positions.map((p) => p.name))

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" variant="outline">
          <Settings2 className="size-4" />
          管理岗位
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>门店岗位管理</DialogTitle>
          <DialogDescription>店长、顾问、美容师、前台、阿姨、医生、护士等,可自由增减</DialogDescription>
        </DialogHeader>
        <div className="flex flex-col gap-4 py-2">
          <div className="flex flex-wrap gap-1.5">
            {positions.length === 0 ? (
              <p className="py-2 text-center text-sm text-muted-foreground">暂无岗位</p>
            ) : (
              positions.map((p) => (
                <span
                  key={p.id}
                  className="inline-flex items-center gap-1 rounded-full border bg-card py-1 pl-3 pr-1 text-sm"
                >
                  <span className="text-foreground">{p.name}</span>
                  <button
                    type="button"
                    className="flex size-4 items-center justify-center rounded-full text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                    disabled={pending}
                    onClick={() =>
                      startTransition(async () => {
                        await removePosition(p.id)
                        onDone()
                      })
                    }
                    aria-label={`删除 ${p.name}`}
                  >
                    <X className="size-3" />
                  </button>
                </span>
              ))
            )}
          </div>

          <div className="flex flex-wrap gap-1.5">
            {presets
              .filter((p) => !existing.has(p))
              .map((p) => (
                <Button
                  key={p}
                  size="sm"
                  variant="secondary"
                  className="h-7"
                  disabled={pending}
                  onClick={() =>
                    startTransition(async () => {
                      await addPosition(p)
                      onDone()
                    })
                  }
                >
                  <Plus className="size-3" />
                  {p}
                </Button>
              ))}
          </div>

          <div className="flex items-end gap-2">
            <div className="grid flex-1 gap-2">
              <Label htmlFor="pos-name">新增岗位</Label>
              <Input
                id="pos-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="自定义岗位名称"
              />
            </div>
            <Button
              disabled={pending || !name.trim()}
              onClick={() =>
                startTransition(async () => {
                  const res = await addPosition(name)
                  if (res.ok) {
                    setName('')
                    onDone()
                  }
                })
              }
            >
              添加
            </Button>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>
            完成
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// ---------------------------------------------------------------------------
// 添加员工
// ---------------------------------------------------------------------------
function AddEmployeeDialog({
  entities,
  departments,
  positions,
  onDone,
}: {
  entities: EntityOption[]
  departments: DeptItem[]
  positions: PositionItem[]
  onDone: () => void
}) {
  const [open, setOpen] = useState(false)
  const [pending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const [form, setForm] = useState({
    level: 'entity' as 'group' | 'entity',
    entityId: entities[0]?.id ? String(entities[0].id) : '',
    departmentId: departments[0]?.id ? String(departments[0].id) : '',
    name: '',
    position: positions[0]?.name ?? '',
    jobLevel: 'staff' as JobLevel,
    phone: '',
    hireDate: '',
  })

  function update<K extends keyof typeof form>(k: K, v: (typeof form)[K]) {
    setForm((f) => ({ ...f, [k]: v }))
  }

  function reset() {
    setForm({
      level: 'entity',
      entityId: entities[0]?.id ? String(entities[0].id) : '',
      departmentId: departments[0]?.id ? String(departments[0].id) : '',
      name: '',
      position: positions[0]?.name ?? '',
      jobLevel: 'staff',
      phone: '',
      hireDate: '',
    })
  }

  function submit() {
    setError(null)
    startTransition(async () => {
      const res = await addEmployee({
        level: form.level,
        entityId: form.level === 'entity' ? Number(form.entityId) : undefined,
        departmentId: form.level === 'group' ? Number(form.departmentId) : undefined,
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
      reset()
      setOpen(false)
      onDone()
    })
  }

  const noStore = entities.length === 0
  const noDept = departments.length === 0

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
                <SelectItem value="group">中控部门员工</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {form.level === 'entity' ? (
            <>
              <div className="grid gap-2">
                <Label>所属门店</Label>
                <Select value={form.entityId} onValueChange={(v) => update('entityId', v)}>
                  <SelectTrigger>
                    <SelectValue placeholder={noStore ? '暂无门店' : '选择门店'} />
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
              <div className="grid gap-2">
                <Label>岗位</Label>
                {positions.length === 0 ? (
                  <p className="text-xs text-muted-foreground">
                    请先在「管理岗位」中添加店长、顾问、美容师等岗位
                  </p>
                ) : (
                  <Select value={form.position} onValueChange={(v) => update('position', v)}>
                    <SelectTrigger>
                      <SelectValue placeholder="选择岗位" />
                    </SelectTrigger>
                    <SelectContent>
                      {positions.map((p) => (
                        <SelectItem key={p.id} value={p.name}>
                          {p.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              </div>
            </>
          ) : (
            <>
              <div className="grid gap-2">
                <Label>所属部门</Label>
                <Select value={form.departmentId} onValueChange={(v) => update('departmentId', v)}>
                  <SelectTrigger>
                    <SelectValue placeholder={noDept ? '暂无部门' : '选择部门'} />
                  </SelectTrigger>
                  <SelectContent>
                    {departments.map((d) => (
                      <SelectItem key={d.id} value={String(d.id)}>
                        {d.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-2">
                <Label htmlFor="emp-position">岗位 / 职务</Label>
                <Input
                  id="emp-position"
                  value={form.position}
                  onChange={(e) => update('position', e.target.value)}
                  placeholder="运营总监 / 财务经理"
                />
              </div>
            </>
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
              <Select value={form.jobLevel} onValueChange={(v) => update('jobLevel', v as JobLevel)}>
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
