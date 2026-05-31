import { NextResponse } from 'next/server'
import { authenticateAgent } from '@/lib/agent-auth'
import { db } from '@/lib/db'
import { salaries, employees } from '@/lib/db/schema'
import { and, eq, asc } from 'drizzle-orm'

export const dynamic = 'force-dynamic'

function n(v: unknown): number {
  const x = Number(v)
  return Number.isFinite(x) ? x : 0
}
const money = (x: number) => String(Math.round(x * 100) / 100)

function serialize(s: typeof salaries.$inferSelect) {
  return {
    id: s.id,
    employeeId: s.employeeId,
    entityId: s.entityId,
    year: s.year,
    month: s.month,
    baseSalary: Number(s.baseSalary),
    commission: Number(s.commission),
    allowance: Number(s.allowance),
    deduction: Number(s.deduction),
    netPay: Number(s.netPay),
    note: s.note,
    source: s.source,
  }
}

/**
 * GET /api/agent/salaries
 * 查询工资记录。?employeeId= 必选;?year= 可选(默认当年)。
 * 返回该员工当年逐月明细 + 年度汇总(各项合计)。
 */
export async function GET(req: Request) {
  const principal = await authenticateAgent(req)
  if (!principal) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }

  const url = new URL(req.url)
  const employeeId = Number(url.searchParams.get('employeeId'))
  if (!Number.isFinite(employeeId)) {
    return NextResponse.json(
      { error: 'employeeId_required', message: '请提供 employeeId' },
      { status: 422 },
    )
  }
  const year = Number(url.searchParams.get('year')) || new Date().getFullYear()

  const rows = await db
    .select()
    .from(salaries)
    .where(
      and(
        eq(salaries.userId, principal.ownerId),
        eq(salaries.employeeId, employeeId),
        eq(salaries.year, year),
      ),
    )
    .orderBy(asc(salaries.month))

  const months = rows.map(serialize)
  const summary = months.reduce(
    (acc, m) => ({
      baseSalary: acc.baseSalary + m.baseSalary,
      commission: acc.commission + m.commission,
      allowance: acc.allowance + m.allowance,
      deduction: acc.deduction + m.deduction,
      netPay: acc.netPay + m.netPay,
    }),
    { baseSalary: 0, commission: 0, allowance: 0, deduction: 0, netPay: 0 },
  )

  return NextResponse.json({ employeeId, year, months, annualSummary: summary })
}

/**
 * POST /api/agent/salaries
 * 录入 / 覆盖某员工某月工资(同员工同月份唯一,重复录入会更新)。
 * body: { employeeId, year, month(1-12), baseSalary?, commission?,
 *         allowance?, deduction?, netPay?(缺省=base+commission+allowance-deduction), note? }
 */
export async function POST(req: Request) {
  const principal = await authenticateAgent(req)
  if (!principal) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }

  let body: Record<string, unknown>
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'invalid_json' }, { status: 400 })
  }

  const employeeId = Number(body.employeeId)
  const year = Number(body.year)
  const month = Number(body.month)
  if (!Number.isFinite(employeeId)) {
    return NextResponse.json({ error: 'employeeId_required' }, { status: 422 })
  }
  if (!Number.isFinite(year) || !Number.isFinite(month) || month < 1 || month > 12) {
    return NextResponse.json(
      { error: 'period_invalid', message: 'year/month 不合法' },
      { status: 422 },
    )
  }

  // 校验员工归属本集团,并带出其所属门店
  const [emp] = await db
    .select({ id: employees.id, entityId: employees.entityId })
    .from(employees)
    .where(and(eq(employees.id, employeeId), eq(employees.userId, principal.ownerId)))
    .limit(1)
  if (!emp) {
    return NextResponse.json({ error: 'employee_not_found' }, { status: 404 })
  }

  const baseSalary = n(body.baseSalary)
  const commission = n(body.commission)
  const allowance = n(body.allowance)
  const deduction = n(body.deduction)
  const netPay =
    body.netPay != null ? n(body.netPay) : baseSalary + commission + allowance - deduction

  const values = {
    userId: principal.ownerId,
    employeeId,
    entityId: emp.entityId,
    year,
    month,
    baseSalary: money(baseSalary),
    commission: money(commission),
    allowance: money(allowance),
    deduction: money(deduction),
    netPay: money(netPay),
    note: body.note ? String(body.note) : null,
    source: 'agent',
  }

  // upsert:同 (userId, employeeId, year, month) 已存在则更新
  const [row] = await db
    .insert(salaries)
    .values(values)
    .onConflictDoUpdate({
      target: [salaries.userId, salaries.employeeId, salaries.year, salaries.month],
      set: {
        entityId: values.entityId,
        baseSalary: values.baseSalary,
        commission: values.commission,
        allowance: values.allowance,
        deduction: values.deduction,
        netPay: values.netPay,
        note: values.note,
        source: values.source,
      },
    })
    .returning()

  return NextResponse.json({ ok: true, salary: serialize(row) }, { status: 201 })
}
