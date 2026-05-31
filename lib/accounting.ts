/**
 * 自动记账凭证引擎:依据「借贷必相等」的复式记账规则,
 * 从每一笔收支流水自动派生标准记账凭证。凭证不落库,实时派生,永远与流水同步。
 *
 * 科目体系参照《企业会计准则》常用一级科目编码。
 */

export const ACCOUNTS = {
  cash: { code: '1001', name: '库存现金' },
  bank: { code: '1002', name: '银行存款' },
  prepaid: { code: '2203', name: '预收账款' }, // 会员储值
  vatOutput: { code: '2221.01', name: '应交税费—应交增值税(销项税额)' },
  vatInput: { code: '2221.02', name: '应交税费—应交增值税(进项税额)' },
  surtaxPayable: { code: '2221.03', name: '应交税费—附加税费' },
  revenue: { code: '6001', name: '主营业务收入' },
  cogs: { code: '6401', name: '主营业务成本' },
  taxAndSurcharge: { code: '6403', name: '税金及附加' },
  sellingExpense: { code: '6601', name: '销售费用' },
  adminExpense: { code: '6602', name: '管理费用' },
  nonOpExpense: { code: '6711', name: '营业外支出' },
} as const

type Account = { code: string; name: string }

// 费用分类 → 会计科目
const EXPENSE_ACCOUNT: Record<string, Account> = {
  房租物业: ACCOUNTS.adminExpense,
  人力薪酬: ACCOUNTS.adminExpense,
  产品采购: ACCOUNTS.cogs,
  耗材成本: ACCOUNTS.cogs,
  市场推广: ACCOUNTS.sellingExpense,
  水电杂费: ACCOUNTS.adminExpense,
  设备折旧: ACCOUNTS.adminExpense,
  税费: ACCOUNTS.taxAndSurcharge,
  其他支出: ACCOUNTS.nonOpExpense,
}

export type VoucherEntry = {
  account: string
  accountCode: string
  debit: number
  credit: number
}

export type Voucher = {
  voucherNo: string // 凭证号 记-0001
  txId: number
  date: string
  summary: string
  bizType: 'income' | 'expense'
  entries: VoucherEntry[]
  total: number // 借方合计(=贷方合计)
}

export type TxForVoucher = {
  id: number
  bizDate: string
  bizType: string
  category: string
  channel: string
  amount: number // 含税
  netAmount: number // 不含税
  taxAmount: number // 增值税
  invoiceKind: string
  summary: string | null
}

/** 货币资金科目:按收付渠道判断 */
function cashAccount(channel: string): Account {
  if (channel.includes('现金')) return ACCOUNTS.cash
  if (channel.includes('储值')) return ACCOUNTS.prepaid
  return ACCOUNTS.bank
}

function d(account: Account, debit: number): VoucherEntry {
  return { account: account.name, accountCode: account.code, debit, credit: 0 }
}
function c(account: Account, credit: number): VoucherEntry {
  return { account: account.name, accountCode: account.code, debit: 0, credit }
}

/** 从单笔流水生成记账凭证 */
export function buildVoucher(tx: TxForVoucher, index: number): Voucher {
  const gross = tx.amount
  const net = tx.netAmount || tx.amount
  const vat = tx.taxAmount || 0
  const cash = cashAccount(tx.channel)
  const entries: VoucherEntry[] = []

  if (tx.bizType === 'income') {
    if (tx.category === '会员储值') {
      // 储值充值:确认预收账款负债,不确认收入
      entries.push(d(cash, gross))
      entries.push(c(ACCOUNTS.prepaid, gross))
    } else if (vat > 0) {
      entries.push(d(cash, gross))
      entries.push(c(ACCOUNTS.revenue, net))
      entries.push(c(ACCOUNTS.vatOutput, vat))
    } else {
      entries.push(d(cash, gross))
      entries.push(c(ACCOUNTS.revenue, gross))
    }
  } else {
    const acc = EXPENSE_ACCOUNT[tx.category] ?? ACCOUNTS.adminExpense
    if (tx.invoiceKind === 'special' && vat > 0) {
      // 取得专票:进项税额可抵扣,费用按不含税入账
      entries.push(d(acc, net))
      entries.push(d(ACCOUNTS.vatInput, vat))
      entries.push(c(cash, gross))
    } else {
      // 普票 / 收据 / 未开票:进项不可抵扣,全额计入费用
      entries.push(d(acc, gross))
      entries.push(c(cash, gross))
    }
  }

  const total = entries.reduce((s, e) => s + e.debit, 0)

  return {
    voucherNo: `记-${String(index + 1).padStart(4, '0')}`,
    txId: tx.id,
    date: tx.bizDate,
    summary: tx.summary || `${tx.category} · ${tx.channel}`,
    bizType: tx.bizType as 'income' | 'expense',
    entries,
    total,
  }
}

/** 批量生成凭证(按日期升序编号) */
export function buildVouchers(txs: TxForVoucher[]): Voucher[] {
  const sorted = [...txs].sort((a, b) =>
    a.bizDate < b.bizDate ? -1 : a.bizDate > b.bizDate ? 1 : a.id - b.id,
  )
  return sorted.map((tx, i) => buildVoucher(tx, i))
}
