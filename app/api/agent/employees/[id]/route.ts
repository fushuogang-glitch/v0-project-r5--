import { NextResponse } from 'next/server'
import { authenticateAgent } from '@/lib/agent-auth'
import { db } from '@/lib/db'
import { employees, entities, departments } from '@/lib/db/schema'
import { and, eq } from 'drizzle-orm'

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

async function resolve(req: Request, id: number) {
  const principal = await authenticateAgent(req)
  if (!principal) return { error: 'unauthorized' as const }
  const [e] = await db
    .select()
    .from(employees)
    .where(and(eq(employees.id, id), eq(employees.userId, principal.ownerId)))
    .limit(1)
  if (!e) return { error: 'not_found' as const }
  return { principal, employee: e }
}

/**
 * PATCH /api/agent/employees/:id
 * 人力组织 Agent 调整员工:岗位、职级、部门、所属门店、上级、状态、电话等。
 * body 任意字段:{ name?, position?, jobLevel?, departmentId?, entityId?,
 *               managerId?, phone?, hireDate?, status?("active"|"left") }
 */
export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const empId = Number(id)
  if (!Number.isFinite(empId)) {
    return NextResponse.json({ error: 'bad_request' }, { status: 400 })
  }

  const resolved = await resolve(req, empId)
  if (resolved.error === 'unauthorized') {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }
  if (resolved.error === 'not_found') {
    return NextResponse.json({ error: 'not_found' }, { status: 404 })
  }
  const { principal } = resolved

  let body: Record<string, unknown>
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'invalid_json' }, { status: 400 })
  }

  const patch: Partial<typeof employees.$inferInsert> = {}

  if (typeof body.name === 'string' && body.name.trim()) patch.name = body.name.trim()
  if ('position' in body) patch.position = body.position ? String(body.position).trim() : null
  if (typeof body.jobLevel === 'string' && JOB_LEVELS.has(body.jobLevel)) {
    patch.jobLevel = body.jobLevel
  }
  if ('phone' in body) patch.phone = body.phone ? String(body.phone).trim() : null
  if ('hireDate' in body) patch.hireDate = body.hireDate ? String(body.hireDate) : null
  if (body.status === 'active' || body.status === 'left') patch.status = body.status
  if ('managerId' in body) {
    patch.managerId = Number.isFinite(Number(body.managerId)) ? Number(body.managerId) : null
  }

  // 调部门:校验归属
  if ('departmentId' in body) {
    if (body.departmentId == null) {
      patch.departmentId = null
    } else {
      const depId = Number(body.departmentId)
      const [d] = await db
        .select({ id: departments.id })
        .from(departments)
        .where(and(eq(departments.id, depId), eq(departments.userId, principal.ownerId)))
        .limit(1)
      if (!d) return NextResponse.json({ error: 'department_not_found' }, { status: 404 })
      patch.departmentId = depId
    }
  }

  // 调门店(转店):校验归属
  if ('entityId' in body) {
    if (body.entityId == null) {
      patch.entityId = null
    } else {
      const entId = Number(body.entityId)
      const [e] = await db
        .select({ id: entities.id })
        .from(entities)
        .where(and(eq(entities.id, entId), eq(entities.userId, principal.ownerId)))
        .limit(1)
      if (!e) return NextResponse.json({ error: 'entity_not_found' }, { status: 404 })
      patch.entityId = entId
    }
  }

  if (Object.keys(patch).length === 0) {
    return NextResponse.json({ error: 'no_fields', message: '没有可更新的字段' }, { status: 422 })
  }

  const [row] = await db
    .update(employees)
    .set(patch)
    .where(and(eq(employees.id, empId), eq(employees.userId, principal.ownerId)))
    .returning()

  return NextResponse.json({ ok: true, employee: serialize(row) })
}

/**
 * DELETE /api/agent/employees/:id
 * 员工离职。默认软删除(置 status=left);传 ?hard=true 则物理删除。
 */
export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const empId = Number(id)
  if (!Number.isFinite(empId)) {
    return NextResponse.json({ error: 'bad_request' }, { status: 400 })
  }

  const resolved = await resolve(req, empId)
  if (resolved.error === 'unauthorized') {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }
  if (resolved.error === 'not_found') {
    return NextResponse.json({ error: 'not_found' }, { status: 404 })
  }
  const { principal } = resolved

  const hard = new URL(req.url).searchParams.get('hard') === 'true'
  if (hard) {
    await db
      .delete(employees)
      .where(and(eq(employees.id, empId), eq(employees.userId, principal.ownerId)))
    return NextResponse.json({ ok: true, deleted: true })
  }

  await db
    .update(employees)
    .set({ status: 'left' })
    .where(and(eq(employees.id, empId), eq(employees.userId, principal.ownerId)))
  return NextResponse.json({ ok: true, status: 'left' })
}
