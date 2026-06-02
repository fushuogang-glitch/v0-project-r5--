'use server'

import { auth } from '@/lib/auth'
import { pool } from '@/lib/db'
import { isValidAccount, resolveSignupIdentity } from '@/lib/account-id'

/** 系统是否已存在平台超管(决定是否还允许首次引导) */
export async function platformAdminExists(): Promise<boolean> {
  const { rows } = await pool.query(`SELECT 1 FROM "user" WHERE role='platform' LIMIT 1`)
  return rows.length > 0
}

/**
 * 首次引导创建平台超管。
 * 安全约束:仅当系统中【尚无任何平台超管】时可用,创建后此接口自动失效。
 */
export async function bootstrapPlatformAdmin(input: {
  name: string
  account: string
  password: string
}): Promise<{ ok: boolean; error?: string }> {
  const account = input.account.trim()
  if (!input.name.trim()) return { ok: false, error: '请填写姓名' }
  if (!isValidAccount(account)) return { ok: false, error: '账号支持手机号、用户名或邮箱(2-30 位)' }
  if (input.password.length < 8) return { ok: false, error: '密码至少 8 位' }

  // 关键安全闸:已存在超管则拒绝
  if (await platformAdminExists()) {
    return { ok: false, error: '平台超管已存在,首次引导已关闭' }
  }

  // 邮箱直接注册;手机号/用户名走合成邮箱 + 用户名
  const identity = resolveSignupIdentity(account)
  try {
    // 不转发 headers,避免 autoSignIn 干扰
    await auth.api.signUpEmail({
      body: {
        name: input.name.trim(),
        email: identity.email,
        password: input.password,
        ...(identity.username
          ? { username: identity.username, displayUsername: identity.displayUsername }
          : {}),
      },
    })
  } catch (e) {
    const msg = e instanceof Error ? e.message : '创建失败'
    if (/exist|taken|unique/i.test(msg)) return { ok: false, error: '该账号已被占用' }
    return { ok: false, error: msg }
  }

  // 提升为平台超管:不属于任何租户(ownerId/entityId 置空)
  await pool.query(
    `UPDATE "user" SET role='platform', "ownerId"=NULL, "entityId"=NULL, "financeRole"=NULL WHERE email=$1`,
    [identity.email],
  )
  return { ok: true }
}
