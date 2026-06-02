'use server'

import { auth } from '@/lib/auth'
import { pool } from '@/lib/db'
import { getScope } from '@/lib/scope'
import { financeRoleDef, type FinanceRole } from '@/lib/finance-roles'
import { isValidAccount, resolveSignupIdentity } from '@/lib/account-id'
import { revalidatePath } from 'next/cache'

export type FinanceStaff = {
  id: string
  name: string
  loginId: string // 登录账号(手机号 / 用户名)
  financeRole: string
  createdAt: string
}

export type CreateFinanceStaffResult = { ok: true } | { ok: false; error: string }

/** 集团管理员创建财务子账号(出纳/会计/审计/税务专员),account = 手机号 / 用户名 */
export async function createFinanceStaff(input: {
  name: string
  account: string
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
  const account = input.account.trim()
  if (!isValidAccount(account)) {
    return { ok: false, error: '登录账号支持手机号、用户名或邮箱(2-30 位)' }
  }
  if (input.password.length < 8) {
    return { ok: false, error: '密码至少 8 位' }
  }

  // 邮箱直接注册;手机号/用户名走合成邮箱 + 用户名
  const identity = resolveSignupIdentity(account)
  try {
    // 不转发当前 headers,避免 autoSignIn 顶替掉管理员会话
    await auth.api.signUpEmail({
      body: {
        name: input.name,
        email: identity.email,
        password: input.password,
        ...(identity.username
          ? { username: identity.username, displayUsername: identity.displayUsername }
          : {}),
      },
    })
  } catch (e) {
    const msg = e instanceof Error ? e.message : '创建失败'
    if (/exist|taken|unique/i.test(msg)) {
      return { ok: false, error: '该手机号 / 用户名 / 邮箱已被注册' }
    }
    return { ok: false, error: msg }
  }

  // 标记为集团级财务子账号:可查看集团数据,但带 financeRole 受 RBAC 限制
  await pool.query(
    'UPDATE "user" SET "role" = $1, "ownerId" = $2, "entityId" = NULL, "financeRole" = $3 WHERE email = $4',
    ['group', scope.ownerId, input.financeRole, identity.email],
  )

  revalidatePath('/settings')
  return { ok: true }
}

/** 列出当前集团下的财务子账号 */
export async function listFinanceStaff(): Promise<FinanceStaff[]> {
  const scope = await getScope()
  if (!scope.isAdmin) return []
  const { rows } = await pool.query(
    'SELECT id, name, email, "displayUsername", username, "financeRole", "createdAt" FROM "user" WHERE "ownerId" = $1 AND "financeRole" IS NOT NULL ORDER BY "createdAt" DESC',
    [scope.ownerId],
  )
  return rows.map((r) => ({
    id: r.id,
    name: r.name,
    loginId: r.displayUsername || r.username || r.email,
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
