import 'server-only'
import { pool } from '@/lib/db'

export type TenantLifecycle = {
  status: 'active' | 'suspended' | 'expired'
  /** 距订阅到期的天数;null = 未设到期日 */
  daysLeft: number | null
  /** 已过期但仍在宽限期内(允许只读登录并提示) */
  inGrace: boolean
  /** 是否应展示续费提醒横幅(到期前 15 天内或已进入宽限期) */
  showRenewBanner: boolean
  subscriptionEndsAt: string | null
  brandName: string | null
}

// 到期后给 7 天宽限期:期间仍可登录但全局提示;超过则按停用处理
const GRACE_DAYS = 7
const REMIND_DAYS = 15

/**
 * 基于租户主账号(ownerId)解析账号生命周期状态。
 * 供客户端 layout 在登录后做停用/到期拦截与续费提醒。
 */
export async function getTenantLifecycle(ownerId: string): Promise<TenantLifecycle> {
  const r = await pool.query(
    `SELECT name, "accountStatus", "subscriptionEndsAt" FROM "user" WHERE id=$1`,
    [ownerId],
  )
  const row = r.rows[0]
  const brandName = (row?.name as string) ?? null
  const rawStatus = (row?.accountStatus as string) ?? 'active'
  const ends = row?.subscriptionEndsAt ? new Date(row.subscriptionEndsAt) : null
  const subscriptionEndsAt = ends ? ends.toISOString() : null

  const daysLeft = ends ? Math.ceil((ends.getTime() - Date.now()) / 86400000) : null

  // 被中台手动停用:最高优先级
  if (rawStatus === 'suspended') {
    return {
      status: 'suspended',
      daysLeft,
      inGrace: false,
      showRenewBanner: false,
      subscriptionEndsAt,
      brandName,
    }
  }

  // 到期判断(含宽限)
  if (daysLeft !== null && daysLeft < 0) {
    const overdueDays = -daysLeft
    if (overdueDays <= GRACE_DAYS) {
      return {
        status: 'expired',
        daysLeft,
        inGrace: true,
        showRenewBanner: true,
        subscriptionEndsAt,
        brandName,
      }
    }
    // 超过宽限期:彻底锁定
    return {
      status: 'expired',
      daysLeft,
      inGrace: false,
      showRenewBanner: false,
      subscriptionEndsAt,
      brandName,
    }
  }

  // 正常,但接近到期则提示续费
  return {
    status: 'active',
    daysLeft,
    inGrace: false,
    showRenewBanner: daysLeft !== null && daysLeft <= REMIND_DAYS,
    subscriptionEndsAt,
    brandName,
  }
}
