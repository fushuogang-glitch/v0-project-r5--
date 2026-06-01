'use server'

import { auth } from '@/lib/auth'
import { pool } from '@/lib/db'
import { getScope } from '@/lib/scope'
import { financeRoleDef, type FinanceRole } from '@/lib/finance-roles'
import { revalidatePath } from 'next/cache'

export type FinanceStaff = {
  id: string
  name: string
  email: string
  financeRole: string
  createdAt: string
}

export type CreateFinanceStaffResult = { ok: true } | { ok: false; error: string }

/** 集团管理员创建财务子账号(出纳/会计/审计/税务专员) */
export async function createFinanceStaff(input: {
  name: string
  email: string
  password: string
  financeRole: FinanceRole
}): Promise<CreateFinanceStaffResult> {
  const scope = await getScope()
  if (!scope.isAdmin) {
    return { ok: false, error: '只有集团管理员可以创建财务子账号' }
  }
  if (!financeRoleDef(input.financeRole)) {
    return { ok: false, error: '无效的财务角色' }
  }
  if (input.password.length < 8) {
    return { ok: false, error: '密码至少 8 位' }
  }

  try {
    // 不转发当前 headers,避免 autoSignIn 顶替掉管理员会话
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

  // 标记为集团级财务子账号:可查看集团数据,但带 financeRole 受 RBAC 限制
  await pool.query(
    'UPDATE "user" SET "role" = $1, "ownerId" = $2, "entityId" = NULL, "financeRole" = $3 WHERE email = $4',
    ['group', scope.ownerId, input.financeRole, input.email],
  )

  revalidatePath('/settings')
  return { ok: true }
}

/** 列出当前集团下的财务子账号 */
export async function listFinanceStaff(): Promise<FinanceStaff[]> {
  const scope = await getScope()
  if (!scope.isAdmin) return []
  const { rows } = await pool.query(
    'SELECT id, name, email, "financeRole", "createdAt" FROM "user" WHERE "ownerId" = $1 AND "financeRole" IS NOT NULL ORDER BY "createdAt" DESC',
    [scope.ownerId],
  )
  return rows.map((r) => ({
    id: r.id,
    name: r.name,
    email: r.email,
    financeRole: r.financeRole,
    createdAt:
      r.createdAt instanceof Date ? r.createdAt.toISOString() : String(r.createdAt),
  }))
}

/** 删除(停用)财务子账号 */
export async function removeFinanceStaff(userId: string): Promise<{ ok: boolean }> {
  const scope = await getScope()
  if (!scope.isAdmin) return { ok: false }
  // 仅能删除本集团、确为财务子账号的用户
  await pool.query(
    'DELETE FROM "user" WHERE id = $1 AND "ownerId" = $2 AND "financeRole" IS NOT NULL',
    [userId, scope.ownerId],
  )
  revalidatePath('/settings')
  return { ok: true }
}
