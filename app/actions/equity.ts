'use server'

import { db } from '@/lib/db'
import { shareholders, entities } from '@/lib/db/schema'
import { getScope } from '@/lib/scope'
import { getFinancialStatements } from '@/app/actions/finance'
import {
  summarizeEquity,
  computeDividends,
  type EquitySummary,
  type DividendRow,
} from '@/lib/equity'
import { and, eq, asc } from 'drizzle-orm'
import { revalidatePath } from 'next/cache'

/** 校验主体归属并返回名称 */
async function assertEntity(ownerId: string, entityId: number) {
  const [e] = await db
    .select({ id: entities.id, name: entities.name })
    .from(entities)
    .where(and(eq(entities.id, entityId), eq(entities.userId, ownerId)))
    .limit(1)
  return e ?? null
}

export type ShareholderRow = {
  id: number
  name: string
  shareType: string
  ratio: number
  position: string | null
  effectiveDate: string | null
  status: string
}

export type EquityData = {
  entityId: number
  entityName: string
  rows: ShareholderRow[]
  summary: EquitySummary
}

/** 获取某门店的股权台账与汇总 */
export async function getEquityData(entityId: number): Promise<EquityData | null> {
  const scope = await getScope()
  // 门店端只能看自己的门店
  if (scope.role === 'store' && scope.entityId !== entityId) return null
  const e = await assertEntity(scope.ownerId, entityId)
  if (!e) return null

  const list = await db
    .select()
    .from(shareholders)
    .where(
      and(
        eq(shareholders.userId, scope.ownerId),
        eq(shareholders.entityId, entityId),
        eq(shareholders.status, 'active'),
      ),
    )
    .orderBy(asc(shareholders.shareType), asc(shareholders.id))

  const rows: ShareholderRow[] = list.map((r) => ({
    id: r.id,
    name: r.name,
    shareType: r.shareType,
    ratio: Number(r.ratio),
    position: r.position,
    effectiveDate: r.effectiveDate,
    status: r.status,
  }))

  return {
    entityId,
    entityName: e.name,
    rows,
    summary: summarizeEquity(rows),
  }
}

export type AddShareholderResult = { ok: true } | { ok: false; error: string }

/** 登记一名持股人 */
export async function addShareholder(input: {
  entityId: number
  name: string
  shareType: 'bank' | 'position' | 'growth'
  ratio: number
  position?: string
  effectiveDate?: string
}): Promise<AddShareholderResult> {
  const scope = await getScope()
  if (scope.role !== 'group') {
    return { ok: false, error: '只有集团管理员可以登记股权' }
  }
  if (!input.name.trim()) return { ok: false, error: '请填写持股人姓名' }
  if (!(input.ratio > 0)) return { ok: false, error: '分红权比例需大于 0' }

  const e = await assertEntity(scope.ownerId, input.entityId)
  if (!e) return { ok: false, error: '门店不存在或无权操作' }

  await db.insert(shareholders).values({
    userId: scope.ownerId,
    entityId: input.entityId,
    name: input.name.trim(),
    shareType: input.shareType,
    ratio: String(input.ratio),
    position: input.position?.trim() || null,
    effectiveDate: input.effectiveDate || null,
    status: 'active',
  })

  revalidatePath('/equity')
  return { ok: true }
}

/** 移除一名持股人(退股/离岗) */
export async function removeShareholder(id: number): Promise<AddShareholderResult> {
  const scope = await getScope()
  if (scope.role !== 'group') {
    return { ok: false, error: '只有集团管理员可以调整股权' }
  }
  await db
    .delete(shareholders)
    .where(and(eq(shareholders.id, id), eq(shareholders.userId, scope.ownerId)))
  revalidatePath('/equity')
  return { ok: true }
}

export type DividendForecast = {
  distributableProfit: number
  details: DividendRow[]
  totalGross: number
  totalTax: number
  totalNet: number
  retained: number
}

/** 年度分红测算:以税后净利润为可分配利润,按分红权比例分配并代扣个税 */
export async function getDividendForecast(entityId: number): Promise<DividendForecast | null> {
  const scope = await getScope()
  if (scope.role === 'store' && scope.entityId !== entityId) return null
  const e = await assertEntity(scope.ownerId, entityId)
  if (!e) return null

  const { income } = await getFinancialStatements(entityId)
  const distributableProfit = income.netProfit

  const list = await db
    .select()
    .from(shareholders)
    .where(
      and(
        eq(shareholders.userId, scope.ownerId),
        eq(shareholders.entityId, entityId),
        eq(shareholders.status, 'active'),
      ),
    )

  const rows = list.map((r) => ({
    name: r.name,
    shareType: r.shareType,
    ratio: Number(r.ratio),
    position: r.position,
  }))

  const { details, totalGross, totalTax, totalNet } = computeDividends(rows, distributableProfit)
  const released = rows.reduce((s, r) => s + (Number(r.ratio) || 0), 0)
  const retained = Math.round(Math.max(0, distributableProfit) * (1 - released / 100))

  return { distributableProfit, details, totalGross, totalTax, totalNet, retained }
}
