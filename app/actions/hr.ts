'use server'

import { db } from '@/lib/db'
import { employees, entities, departments, positions } from '@/lib/db/schema'
import { getScope } from '@/lib/scope'
import { and, eq, asc } from 'drizzle-orm'
import { revalidatePath } from 'next/cache'

export type JobLevel =
  | 'L1' | 'L2' | 'L3' | 'L4' | 'L5'
  | 'L6' | 'L7' | 'L8' | 'L9' | 'L10'
  | 'L11' | 'L12' | 'L13' | 'L14' | 'L15'

export const JOB_LEVELS: JobLevel[] = [
  'L1', 'L2', 'L3', 'L4', 'L5',
  'L6', 'L7', 'L8', 'L9', 'L10',
  'L11', 'L12', 'L13', 'L14', 'L15',
]

export type EmployeeRow = {
  id: number
  level: 'group' | 'entity'
  entityId: number | null
  departmentId: number | null
  name: string
  position: string | null
  jobLevel: JobLevel
  managerId: number | null
  phone: string | null
  hireDate: string | null
  status: string
}

export type DeptItem = { id: number; name: string }
export type PositionItem = { id: number; name: string }

export type OrgEntityNode = {
  entityId: number
  entityName: string
  employees: EmployeeRow[]
}

export type OrgDeptNode = {
  departmentId: number
  departmentName: string
  deptEmployees: EmployeeRow[] // 部门直属(集团层)员工
  entities: OrgEntityNode[] // 挂在该部门下的门店
}

export type OrgChart = {
  groupName: string
  departments: OrgDeptNode[]
  unassignedEntities: OrgEntityNode[] // 尚未归属部门的门店
  unassignedGroup: EmployeeRow[] // 尚未归属部门的集团层员工
  totalActive: number
  entityCount: number
  deptCount: number
}

function toRow(e: typeof employees.$inferSelect): EmployeeRow {
  return {
    id: e.id,
    level: e.level === 'group' ? 'group' : 'entity',
    entityId: e.entityId,
    departmentId: e.departmentId,
    name: e.name,
    position: e.position,
    jobLevel: (e.jobLevel as JobLevel) ?? 'L1',
    managerId: e.managerId,
    phone: e.phone,
    hireDate: e.hireDate,
    status: e.status,
  }
}

// ---------------------------------------------------------------------------
// 字典:部门 / 岗位
// ---------------------------------------------------------------------------

export async function listDepartments(): Promise<DeptItem[]> {
  const scope = await getScope()
  const list = await db
    .select({ id: departments.id, name: departments.name })
    .from(departments)
    .where(eq(departments.userId, scope.ownerId))
    .orderBy(asc(departments.sortOrder), asc(departments.id))
  return list
}

export async function listPositions(): Promise<PositionItem[]> {
  const scope = await getScope()
  const list = await db
    .select({ id: positions.id, name: positions.name })
    .from(positions)
    .where(eq(positions.userId, scope.ownerId))
    .orderBy(asc(positions.sortOrder), asc(positions.id))
  return list
}

export type ActionResult = { ok: true } | { ok: false; error: string }

export async function addDepartment(name: string): Promise<ActionResult> {
  const scope = await getScope()
  if (scope.role !== 'group') return { ok: false, error: '只有集团管理员可以管理部门' }
  if (!name.trim()) return { ok: false, error: '请填写部门名称' }
  await db.insert(departments).values({ userId: scope.ownerId, name: name.trim() })
  revalidatePath('/org')
  return { ok: true }
}

export async function removeDepartment(id: number): Promise<ActionResult> {
  const scope = await getScope()
  if (scope.role !== 'group') return { ok: false, error: '只有集团管理员可以管理部门' }
  // 解除门店与集团员工对该部门的归属,再删除部门
  await db
    .update(entities)
    .set({ departmentId: null })
    .where(and(eq(entities.userId, scope.ownerId), eq(entities.departmentId, id)))
  await db
    .update(employees)
    .set({ departmentId: null })
    .where(and(eq(employees.userId, scope.ownerId), eq(employees.departmentId, id)))
  await db.delete(departments).where(and(eq(departments.id, id), eq(departments.userId, scope.ownerId)))
  revalidatePath('/org')
  return { ok: true }
}

export async function addPosition(name: string): Promise<ActionResult> {
  const scope = await getScope()
  if (scope.role !== 'group') return { ok: false, error: '只有集团管理员可以管理岗位' }
  if (!name.trim()) return { ok: false, error: '请填写岗位名称' }
  await db.insert(positions).values({ userId: scope.ownerId, name: name.trim() })
  revalidatePath('/org')
  return { ok: true }
}

export async function removePosition(id: number): Promise<ActionResult> {
  const scope = await getScope()
  if (scope.role !== 'group') return { ok: false, error: '只有集团管理员可以管理岗位' }
  await db.delete(positions).where(and(eq(positions.id, id), eq(positions.userId, scope.ownerId)))
  revalidatePath('/org')
  return { ok: true }
}

