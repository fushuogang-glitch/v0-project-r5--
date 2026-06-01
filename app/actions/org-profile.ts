'use server'

import { db } from '@/lib/db'
import { orgProfile } from '@/lib/db/schema'
import { getScope } from '@/lib/scope'
import { encryptSecret, decryptSecret } from '@/lib/crypto'
import { eq } from 'drizzle-orm'
import { revalidatePath } from 'next/cache'

// ---------------------------------------------------------------------------
// 品牌信息(租户自有品牌,如「双美集团」)
// ---------------------------------------------------------------------------
export type BrandProfile = {
  brandName: string
  groupName: string
  shortName: string
  slogan: string
  legalEntity: string
  industry: string
  contactName: string
  contactPhone: string
  contactEmail: string
  headquarters: string
  website: string
  hasPin: boolean
  autoSyncEnabled: boolean
  autoSyncIntervalMin: number
  primaryChannel: string
  lastAutoSyncAt: string | null
}

const EMPTY: BrandProfile = {
  brandName: '',
  groupName: '',
  shortName: '',
  slogan: '',
  legalEntity: '',
  industry: '',
  contactName: '',
  contactPhone: '',
  contactEmail: '',
  headquarters: '',
  website: '',
  hasPin: false,
  autoSyncEnabled: false,
  autoSyncIntervalMin: 360,
  primaryChannel: 'agent',
  lastAutoSyncAt: null,
}

async function loadRow(userId: string) {
  const [row] = await db
    .select()
    .from(orgProfile)
    .where(eq(orgProfile.userId, userId))
    .limit(1)
  return row ?? null
}

/** 读取当前集团的品牌信息(供设置页与驾驶舱标题用) */
export async function getBrandProfile(): Promise<BrandProfile> {
  const scope = await getScope()
  const row = await loadRow(scope.ownerId)
  if (!row) return EMPTY
  return {
    brandName: row.brandName ?? '',
    groupName: row.groupName ?? '',
    shortName: row.shortName ?? '',
    slogan: row.slogan ?? '',
    legalEntity: row.legalEntity ?? '',
    industry: row.industry ?? '',
    contactName: row.contactName ?? '',
    contactPhone: row.contactPhone ?? '',
    contactEmail: row.contactEmail ?? '',
    headquarters: row.headquarters ?? '',
    website: row.website ?? '',
    hasPin: !!row.securityPinEnc,
    autoSyncEnabled: row.autoSyncEnabled,
    autoSyncIntervalMin: row.autoSyncIntervalMin,
    primaryChannel: row.primaryChannel,
    lastAutoSyncAt: row.lastAutoSyncAt ? row.lastAutoSyncAt.toISOString() : null,
  }
}

/** 仅取驾驶舱标题所需的集团显示名 */
export async function getGroupDisplayName(): Promise<string | null> {
  const scope = await getScope()
  const row = await loadRow(scope.ownerId)
  return row?.groupName?.trim() || row?.brandName?.trim() || null
}

export type SaveResult = { ok: true } | { ok: false; error: string }

async function upsert(userId: string, values: Partial<typeof orgProfile.$inferInsert>) {
  const existing = await loadRow(userId)
  if (existing) {
    await db
      .update(orgProfile)
      .set({ ...values, updatedAt: new Date() })
      .where(eq(orgProfile.userId, userId))
  } else {
    await db.insert(orgProfile).values({ userId, ...values })
  }
}

/** 保存品牌信息(仅集团管理员) */
export async function saveBrandProfile(input: {
  brandName?: string
  groupName?: string
  shortName?: string
  slogan?: string
  legalEntity?: string
  industry?: string
  contactName?: string
  contactPhone?: string
  contactEmail?: string
  headquarters?: string
  website?: string
}): Promise<SaveResult> {
  const scope = await getScope()
  if (scope.role !== 'group') return { ok: false, error: '仅集团管理员可登记品牌信息' }

  const norm = (v?: string) => (v && v.trim() ? v.trim() : null)
  await upsert(scope.ownerId, {
    brandName: norm(input.brandName),
    groupName: norm(input.groupName),
    shortName: norm(input.shortName),
    slogan: norm(input.slogan),
    legalEntity: norm(input.legalEntity),
    industry: norm(input.industry),
    contactName: norm(input.contactName),
    contactPhone: norm(input.contactPhone),
    contactEmail: norm(input.contactEmail),
    headquarters: norm(input.headquarters),
    website: norm(input.website),
  })

  revalidatePath('/settings')
  revalidatePath('/', 'layout')
  revalidatePath('/')
  return { ok: true }
}

// ---------------------------------------------------------------------------
// 安全 PIN:用于解锁敏感模块(NOTA API 密钥等),仅集团管理员可设置/校验
// ---------------------------------------------------------------------------

/** 设置 / 修改安全 PIN(6 位数字)。若已存在 PIN,需提供旧 PIN 校验。 */
export async function setSecurityPin(input: {
  newPin: string
  oldPin?: string
}): Promise<SaveResult> {
  const scope = await getScope()
  if (scope.role !== 'group') return { ok: false, error: '仅集团管理员可设置安全 PIN' }

  const pin = input.newPin.trim()
  if (!/^\d{6}$/.test(pin)) return { ok: false, error: '安全 PIN 必须为 6 位数字' }

  const row = await loadRow(scope.ownerId)
  if (row?.securityPinEnc) {
    const current = decryptSecret(row.securityPinEnc)
    if (current && current !== (input.oldPin ?? '').trim()) {
      return { ok: false, error: '原安全 PIN 不正确' }
    }
  }

  await upsert(scope.ownerId, { securityPinEnc: encryptSecret(pin) })
  revalidatePath('/settings')
  return { ok: true }
}

/** 校验安全 PIN,用于解锁敏感模块。返回是否通过。 */
export async function verifySecurityPin(pin: string): Promise<
  { ok: true } | { ok: false; error: string }
> {
  const scope = await getScope()
  if (scope.role !== 'group') return { ok: false, error: '无权限' }

  const row = await loadRow(scope.ownerId)
  if (!row?.securityPinEnc) {
    return { ok: false, error: '尚未设置安全 PIN,请先在下方设置' }
  }
  const current = decryptSecret(row.securityPinEnc)
  if (current && current === pin.trim()) return { ok: true }
  return { ok: false, error: '安全 PIN 不正确' }
}

// ---------------------------------------------------------------------------
// 自动同步设置(双架构)
// ---------------------------------------------------------------------------

export async function saveAutoSyncSettings(input: {
  autoSyncEnabled: boolean
  autoSyncIntervalMin: number
  primaryChannel: 'agent' | 'auto'
}): Promise<SaveResult> {
  const scope = await getScope()
  if (scope.role !== 'group') return { ok: false, error: '仅集团管理员可配置' }

  const interval = Math.max(30, Math.min(1440, Math.round(input.autoSyncIntervalMin || 360)))
  await upsert(scope.ownerId, {
    autoSyncEnabled: input.autoSyncEnabled,
    autoSyncIntervalMin: interval,
    primaryChannel: input.primaryChannel === 'auto' ? 'auto' : 'agent',
  })
  revalidatePath('/settings')
  return { ok: true }
}
