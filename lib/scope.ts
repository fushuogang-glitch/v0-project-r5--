import { auth } from '@/lib/auth'
import { db } from '@/lib/db'
import { entities } from '@/lib/db/schema'
import { and, eq } from 'drizzle-orm'
import { headers, cookies } from 'next/headers'

export type Role = 'group' | 'store'

export type Scope = {
  /** 数据归属:集团 owner 的 userId(所有业务查询都按它隔离) */
  ownerId: string
  /** 当前登录账号自身 id */
  selfId: string
  role: Role
  /** 当前聚焦的主体 id;null = 集团视图(仅集团管理员可为 null) */
  entityId: number | null
  /** 门店端锁定,无法切换视图 */
  locked: boolean
}

const VIEW_COOKIE = 'view_entity'

/**
 * 解析当前请求的数据范围。
 * - 门店端账号:永远锁定在自己的 entityId。
 * - 集团管理员:读取 view_entity cookie,可在集团视图与任一主体间切换。
 */
export async function getScope(): Promise<Scope> {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session?.user) throw new Error('Unauthorized')

  const u = session.user as typeof session.user & {
    role?: Role
    ownerId?: string | null
    entityId?: number | null
  }

  const role: Role = u.role === 'store' ? 'store' : 'group'
  const ownerId = u.ownerId || u.id

  if (role === 'store') {
    return {
      ownerId,
      selfId: u.id,
      role,
      entityId: u.entityId ?? null,
      locked: true,
    }
  }

  const store = await cookies()
  const raw = store.get(VIEW_COOKIE)?.value
  const entityId = raw && raw !== 'group' ? Number(raw) : null

  return { ownerId, selfId: u.id, role, entityId, locked: false }
}

/** 集团管理员可访问的主体下拉(用于顶栏切换器) */
export async function getViewableEntities(scope: Scope) {
  if (scope.role === 'store') {
    if (scope.entityId == null) return []
    return db
      .select({
        id: entities.id,
        name: entities.name,
        code: entities.code,
        departmentId: entities.departmentId,
      })
      .from(entities)
      .where(and(eq(entities.userId, scope.ownerId), eq(entities.id, scope.entityId)))
  }
  return db
    .select({
      id: entities.id,
      name: entities.name,
      code: entities.code,
      departmentId: entities.departmentId,
    })
    .from(entities)
    .where(eq(entities.userId, scope.ownerId))
    .orderBy(entities.code)
}

export { VIEW_COOKIE }
