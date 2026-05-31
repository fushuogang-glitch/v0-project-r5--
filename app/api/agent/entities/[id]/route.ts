import { NextResponse } from 'next/server'
import { authenticateAgent } from '@/lib/agent-auth'
import { db } from '@/lib/db'
import { entities, transactions } from '@/lib/db/schema'
import { and, eq, desc } from 'drizzle-orm'
import { getTaxProfile } from '@/lib/tax-policy'
import {
  buildVouchers,
  computeStatements,
  type TxForVoucher,
  type TxForStatement,
} from '@/lib/accounting'

export const dynamic = 'force-dynamic'

/** 校验 Agent 对该主体的访问权限,返回主体行 */
async function resolveEntity(req: Request, entityId: number) {
  const principal = await authenticateAgent(req)
  if (!principal) return { error: 'unauthorized' as const }
  const [e] = await db
    .select()
    .from(entities)
    .where(and(eq(entities.id, entityId), eq(entities.userId, principal.ownerId)))
    .limit(1)
  if (!e) return { error: 'not_found' as const }
  return { principal, entity: e }
}

/**
 * GET /api/agent/entities/:id
 * 抓取门店财务数据:流水、记账凭证、利润表与资产负债表。
 */
export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params
  const entityId = Number(id)
  if (!Number.isFinite(entityId)) {
    return NextResponse.json({ error: 'bad_request' }, { status: 400 })
  }

  const resolved = await resolveEntity(req, entityId)
  if (resolved.error === 'unauthorized') {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }
  if (resolved.error === 'not_found') {
    return NextResponse.json({ error: 'not_found' }, { status: 404 })
  }
  const { entity: e } = resolved
  const profile = getTaxProfile(e.entityType, e.taxpayerType)

  const rows = await db
    .select()
    .from(transactions)
    .where(eq(transactions.entityId, entityId))
    .orderBy(desc(transactions.bizDate))

  const txForVoucher: TxForVoucher[] = rows.map((r) => ({
    id: r.id,
    bizDate: r.bizDate,
    bizType: r.bizType,
    category: r.category,
    channel: r.channel,
    amount: Number(r.amount),
    netAmount: Number(r.netAmount),
    taxAmount: Number(r.taxAmount),
    invoiceKind: r.invoiceKind,
    summary: r.summary,
  }))

  const txForStatement: TxForStatement[] = rows.map((r) => ({
    bizType: r.bizType,
    category: r.category,
    channel: r.channel,
    amount: Number(r.amount),
    netAmount: Number(r.netAmount),
    taxAmount: Number(r.taxAmount),
    surtaxAmount: Number(r.surtaxAmount),
    invoiceKind: r.invoiceKind,
  }))

  const statements = computeStatements(txForStatement, {
    incomeTaxKind: profile.incomeTaxKind,
    incomeTaxLabel: profile.incomeTaxLabel,
  })

  return NextResponse.json({
    entity: { id: e.id, code: e.code, name: e.name },
    transactions: rows.map((r) => ({
      id: r.id,
      bizDate: r.bizDate,
      bizType: r.bizType,
      category: r.category,
      channel: r.channel,
      amount: Number(r.amount),
      netAmount: Number(r.netAmount),
      taxAmount: Number(r.taxAmount),
      invoiceKind: r.invoiceKind,
      summary: r.summary,
      source: r.source,
    })),
    vouchers: buildVouchers(txForVoucher),
    statements,
  })
}

/**
 * POST /api/agent/entities/:id
 * 财务 Agent 回填一笔流水。系统按主体税政自动价税分离并计税。
 * body: { bizType, bizDate, category, channel, amount, invoiceMedium?, invoiceKind?, summary? }
 */
export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params
  const entityId = Number(id)
  if (!Number.isFinite(entityId)) {
    return NextResponse.json({ error: 'bad_request' }, { status: 400 })
  }

  const resolved = await resolveEntity(req, entityId)
  if (resolved.error === 'unauthorized') {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }
  if (resolved.error === 'not_found') {
    return NextResponse.json({ error: 'not_found' }, { status: 404 })
  }
  const { principal, entity: e } = resolved

  let body: Record<string, unknown>
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'invalid_json' }, { status: 400 })
  }

  const bizType = body.bizType === 'income' ? 'income' : 'expense'
  const amount = Number(body.amount)
  const category = String(body.category ?? '')
  if (!(amount > 0)) {
    return NextResponse.json({ error: 'amount_required' }, { status: 422 })
  }
  if (!category) {
    return NextResponse.json({ error: 'category_required' }, { status: 422 })
  }

  const profile = getTaxProfile(e.entityType, e.taxpayerType)
  const invoiceMedium = String(body.invoiceMedium ?? 'none')
  const invoiced = invoiceMedium !== 'none'
  const rate = invoiced ? profile.vatRate : 0
  const net = rate > 0 ? amount / (1 + rate) : amount
  const vat = amount - net
  const surtax = vat * profile.surtaxRate

  const [row] = await db
    .insert(transactions)
    .values({
      userId: principal.ownerId,
      entityId,
      bizDate: String(body.bizDate ?? new Date().toISOString().slice(0, 10)),
      bizType,
      category,
      channel: String(body.channel ?? (bizType === 'income' ? '现金' : '银行卡')),
      amount: String(Math.round(amount * 100) / 100),
      taxRate: String(rate),
      taxAmount: String(Math.round(vat * 100) / 100),
      surtaxAmount: String(Math.round(surtax * 100) / 100),
      netAmount: String(Math.round(net * 100) / 100),
      invoiced,
      invoiceMedium,
      invoiceKind: String(body.invoiceKind ?? 'none'),
      invoiceNo: body.invoiceNo ? String(body.invoiceNo) : null,
      summary: body.summary ? String(body.summary) : null,
      source: 'agent',
      status: 'posted',
    })
    .returning({ id: transactions.id })

  return NextResponse.json({
    ok: true,
    id: row.id,
    computed: {
      netAmount: Math.round(net * 100) / 100,
      taxAmount: Math.round(vat * 100) / 100,
      surtaxAmount: Math.round(surtax * 100) / 100,
      vatRate: rate,
    },
  })
}
