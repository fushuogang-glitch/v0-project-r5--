import { NextResponse } from 'next/server'
import { authenticateAgent } from '@/lib/agent-auth'
import { db } from '@/lib/db'
import { departments, positions, entities } from '@/lib/db/schema'
import { eq, asc } from 'drizzle-orm'

export const dynamic = 'force-dynamic'

/**
 * GET /api/agent/org
 * 人力组织 Agent 拉取组织字典:中控部门、门店岗位、门店主体。
 * 用于在新增员工 / 录入工资前获取正确的 departmentId / entityId / 岗位名称。
 */
export async function GET(req: Request) {
  const principal = await authenticateAgent(req)
  if (!principal) {
    return NextResponse.json(
      { error: 'unauthorized', message: '无效的 Agent 密钥' },
      { status: 401 },
    )
  }

  const [deptList, posList, entList] = await Promise.all([
    db
      .select({ id: departments.id, name: departments.name })
      .from(departments)
      .where(eq(departments.userId, principal.ownerId))
      .orderBy(asc(departments.sortOrder), asc(departments.id)),
    db
      .select({ id: positions.id, name: positions.name })
      .from(positions)
      .where(eq(positions.userId, principal.ownerId))
      .orderBy(asc(positions.sortOrder), asc(positions.id)),
    db
      .select({
        id: entities.id,
        code: entities.code,
        name: entities.name,
        departmentId: entities.departmentId,
      })
      .from(entities)
      .where(eq(entities.userId, principal.ownerId))
      .orderBy(asc(entities.code)),
  ])

  return NextResponse.json({
    group: principal.name,
    departments: deptList,
    positions: posList,
    entities: entList,
    jobLevels: [
      'L1', 'L2', 'L3', 'L4', 'L5',
      'L6', 'L7', 'L8', 'L9', 'L10',
      'L11', 'L12', 'L13', 'L14', 'L15',
    ],
  })
}
