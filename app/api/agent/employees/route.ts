import { NextResponse } from 'next/server'
import { authenticateAgent } from '@/lib/agent-auth'
import { db } from '@/lib/db'
import { employees, entities, departments } from '@/lib/db/schema'
import { and, eq, asc } from 'drizzle-orm'

export const dynamic = 'force-dynamic'

const JOB_LEVELS = new Set([
  'L1', 'L2', 'L3', 'L4', 'L5',
  'L6', 'L7', 'L8', 'L9', 'L10',
  'L11', 'L12', 'L13', 'L14', 'L15',
])

function serialize(e: typeof employees.$inferSelect) {
  return {
    id: e.id,
    level: e.level,
    entityId: e.entityId,
    departmentId: e.departmentId,
    name: e.name,
    position: e.position,
    jobLevel: e.jobLevel,
    managerId: e.managerId,
    phone: e.phone,
    hireDate: e.hireDate,
    status: e.status,
  }
}

/**
 * GET /api/agent/employees
 * 列出集团所有员工。可选筛选 ?entityId= / ?level=group|entity / ?status=active|left
 */
export async function GET(req: Request) {
  const principal = await authenticateAgent(req)
  if (!principal) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }

  const url = new URL(req.url)
  const conds = [eq(employees.userId, principal.ownerId)]
  const entityId = url.searchParams.get('entityId')
  const level = url.searchParams.get('level')
  const status = url.searchParams.get('status')
  if (entityId && Number.isFinite(Number(entityId))) {
    conds.push(eq(employees.entityId, Number(entityId)))
  }
  if (level === 'group' || level === 'entity') {
    conds.push(eq(employees.level, level))
  }
  if (status === 'active' || status === 'left') {
    conds.push(eq(employees.status, status))
  }

  const rows = await db
    .select()
    .from(employees)
    .where(and(...conds))
    .orderBy(asc(employees.id))

  return NextResponse.json({ count: rows.length, employees: rows.map(serialize) })
}

/**
 * POST /api/agent/employees
 * 人力组织 Agent 新增一名员工。
 * body: { level: "group"|"entity", entityId?, departmentId?, name, position?,
 *         jobLevel?(L1-L15), managerId?, phone?, hireDate? }
 *  - level=entity 需 entityId(所属门店)
 *  - level=group  需 departmentId(所属中控部门)
 */
export async function POST(req: Request) {
  const principal = await authenticateAgent(req)
  if (!principal) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }

  let body: Record<string, unknown>
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'invalid_json' }, { status: 400 })
  }

  const name = String(body.name ?? '').trim()
  if (!name) {
    return NextResponse.json({ error: 'name_required', message: '请提供员工姓名' }, { status: 422 })
  }

  const level = body.level === 'group' ? 'group' : 'entity'
  const jobLevel = JOB_LEVELS.has(String(body.jobLevel)) ? String(body.jobLevel) : 'L1'

  let entityId: number | null = null
  let departmentId: number | null = null

  if (level === 'entity') {
    entityId = Number(body.entityId)
    if (!Number.isFinite(entityId)) {
      return NextResponse.json(
        { error: 'entityId_required', message: '门店层员工需提供 entityId' },
        { status: 422 },
      )
    }
    const [e] = await db
      .select({ id: entities.id })
      .from(entities)
      .where(and(eq(entities.id, entityId), eq(entities.userId, principal.ownerId)))
      .limit(1)
    if (!e) {
      return NextResponse.json({ error: 'entity_not_found' }, { status: 404 })
    }
  } else {
    departmentId = Number(body.departmentId)
    if (!Number.isFinite(departmentId)) {
      return NextResponse.json(
        { error: 'departmentId_required', message: '集团层员工需提供 departmentId' },
        { status: 422 },
      )
    }
    const [d] = await db
      .select({ id: departments.id })
      .from(departments)
      .where(and(eq(departments.id, departmentId), eq(departments.userId, principal.ownerId)))
      .limit(1)
    if (!d) {
      return NextResponse.json({ error: 'department_not_found' }, { status: 404 })
    }
  }

  const [row] = await db
    .insert(employees)
    .values({
      userId: principal.ownerId,
      level,
      entityId,
      departmentId,
      name,
      position: body.position ? String(body.position).trim() : null,
      jobLevel,
      managerId: Number.isFinite(Number(body.managerId)) ? Number(body.managerId) : null,
      phone: body.phone ? String(body.phone).trim() : null,
      hireDate: body.hireDate ? String(body.hireDate) : null,
      status: 'active',
    })
    .returning()

  return NextResponse.json({ ok: true, employee: serialize(row) }, { status: 201 })
}
