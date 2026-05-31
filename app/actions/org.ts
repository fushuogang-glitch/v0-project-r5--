'use server'

import { auth } from '@/lib/auth'
import { db, pool } from '@/lib/db'
import { user as userTable, entities, accounts } from '@/lib/db/schema'
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

export type CreateEntityResult =
  | { ok: true; entityId: number }
  | { ok: false; error: string }

/** 集团总部开设新门店:创建主体并自动套帐(生成默认收款账户) */
export async function createEntity(input: {
  name: string
  city: string
  entityType?: string
  taxpayerType?: string
  legalPerson?: string
  region?: string
  creditCode?: string
}): Promise<CreateEntityResult> {
  const scope = await getScope()
  if (scope.role !== 'group') {
    return { ok: false, error: '只有集团总部可以开设新门店' }
  }
  if (!input.name.trim()) return { ok: false, error: '请填写门店名称' }
  if (!input.city.trim()) return { ok: false, error: '请填写所在城市' }

  const entityType = input.entityType ?? 'store'
  const taxpayerType = input.taxpayerType ?? 'small'

  // 自动生成主体编号:取当前集团下主体数量 + 1
  const existing = await db
    .select({ id: entities.id })
    .from(entities)
    .where(eq(entities.userId, scope.ownerId))
  const code = `ME${String(existing.length + 1).padStart(3, '0')}`

  const [created] = await db
    .insert(entities)
    .values({
      userId: scope.ownerId,
      name: input.name.trim(),
      code,
      entityType,
      taxpayerType,
      legalPerson: input.legalPerson?.trim() || null,
      region: input.region?.trim() || input.city.trim(),
      city: input.city.trim(),
      creditCode: input.creditCode?.trim() || null,
      status: 'active',
      establishDate: new Date().toISOString().slice(0, 10),
    })
    .returning({ id: entities.id })

  // 套帐:为新门店生成一套默认收款账户
  const holder = `${input.city.trim()}${input.name.trim()}`
  const defaults = [
    { name: '微信收款', accountType: 'wechat', channel: '微信' },
    { name: '支付宝收款', accountType: 'alipay', channel: '支付宝' },
    { name: '对公银行账户', accountType: 'bank', channel: '银行卡' },
    { name: '门店现金', accountType: 'cash', channel: '现金' },
    { name: '会员储值账户', accountType: 'stored_value', channel: '储值余额' },
  ]
  await db.insert(accounts).values(
    defaults.map((d) => ({
      userId: scope.ownerId,
      entityId: created.id,
      name: d.name,
      accountType: d.accountType,
      channel: d.channel,
      accountNo:
        d.accountType === 'bank'
          ? `**** **** **** ${1000 + created.id}`
          : d.accountType === 'cash'
            ? null
            : `${holder}-${d.channel}`,
      holder,
      status: 'active',
    })),
  )

  revalidatePath('/entities')
  revalidatePath('/', 'layout')
  return { ok: true, entityId: created.id }
}

export type CreateAccountResult = { ok: true } | { ok: false; error: string }

/** 为某主体手动添加一个收款账户 */
export async function createAccount(input: {
  entityId: number
  name: string
  accountType: string
  channel: string
  accountNo?: string
  holder?: string
}): Promise<CreateAccountResult> {
  const scope = await getScope()
  // 门店端只能为自己锁定的门店添加账户;集团端可为旗下任意主体添加
  if (scope.role === 'store' && scope.entityId !== input.entityId) {
    return { ok: false, error: '门店端只能管理本门店的账户' }
  }
  if (!input.name.trim()) return { ok: false, error: '请填写账户名称' }
  if (!input.channel.trim()) return { ok: false, error: '请填写收款渠道' }

  // 校验主体归属
  const [entity] = await db
    .select({ id: entities.id })
    .from(entities)
    .where(and(eq(entities.id, input.entityId), eq(entities.userId, scope.ownerId)))
    .limit(1)
  if (!entity) return { ok: false, error: '主体不存在或无权操作' }

  await db.insert(accounts).values({
    userId: scope.ownerId,
    entityId: input.entityId,
    name: input.name.trim(),
    accountType: input.accountType || 'bank',
    channel: input.channel.trim(),
    accountNo: input.accountNo?.trim() || null,
    holder: input.holder?.trim() || null,
    status: 'active',
  })

  revalidatePath(`/entities/${input.entityId}`)
  return { ok: true }
}

export type UpdateEntityInfoResult = { ok: true } | { ok: false; error: string }

/** 信息登记:更新主体的工商 / 税务 / 银行登记信息 */
export async function updateEntityInfo(input: {
  entityId: number
  legalPerson?: string
  creditCode?: string
  region?: string
  city?: string
  address?: string
  phone?: string
  taxAuthority?: string
  bankName?: string
  bankAccount?: string
  establishDate?: string
}): Promise<UpdateEntityInfoResult> {
  const scope = await getScope()
  if (scope.role !== 'group') {
    return { ok: false, error: '只有集团管理员可以登记主体信息' }
  }

  const [entity] = await db
    .select({ id: entities.id })
    .from(entities)
    .where(and(eq(entities.id, input.entityId), eq(entities.userId, scope.ownerId)))
    .limit(1)
  if (!entity) return { ok: false, error: '主体不存在或无权操作' }

  const norm = (v?: string) => (v && v.trim() ? v.trim() : null)
  await db
    .update(entities)
    .set({
      legalPerson: norm(input.legalPerson),
      creditCode: norm(input.creditCode),
      region: norm(input.region),
      city: norm(input.city),
      address: norm(input.address),
      phone: norm(input.phone),
      taxAuthority: norm(input.taxAuthority),
      bankName: norm(input.bankName),
      bankAccount: norm(input.bankAccount),
      establishDate: norm(input.establishDate),
    })
    .where(and(eq(entities.id, input.entityId), eq(entities.userId, scope.ownerId)))

  revalidatePath(`/entities/${input.entityId}`)
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
