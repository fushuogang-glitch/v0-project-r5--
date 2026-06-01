export const statusMeta: Record<string, { label: string; dot: string; text: string; chip: string }> = {
  ok: { label: '正常', dot: 'bg-emerald-400', text: 'text-emerald-400', chip: 'bg-emerald-400/10 text-emerald-300' },
  risk: { label: '风险', dot: 'bg-amber-400', text: 'text-amber-400', chip: 'bg-amber-400/10 text-amber-300' },
  down: { label: '异常', dot: 'bg-red-500', text: 'text-red-400', chip: 'bg-red-500/10 text-red-300' },
  onboarding: { label: '待激活', dot: 'bg-neutral-500', text: 'text-neutral-400', chip: 'bg-neutral-700/40 text-neutral-300' },
}

export const levelMeta: Record<string, { label: string; chip: string; bar: string }> = {
  risk: { label: '严重', chip: 'bg-red-500/15 text-red-300', bar: 'bg-red-500' },
  warn: { label: '警告', chip: 'bg-amber-400/15 text-amber-300', bar: 'bg-amber-400' },
  info: { label: '提示', chip: 'bg-sky-400/15 text-sky-300', bar: 'bg-sky-400' },
}

export function relTime(iso: string | null): string {
  if (!iso) return '从未'
  const diff = Date.now() - new Date(iso).getTime()
  const d = Math.floor(diff / 86400000)
  if (d >= 1) return `${d} 天前`
  const h = Math.floor(diff / 3600000)
  if (h >= 1) return `${h} 小时前`
  const m = Math.floor(diff / 60000)
  if (m >= 1) return `${m} 分钟前`
  return '刚刚'
}
