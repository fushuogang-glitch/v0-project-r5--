// 登录账号工具:支持「手机号 / 自定义用户名(含中文) / 邮箱」三种登录标识。
//
// 设计:底层 Better Auth 仍要求每个用户有 email,但我们不暴露给用户。
// - 注册时用户只填「登录账号」(手机号或用户名),系统自动生成一个隐藏的合成邮箱。
// - 登录时智能识别:含 @ 视为邮箱(兼容历史账号),否则视为用户名/手机号。

/** 合成邮箱域名(仅内部占位,用户永远看不到也不会收到邮件) */
const SYNTHETIC_EMAIL_DOMAIN = 'nota.local'

/** 用户名校验:允许中英文、数字、下划线、点、连字符;2-30 位。手机号天然满足。 */
export const USERNAME_REGEX = /^[\p{L}\p{N}_.\-]+$/u
export const USERNAME_MIN = 2
export const USERNAME_MAX = 30

export function isValidUsername(value: string): boolean {
  const v = value.trim()
  return v.length >= USERNAME_MIN && v.length <= USERNAME_MAX && USERNAME_REGEX.test(v)
}

/** 是否看起来像邮箱(用于登录时区分走邮箱还是用户名通道) */
export function looksLikeEmail(value: string): boolean {
  return /\S+@\S+\.\S+/.test(value.trim())
}

/** 为新账号生成一个唯一的隐藏合成邮箱,与用户名解耦(避免中文/特殊字符导致邮箱非法) */
export function generateSyntheticEmail(): string {
  const rand =
    typeof crypto !== 'undefined' && 'randomUUID' in crypto
      ? crypto.randomUUID().replace(/-/g, '').slice(0, 16)
      : Math.random().toString(36).slice(2) + Date.now().toString(36)
  return `acct_${rand}@${SYNTHETIC_EMAIL_DOMAIN}`
}

/** 判断是否为系统生成的合成邮箱(用于 UI 上隐藏,不展示给用户) */
export function isSyntheticEmail(email: string | null | undefined): boolean {
  return !!email && email.endsWith(`@${SYNTHETIC_EMAIL_DOMAIN}`)
}

/** 中文校验提示文案 */
export const USERNAME_HINT = '登录账号支持手机号或用户名(2-30 位,可用中英文、数字、下划线)'
