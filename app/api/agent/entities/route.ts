import { NextResponse } from 'next/server'
import { authenticateAgent } from '@/lib/agent-auth'
import { db } from '@/lib/db'
import { entities } from '@/lib/db/schema'
import { eq } from 'drizzle-orm'
import { getTaxProfile } from '@/lib/tax-policy'

export const dynamic = 'force-dynamic'

/**
 * GET /api/agent/entities
 * 财务 Agent 抓取该集团旗下所有门店主体及其税政口径。
 */
export async function GET(req: Request) {
  const principal = await authenticateAgent(req)
  if (!principal) {
    return NextResponse.json(
      { error: 'unauthorized', message: '无效的 Agent 密钥' },
      { status: 401 },
    )
  }

  const rows = await db
    .select()
    .from(entities)
    .where(eq(entities.userId, principal.ownerId))

  const data = rows.map((e) => {
    const profile = getTaxProfile(e.entityType, e.taxpayerType)
    return {
      id: e.id,
      code: e.code,
      name: e.name,
      entityType: e.entityType,
      taxpayerType: e.taxpayerType,
      status: e.status,
      city: e.city,
      region: e.region,
      creditCode: e.creditCode,
      taxPolicy: {
        taxpayerLabel: profile.taxpayerLabel,
        vatRate: profile.vatRate,
        surtaxRate: profile.surtaxRate,
        incomeTaxLabel: profile.incomeTaxLabel,
      },
    }
  })

  return NextResponse.json({ group: principal.name, count: data.length, entities: data })
}
