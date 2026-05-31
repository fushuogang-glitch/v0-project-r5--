'use server'

import { auth } from '@/lib/auth'
import { db, pool } from '@/lib/db'
import { user as userTable, entities } from '@/lib/db/schema'
import { getScope, VIEW_COOKIE } from '@/lib/scope'
import { and, eq } from 'drizzle-orm'
import { cookies } from 'next/headers'
import { revalidatePath } from 'next/cache'

/** 集团管理员切换当前视图(集团总览 / 某个主体) */
export async function setViewEntity(value: string) {
  const scope = await getScope()
  if (scope.role === 'store') return // 门店端不可切换
  const store = await cookies()
  if (!value || value === 'group') {
    store.set(VIEW_COOKIE, 'group', { path: '/', maxAge: 60 * 60 * 24 * 30 })
  } else {
    store.set(VIEW_COOKIE, String(Number(value)), {
      path: '/',
      maxAge: 60 * 60 * 24 * 30,
    })
  }
  revalidatePath('/', 'layout')
}

export type CreateStoreAccountResult =
  | { ok: true }
  | { ok: false; error: string }

/** 集团管理员为某个主体创建门店端登录账号 */
export async function createStoreAccount(input: {
  entityId: number
  name: string
  email: string
  password: string
}): Promise<CreateStoreAccountResult> {
  const scope = await getScope()
  if (scope.role !== 'group') {
    return { ok: false, error: '只有集团管理员可以创建门店账号' }
  }

  // 校验主体归属
  const [entity] = await db
    .select({ id: entities.id })
    .from(entities)
    .where(and(eq(entities.id, input.entityId), eq(entities.userId, scope.ownerId)))
    .limit(1)
  if (!entity) return { ok: false, error: '主体不存在或无权操作' }

  if (input.password.length < 8) {
    return { ok: false, error: '密码至少 8 位' }
  }

  try {
    // 通过 Better Auth 创建带密码哈希的用户。
    // 不转发当前请求 headers,避免 autoSignIn 顶替掉管理员自己的会话。
    await auth.api.signUpEmail({
      body: { name: input.name, email: input.email, password: input.password },
    })
  } catch (e) {
    const msg = e instanceof Error ? e.message : '创建失败'
    if (msg.toLowerCase().includes('exist')) {
      return { ok: false, error: '该邮箱已被注册' }
    }
    return { ok: false, error: msg }
  }

  // 将新账号标记为门店端,并绑定到主体 + 归属当前集团数据
  await pool.query(
    'UPDATE "user" SET "role" = $1, "ownerId" = $2, "entityId" = $3 WHERE email = $4',
    ['store', scope.ownerId, input.entityId, input.email],
  )

  revalidatePath('/entities')
  return { ok: true }
}

/** 列出某主体已绑定的门店端账号 */
export async function getStoreAccounts(entityId: number) {
  const scope = await getScope()
  if (scope.role !== 'group') return []
  return db
    .select({
      id: userTable.id,
      name: userTable.name,
      email: userTable.email,
    })
    .from(userTable)
    .where(and(eq(userTable.ownerId, scope.ownerId), eq(userTable.entityId, entityId)))
}
