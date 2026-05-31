'use server'

import { db } from '@/lib/db'
import { employees, entities } from '@/lib/db/schema'
import { getScope } from '@/lib/scope'
import { and, eq, asc } from 'drizzle-orm'
import { revalidatePath } from 'next/cache'

export type JobLevel = 'exec' | 'manager' | 'supervisor' | 'staff'

export type EmployeeRow = {
  id: number
  level: 'group' | 'entity'
  entityId: number | null
  name: string
  position: string | null
  jobLevel: JobLevel
  managerId: number | null
  phone: string | null
  hireDate: string | null
  status: string
}

export type OrgEntityNode = {
  entityId: number
  entityName: string
  employees: EmployeeRow[]
}

export type OrgChart = {
  groupName: string
  groupEmployees: EmployeeRow[] // 集团层(高管)
  entities: OrgEntityNode[]
  totalActive: number
}

function toRow(e: typeof employees.$inferSelect): EmployeeRow {
  return {
    id: e.id,
    level: e.level === 'group' ? 'group' : 'entity',
    entityId: e.entityId,
    name: e.name,
    position: e.position,
    jobLevel: (e.jobLevel as JobLevel) ?? 'staff',
    managerId: e.managerId,
    phone: e.phone,
    hireDate: e.hireDate,
    status: e.status,
  }
}

/** 获取整个集团的组织架构(集团层 + 各门店分组) */
export async function getOrgChart(): Promise<OrgChart> {
  const scope = await getScope()

  const entList = await db
    .select({ id: entities.id, name: entities.name, code: entities.code })
    .from(entities)
    .where(eq(entities.userId, scope.ownerId))
    .orderBy(entities.code)

  const empWhere =
    scope.role === 'store' && scope.entityId != null
      ? and(eq(employees.userId, scope.ownerId), eq(employees.entityId, scope.entityId))
      : eq(employees.userId, scope.ownerId)

  const empList = await db
    .select()
    .from(employees)
    .where(empWhere)
    .orderBy(asc(employees.jobLevel), asc(employees.id))

  const rows = empList.map(toRow)
  const active = rows.filter((r) => r.status === 'active')

  // 门店端只看自己门店
  const visibleEntities =
    scope.role === 'store' && scope.entityId != null
      ? entList.filter((e) => e.id === scope.entityId)
      : entList

  const entityNodes: OrgEntityNode[] = visibleEntities.map((e) => ({
    entityId: e.id,
    entityName: e.name,
    employees: active.filter((r) => r.level === 'entity' && r.entityId === e.id),
  }))

  return {
    groupName: '集团总部',
    groupEmployees: scope.role === 'store' ? [] : active.filter((r) => r.level === 'group'),
    entities: entityNodes,
    totalActive: active.length,
  }
}

/** 门店端可选的上级 / 集团端管理用:返回扁平员工列表 */
export async function listEmployees(): Promise<EmployeeRow[]> {
  const scope = await getScope()
  const where =
    scope.role === 'store' && scope.entityId != null
      ? and(eq(employees.userId, scope.ownerId), eq(employees.entityId, scope.entityId))
      : eq(employees.userId, scope.ownerId)
  const list = await db.select().from(employees).where(where).orderBy(asc(employees.id))
  return list.map(toRow)
}

export type AddEmployeeResult = { ok: true } | { ok: false; error: string }

/** 新增员工 */
export async function addEmployee(input: {
  level?: 'group' | 'entity'
  entityId?: number
  name: string
  position?: string
  jobLevel: JobLevel
  managerId?: number | null
  phone?: string
  hireDate?: string
}): Promise<AddEmployeeResult> {
  const scope = await getScope()
  if (scope.role !== 'group') {
    return { ok: false, error: '只有集团管理员可以管理人力架构' }
  }
  if (!input.name.trim()) return { ok: false, error: '请填写员工姓名' }

  const level = input.level ?? 'entity'
  let entityId: number | null = null
  if (level === 'entity') {
    if (!input.entityId) return { ok: false, error: '请选择所属门店' }
    const [e] = await db
      .select({ id: entities.id })
      .from(entities)
      .where(and(eq(entities.id, input.entityId), eq(entities.userId, scope.ownerId)))
      .limit(1)
    if (!e) return { ok: false, error: '门店不存在或无权操作' }
    entityId = input.entityId
  }

  await db.insert(employees).values({
    userId: scope.ownerId,
    level,
    entityId,
    name: input.name.trim(),
    position: input.position?.trim() || null,
    jobLevel: input.jobLevel,
    managerId: input.managerId ?? null,
    phone: input.phone?.trim() || null,
    hireDate: input.hireDate || null,
    status: 'active',
  })

  revalidatePath('/org')
  return { ok: true }
}

/** 删除(离职)员工 */
export async function removeEmployee(id: number): Promise<AddEmployeeResult> {
  const scope = await getScope()
  if (scope.role !== 'group') {
    return { ok: false, error: '只有集团管理员可以管理人力架构' }
  }
  await db
    .delete(employees)
    .where(and(eq(employees.id, id), eq(employees.userId, scope.ownerId)))
  revalidatePath('/org')
  return { ok: true }
}
