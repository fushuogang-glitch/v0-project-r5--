'use server'

import { db } from '@/lib/db'
import { entities, transactions, accounts } from '@/lib/db/schema'
import { getScope, type Scope } from '@/lib/scope'
import { and, eq, type SQL } from 'drizzle-orm'

// ---------------------------------------------------------------------------
// 银行对账(银行存款余额调节)
// 思路:以系统内"银行卡"渠道流水为账面记录,确定性地派生一份银行对账单
// (约 1/10 笔标记为在途未达 + 注入手续费/利息等银行单边项),逐笔勾对后
// 生成一张标准的银行存款余额调节表:
//   账面余额 + 银行已记企业未记(net) = 银行对账单余额 + 企业已记银行未达(net) = 调节后余额
// 两侧相等即"已平"。派生过程基于流水 id 做确定性伪随机,刷新结果稳定。
// ---------------------------------------------------------------------------

const BANK_CHANNEL = '银行卡'

// 基于整数种子的确定性伪随机(0~1),保证每次渲染对账单一致
function seeded(n: number): number {
  const x = Math.sin(n * 9973.13 + 1.7) * 10000
  return x - Math.floor(x)
}

export type ReconItem = {
  id: string
  date: string
  summary: string
  amount: number // 含税发生额(正数)
  direction: 'in' | 'out' // in 进账/收入,out 出账/支出
  kind: 'book_only' | 'bank_only' // book_only 企业已记银行未达;bank_only 银行已记企业未记
  note: string
}

export type BankReconciliation = {
  entityId: number
  entityName: string
  accountName: string
  accountNo: string | null
  // 余额(本期银行卡渠道发生净额口径)
  bookBalance: number // 账面余额
  bankBalance: number // 银行对账单余额
  adjustedBalance: number // 调节后余额(两侧应相等)
  isBalanced: boolean
  difference: number // 账面与对账单的原始差异(未调节前)
  // 勾对统计
  totalLines: number
  matchedCount: number
  matchedAmount: number
  // 未达账项
  bookOnly: ReconItem[] // 企业已记、银行未达(在途收款 / 未达付款)
  bankOnly: ReconItem[] // 银行已记、企业未记(手续费 / 利息等)
}

function accWhere(scope: Scope): SQL | undefined {
  const conds: SQL[] = [eq(accounts.userId, scope.ownerId), eq(accounts.accountType, 'bank')]
  if (scope.entityId != null) conds.push(eq(accounts.entityId, scope.entityId))
  return and(...conds)
}

