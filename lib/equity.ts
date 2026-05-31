// 三层股权与分红权释放引擎(依据 PRD 模块七)
// 银股 bank:真金白银出资的实股(工商股东),分红按股息红利 20% 代扣个税
// 身股 position:凭岗位/能力顶的人力股(不出资、非工商股东)
// 发展股 growth:带教成长激励股(不出资、非工商股东)

export type ShareType = 'bank' | 'position' | 'growth'

export const SHARE_TYPE_LABEL: Record<ShareType, string> = {
  bank: '银股',
  position: '身股',
  growth: '发展股',
}

export const SHARE_TYPE_DESC: Record<ShareType, string> = {
  bank: '真金白银出资 · 工商登记股东 · 享决策权 · 分红按股息红利 20% 代扣',
  position: '凭岗位/能力顶的人力股 · 不出资 · 离岗收回 · 个税按协议定性',
  growth: '带教成长激励股 · 不出资 · 按规则归属/退出 · 个税按协议定性',
}

// 规则常量(PRD 3.7.3,可由财税人员后续参数化)
export const EQUITY_RULES = {
  releaseCap: 33, // 单店分红权释放总额上限 %
  bankCap: 20, // 银股总额上限 %
  bankMaxHolders: 5, // 银股股东人数上限
  bankPerHolderCap: 5, // 银股单人上限 %
  managerPositionRatio: 5, // 店长身股 %
  consultantPositionRatio: 3, // 每位顾问身股 %
  growthRatio: 2, // 发展股(店长有带教时)%
}

export type ShareholderLike = {
  name: string
  shareType: string
  ratio: number
  position?: string | null
}

export type EquitySummary = {
  bankTotal: number
  positionTotal: number
  growthTotal: number
  released: number // 实际释放总额
  retained: number // 公司留存
  bankHolders: number
  warnings: string[] // 合规校验提示
}

const round2 = (n: number) => Math.round(n * 100) / 100

/** 汇总三层股权占比并做合规校验 */
export function summarizeEquity(rows: ShareholderLike[]): EquitySummary {
  const active = rows
  let bankTotal = 0
  let positionTotal = 0
  let growthTotal = 0
  let bankHolders = 0
  let bankMaxSingle = 0

  for (const r of active) {
    const ratio = Number(r.ratio) || 0
    if (r.shareType === 'bank') {
      bankTotal += ratio
      bankHolders += 1
      if (ratio > bankMaxSingle) bankMaxSingle = ratio
    } else if (r.shareType === 'position') {
      positionTotal += ratio
    } else if (r.shareType === 'growth') {
      growthTotal += ratio
    }
  }

  bankTotal = round2(bankTotal)
  positionTotal = round2(positionTotal)
  growthTotal = round2(growthTotal)
  const released = round2(bankTotal + positionTotal + growthTotal)
  const retained = round2(100 - released)

  const warnings: string[] = []
  if (released > EQUITY_RULES.releaseCap) {
    warnings.push(`释放总额 ${released}% 已超过单店上限 ${EQUITY_RULES.releaseCap}%`)
  }
  if (bankTotal > EQUITY_RULES.bankCap) {
    warnings.push(`银股总额 ${bankTotal}% 已超过上限 ${EQUITY_RULES.bankCap}%`)
  }
  if (bankHolders > EQUITY_RULES.bankMaxHolders) {
    warnings.push(`银股股东 ${bankHolders} 人已超过上限 ${EQUITY_RULES.bankMaxHolders} 人`)
  }
  if (bankMaxSingle > EQUITY_RULES.bankPerHolderCap) {
    warnings.push(`存在银股单人持股 ${bankMaxSingle}% 超过上限 ${EQUITY_RULES.bankPerHolderCap}%`)
  }

  return { bankTotal, positionTotal, growthTotal, released, retained, bankHolders, warnings }
}

/** 按标准规则测算单店分红权释放结构(PRD 3.7.3 验算) */
export function computeStandardRelease(input: {
  consultantCount: number
  hasMentor: boolean
  bankHolders: number // 银股股东人数
}) {
  const position = round2(
    EQUITY_RULES.managerPositionRatio +
      EQUITY_RULES.consultantPositionRatio * Math.max(0, input.consultantCount),
  )
  const growth = input.hasMentor ? EQUITY_RULES.growthRatio : 0
  // 银股 = 33 − 身股 − 发展股,且受 20% 上限约束
  let bank = round2(EQUITY_RULES.releaseCap - position - growth)
  if (bank < 0) bank = 0
  if (bank > EQUITY_RULES.bankCap) bank = EQUITY_RULES.bankCap
  const released = round2(bank + position + growth)
  const retained = round2(100 - released)
  const bankPerHolder =
    input.bankHolders > 0 ? round2(Math.min(EQUITY_RULES.bankPerHolderCap, bank / input.bankHolders)) : 0

  return { bank, position, growth, released, retained, bankPerHolder }
}

export type DividendRow = {
  name: string
  shareType: ShareType
  position?: string | null
  ratio: number
  gross: number // 应分金额
  taxType: string // 个税类型
  taxWithheld: number // 代扣个税
  net: number // 税后实得
}

/** 年度分红测算:按分红权比例分配可分配利润,并代扣个税 */
export function computeDividends(
  rows: ShareholderLike[],
  distributableProfit: number,
): { details: DividendRow[]; totalGross: number; totalTax: number; totalNet: number } {
  const base = Math.max(0, distributableProfit)
  const details: DividendRow[] = rows.map((r) => {
    const ratio = Number(r.ratio) || 0
    const gross = round2((base * ratio) / 100)
    const st = r.shareType as ShareType
    let taxType: string
    let taxWithheld: number
    if (st === 'bank') {
      // 银股:股息红利所得,20% 代扣
      taxType = '股息红利 20%'
      taxWithheld = round2(gross * 0.2)
    } else {
      // 身股/发展股:按协议定性(工资薪金/劳务),此处提示需财务核定
      taxType = '按协议定性(待核定)'
      taxWithheld = 0
    }
    return {
      name: r.name,
      shareType: st,
      position: r.position,
      ratio,
      gross,
      taxType,
      taxWithheld,
      net: round2(gross - taxWithheld),
    }
  })

  const totalGross = round2(details.reduce((s, d) => s + d.gross, 0))
  const totalTax = round2(details.reduce((s, d) => s + d.taxWithheld, 0))
  const totalNet = round2(totalGross - totalTax)
  return { details, totalGross, totalTax, totalNet }
}