/** 设置门店归属的中控部门(departmentId 为 null 取消归属) */
export async function setEntityDepartment(
  entityId: number,
  departmentId: number | null,
): Promise<ActionResult> {
  const scope = await getScope()
  if (scope.role !== 'group') return { ok: false, error: '只有集团管理员可以调整门店归属' }
  await db
    .update(entities)
    .set({ departmentId })
    .where(and(eq(entities.id, entityId), eq(entities.userId, scope.ownerId)))
  revalidatePath('/org')
  return { ok: true }
}

// ---------------------------------------------------------------------------
// 组织架构树:集团 → 部门 → 门店 → 岗位人员
// ---------------------------------------------------------------------------

export async function getOrgChart(): Promise<OrgChart> {
  const scope = await getScope()

  const [deptList, entList, empList] = await Promise.all([
    db
      .select({ id: departments.id, name: departments.name })
      .from(departments)
      .where(eq(departments.userId, scope.ownerId))
      .orderBy(asc(departments.sortOrder), asc(departments.id)),
    db
      .select({
        id: entities.id,
        name: entities.name,
        code: entities.code,
        departmentId: entities.departmentId,
      })
      .from(entities)
      .where(eq(entities.userId, scope.ownerId))
      .orderBy(entities.code),
    db
      .select()
      .from(employees)
      .where(eq(employees.userId, scope.ownerId))
      .orderBy(asc(employees.jobLevel), asc(employees.id)),
  ])

  const rows = empList.map(toRow).filter((r) => r.status === 'active')
  const isStore = scope.role === 'store' && scope.entityId != null

  // 门店端:只看自己门店
  const visibleEntities = isStore ? entList.filter((e) => e.id === scope.entityId) : entList

  const buildEntityNode = (e: { id: number; name: string }): OrgEntityNode => ({
    entityId: e.id,
    entityName: e.name,
    employees: rows.filter((r) => r.level === 'entity' && r.entityId === e.id),
  })

  const deptNodes: OrgDeptNode[] = deptList.map((d) => ({
    departmentId: d.id,
    departmentName: d.name,
    deptEmployees: isStore ? [] : rows.filter((r) => r.level === 'group' && r.departmentId === d.id),
    entities: visibleEntities.filter((e) => e.departmentId === d.id).map(buildEntityNode),
  }))

  const unassignedEntities = visibleEntities
    .filter((e) => e.departmentId == null)
    .map(buildEntityNode)

  const unassignedGroup = isStore
    ? []
    : rows.filter((r) => r.level === 'group' && r.departmentId == null)

  return {
    groupName: '集团总部',
    departments: isStore ? deptNodes.filter((d) => d.entities.length > 0) : deptNodes,
    unassignedEntities,
    unassignedGroup,
    totalActive: rows.length,
    entityCount: visibleEntities.length,
    deptCount: deptList.length,
  }
}

/** 扁平员工列表(用于股权绑定等下拉) */
export async function listEmployees(): Promise<EmployeeRow[]> {
  const scope = await getScope()
  const where =
    scope.role === 'store' && scope.entityId != null
      ? and(eq(employees.userId, scope.ownerId), eq(employees.entityId, scope.entityId))
      : eq(employees.userId, scope.ownerId)
  const list = await db.select().from(employees).where(where).orderBy(asc(employees.id))
  return list.map(toRow).filter((r) => r.status === 'active')
}

export type AddEmployeeResult = { ok: true } | { ok: false; error: string }

/** 新增员工(集团层需 departmentId;门店层需 entityId) */
export async function addEmployee(input: {
  level?: 'group' | 'entity'
  entityId?: number
  departmentId?: number
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
  let departmentId: number | null = null

  if (level === 'entity') {
    if (!input.entityId) return { ok: false, error: '请选择所属门店' }
    const [e] = await db
      .select({ id: entities.id })
      .from(entities)
      .where(and(eq(entities.id, input.entityId), eq(entities.userId, scope.ownerId)))
      .limit(1)
    if (!e) return { ok: false, error: '门店不存在或无权操作' }
    entityId = input.entityId
  } else {
    // 集团层员工必须归属一个中控部门
    if (!input.departmentId) return { ok: false, error: '请选择所属部门' }
    const [d] = await db
      .select({ id: departments.id })
      .from(departments)
      .where(and(eq(departments.id, input.departmentId), eq(departments.userId, scope.ownerId)))
      .limit(1)
    if (!d) return { ok: false, error: '部门不存在或无权操作' }
    departmentId = input.departmentId
  }

  await db.insert(employees).values({
    userId: scope.ownerId,
    level,
    entityId,
    departmentId,
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
  await db.delete(employees).where(and(eq(employees.id, id), eq(employees.userId, scope.ownerId)))
  revalidatePath('/org')
  return { ok: true }
}