export async function getBankReconciliation(): Promise<BankReconciliation[]> {
  const scope = await getScope()

  // 取范围内的对公银行账户
  const bankAccounts = await db.select().from(accounts).where(accWhere(scope))
  if (bankAccounts.length === 0) return []

  const entIds = Array.from(new Set(bankAccounts.map((a) => a.entityId)))
  const entList = await db
    .select({ id: entities.id, name: entities.name })
    .from(entities)
    .where(eq(entities.userId, scope.ownerId))
  const nameMap = new Map(entList.map((e) => [e.id, e.name]))

  const result: BankReconciliation[] = []

  for (const acc of bankAccounts) {
    // 该主体的银行卡渠道流水(账面记录)
    const bookRows = await db
      .select({
        id: transactions.id,
        bizDate: transactions.bizDate,
        bizType: transactions.bizType,
        amount: transactions.amount,
        summary: transactions.summary,
        category: transactions.category,
      })
      .from(transactions)
      .where(
        and(
          eq(transactions.userId, scope.ownerId),
          eq(transactions.entityId, acc.entityId),
          eq(transactions.channel, BANK_CHANNEL),
        ),
      )

    let bookBalance = 0 // 账面净额
    let matchedNet = 0 // 已勾对净额
    let matchedCount = 0
    let matchedAmount = 0
    const bookOnly: ReconItem[] = []

    for (const r of bookRows) {
      const amt = Number(r.amount)
      const direction: 'in' | 'out' = r.bizType === 'income' ? 'in' : 'out'
      const signed = direction === 'in' ? amt : -amt
      bookBalance += signed

      // 约 1/10 笔判定为"企业已记、银行未达"(在途账项)
      if (seeded(r.id) < 0.1) {
        bookOnly.push({
          id: `bk-${r.id}`,
          date: r.bizDate,
          summary: r.summary ?? r.category,
          amount: Math.round(amt),
          direction,
          kind: 'book_only',
          note: direction === 'in' ? '在途收款,银行次日入账' : '已开付款指令,银行尚未扣款',
        })
      } else {
        matchedNet += signed
        matchedCount += 1
        matchedAmount += amt
      }
    }

    // 注入确定性的"银行已记、企业未记"单边项(手续费 / 利息 等)
    const bankOnly: ReconItem[] = []
    const s = seeded(acc.id + 31)
    // 账户管理费 / 手续费(出账)——金额随账户确定
    const feeAmt = 8 + Math.round(s * 40) // 8~48 元
    bankOnly.push({
      id: `bo-fee-${acc.id}`,
      date: monthEndStr(),
      summary: '账户管理费及电子回单工本费',
      amount: feeAmt,
      direction: 'out',
      kind: 'bank_only',
      note: '银行已扣,企业尚未入账',
    })
    // 季度结息(进账)——仅部分账户有
    if (seeded(acc.id + 77) > 0.45) {
      const intAmt = 12 + Math.round(seeded(acc.id + 5) * 180) // 12~192 元
      bankOnly.push({
        id: `bo-int-${acc.id}`,
        date: monthEndStr(),
        summary: '活期存款结息',
        amount: intAmt,
        direction: 'in',
        kind: 'bank_only',
        note: '银行已入账,企业尚未确认利息收入',
      })
    }
    // POS 当日结算手续费(出账)——大概率存在
    if (seeded(acc.id + 13) > 0.3) {
      const posFee = 30 + Math.round(seeded(acc.id + 9) * 260) // 30~290 元
      bankOnly.push({
        id: `bo-pos-${acc.id}`,
        date: monthEndStr(),
        summary: 'POS 收单结算手续费',
        amount: posFee,
        direction: 'out',
        kind: 'bank_only',
        note: '收单机构已扣,企业尚未入账',
      })
    }

    const bookOnlyNet = bookOnly.reduce(
      (s, i) => s + (i.direction === 'in' ? i.amount : -i.amount),
      0,
    )
    const bankOnlyNet = bankOnly.reduce(
      (s, i) => s + (i.direction === 'in' ? i.amount : -i.amount),
      0,
    )

    // 银行对账单余额 = 已勾对净额 + 银行单边净额
    const bankBalance = matchedNet + bankOnlyNet
    // 调节后余额(两侧应相等):账面 + 银行单边 = 对账单 + 企业未达
    const adjustedBalance = bookBalance + bankOnlyNet
    const adjustedBankSide = bankBalance + bookOnlyNet

    result.push({
      entityId: acc.entityId,
      entityName: nameMap.get(acc.entityId) ?? '-',
      accountName: acc.name,
      accountNo: acc.accountNo,
      bookBalance: Math.round(bookBalance),
      bankBalance: Math.round(bankBalance),
      adjustedBalance: Math.round(adjustedBalance),
      isBalanced: Math.abs(adjustedBalance - adjustedBankSide) < 1,
      difference: Math.round(bookBalance - bankBalance),
      totalLines: bookRows.length,
      matchedCount,
      matchedAmount: Math.round(matchedAmount),
      bookOnly,
      bankOnly,
    })
  }

  return result.sort((a, b) => b.bookBalance - a.bookBalance)
}

// 本月最后一天(对账截止日)字符串
function monthEndStr(): string {
  const now = new Date()
  const last = new Date(now.getFullYear(), now.getMonth() + 1, 0)
  return `${last.getFullYear()}-${String(last.getMonth() + 1).padStart(2, '0')}-${String(last.getDate()).padStart(2, '0')}`
}
