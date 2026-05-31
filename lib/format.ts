// 金额格式化:¥ 千分位
export function formatCurrency(value: number, fractionDigits = 0): string {
  return (
    '¥' +
    value.toLocaleString('zh-CN', {
      minimumFractionDigits: fractionDigits,
      maximumFractionDigits: fractionDigits,
    })
  )
}

// 紧凑金额:万 / 元
export function formatCompactCurrency(value: number): string {
  if (Math.abs(value) >= 10000) {
    return '¥' + (value / 10000).toFixed(1) + '万'
  }
  return '¥' + Math.round(value).toLocaleString('zh-CN')
}

// 百分比
export function formatPercent(value: number, fractionDigits = 1): string {
  return value.toFixed(fractionDigits) + '%'
}

// 带正负号的百分比(用于环比)
export function formatSignedPercent(value: number, fractionDigits = 1): string {
  const sign = value > 0 ? '+' : ''
  return sign + value.toFixed(fractionDigits) + '%'
}

// 月份标签 2024-03 -> 3月
export function formatMonthLabel(month: string): string {
  const m = month.split('-')[1]
  return Number(m) + '月'
}

// 数字千分位
export function formatNumber(value: number): string {
  return value.toLocaleString('zh-CN')
}
