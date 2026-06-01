import { auth } from '@/lib/auth'
import { headers } from 'next/headers'

export type PlatformAdmin = {
  id: string
  name: string
  loginId: string
}

/**
 * 平台运营方超管身份。
 * 平台超管是独立于客户系统(group/store)的"上帝视角"角色,
 * 用 user.role === 'platform' 标记,可跨全租户查看健康/告警(仅聚合,不下钻明细)。
 */
export async function getPlatformAdmin(): Promise<PlatformAdmin | null> {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session?.user) return null
  const u = session.user as typeof session.user & {
    role?: string
    displayUsername?: string | null
    username?: string | null
  }
  if (u.role !== 'platform') return null
  return {
    id: u.id,
    name: u.name,
    loginId: u.displayUsername || u.username || u.email,
  }
}

/** 守卫:非平台超管直接抛出(供 Server Action 使用) */
export async function requirePlatformAdmin(): Promise<PlatformAdmin> {
  const admin = await getPlatformAdmin()
  if (!admin) throw new Error('需要平台超管权限')
  return admin
}
