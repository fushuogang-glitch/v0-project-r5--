import 'server-only'
import crypto from 'node:crypto'

/**
 * 对称加密工具:用于在数据库中加密存储 SaaS API Key 等敏感配置。
 * 密钥从 BETTER_AUTH_SECRET 派生(项目已配置该变量);若缺失则回退到
 * DATABASE_URL 派生,保证可用但建议生产环境配置独立密钥。
 */

function getKey(): Buffer {
  const secret =
    process.env.SAAS_CONFIG_SECRET ||
    process.env.BETTER_AUTH_SECRET ||
    process.env.DATABASE_URL ||
    'nuota-fallback-secret'
  // 派生固定长度 32 字节密钥
  return crypto.createHash('sha256').update(secret).digest()
}

/** 加密明文,返回 base64(iv:tag:cipher) */
export function encryptSecret(plain: string): string {
  const iv = crypto.randomBytes(12)
  const cipher = crypto.createCipheriv('aes-256-gcm', getKey(), iv)
  const enc = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()])
  const tag = cipher.getAuthTag()
  return Buffer.concat([iv, tag, enc]).toString('base64')
}

/** 解密密文,失败返回 null */
export function decryptSecret(payload: string | null | undefined): string | null {
  if (!payload) return null
  try {
    const raw = Buffer.from(payload, 'base64')
    const iv = raw.subarray(0, 12)
    const tag = raw.subarray(12, 28)
    const data = raw.subarray(28)
    const decipher = crypto.createDecipheriv('aes-256-gcm', getKey(), iv)
    decipher.setAuthTag(tag)
    const dec = Buffer.concat([decipher.update(data), decipher.final()])
    return dec.toString('utf8')
  } catch {
    return null
  }
}

/** 密钥脱敏显示:保留前 4 后 4,中间打码 */
export function maskSecret(secret: string | null | undefined): string {
  if (!secret) return ''
  if (secret.length <= 8) return '••••••••'
  return `${secret.slice(0, 4)}••••••••${secret.slice(-4)}`
}

// ---------------------------------------------------------------------------
// 密码保险库:用独立环境变量 PWD_ENC_KEY 加密存储租户登录密码明文副本。
// 与 SaaS 配置加密刻意分离,密钥泄露面更小;未配置 PWD_ENC_KEY 时直接抛错,
// 以便「查看明文密码 / 重置密码」功能给出明确的部署提示。
// ---------------------------------------------------------------------------
export class PwdKeyMissingError extends Error {
  constructor() {
    super('未配置 PWD_ENC_KEY 环境变量,无法读写密码明文副本')
    this.name = 'PwdKeyMissingError'
  }
}

function getPwdKey(): Buffer {
  const secret = process.env.PWD_ENC_KEY
  if (!secret || secret.length < 16) throw new PwdKeyMissingError()
  return crypto.createHash('sha256').update(secret).digest()
}

/** 是否已配置密码保险库密钥 */
export function isPwdVaultReady(): boolean {
  const secret = process.env.PWD_ENC_KEY
  return !!secret && secret.length >= 16
}

/** 用 PWD_ENC_KEY 加密密码明文,返回 base64(iv:tag:cipher) */
export function encryptPassword(plain: string): string {
  const iv = crypto.randomBytes(12)
  const cipher = crypto.createCipheriv('aes-256-gcm', getPwdKey(), iv)
  const enc = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()])
  const tag = cipher.getAuthTag()
  return Buffer.concat([iv, tag, enc]).toString('base64')
}

/** 用 PWD_ENC_KEY 解密密码明文;密钥缺失抛错,数据损坏返回 null */
export function decryptPassword(payload: string | null | undefined): string | null {
  if (!payload) return null
  const key = getPwdKey() // 缺密钥时抛 PwdKeyMissingError
  try {
    const raw = Buffer.from(payload, 'base64')
    const iv = raw.subarray(0, 12)
    const tag = raw.subarray(12, 28)
    const data = raw.subarray(28)
    const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv)
    decipher.setAuthTag(tag)
    const dec = Buffer.concat([decipher.update(data), decipher.final()])
    return dec.toString('utf8')
  } catch {
    return null
  }
}
