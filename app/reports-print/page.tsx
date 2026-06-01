import { buildReportPackage } from '@/lib/report-data'
import { buildTaxFilingPackage } from '@/lib/tax-filing'
import { PrintTrigger } from '@/components/print-trigger'

export const dynamic = 'force-dynamic'

function fmtCell(v: string | number) {
  if (typeof v === 'number') return v.toLocaleString('zh-CN')
  return v
}

export default async function ReportsPrintPage({
  searchParams,
}: {
  searchParams: Promise<{
    kind?: string
    target?: string
    entity?: string
    year?: string
    quarter?: string
  }>
}) {
  const params = await searchParams

  let pkg
  try {
    if (params.kind === 'filing') {
      const entityId = Number(params.entity)
      const year = Number(params.year) || new Date().getFullYear()
      const quarter = Number(params.quarter) || 1
      if (!Number.isFinite(entityId)) throw new Error('请选择纳税主体')
      pkg = await buildTaxFilingPackage(entityId, { year, quarter })
    } else {
      const targetRaw = params.target
      const target: 'group' | number =
        !targetRaw || targetRaw === 'group' ? 'group' : Number(targetRaw)
      pkg = await buildReportPackage(
        target === 'group' || !Number.isFinite(target as number) ? 'group' : (target as number),
      )
    }
  } catch (e) {
    return (
      <main className="mx-auto max-w-2xl p-10 text-center">
        <p className="text-lg font-medium text-neutral-800">无法生成报表</p>
        <p className="mt-2 text-sm text-neutral-500">
          {e instanceof Error ? e.message : '请返回重试'}
        </p>
      </main>
    )
  }

  return (
    <main className="mx-auto max-w-4xl bg-white p-8 text-neutral-900 print:p-0">
      <PrintTrigger />

      <header className="mb-6 border-b-2 border-neutral-800 pb-4 text-center">
        <h1 className="text-2xl font-bold tracking-tight">{pkg.title}</h1>
        <p className="mt-1 text-sm text-neutral-600">{pkg.scopeLabel}</p>
        <p className="mt-0.5 text-xs text-neutral-500">
          {pkg.period} · 生成时间 {pkg.generatedAt}
        </p>
      </header>

      <div className="space-y-8">
        {pkg.sheets.map((sheet) => (
          <section key={sheet.key} className="break-inside-avoid">
            <div className="mb-2 flex items-baseline justify-between">
              <h2 className="text-base font-semibold">{sheet.title}</h2>
              {sheet.note && <span className="text-xs text-neutral-500">{sheet.note}</span>}
            </div>
            <table className="w-full border-collapse text-sm">
              <thead>
                <tr className="bg-neutral-100">
                  {sheet.columns.map((c, i) => (
                    <th
                      key={i}
                      className={`border border-neutral-300 px-3 py-1.5 font-medium ${
                        i === 0 ? 'text-left' : 'text-right'
                      }`}
                    >
                      {c}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {sheet.rows.map((row, ri) => (
                  <tr key={ri}>
                    {row.map((cell, ci) => (
                      <td
                        key={ci}
                        className={`border border-neutral-300 px-3 py-1.5 tabular-nums ${
                          ci === 0 ? 'text-left' : 'text-right'
                        }`}
                      >
                        {fmtCell(cell)}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </section>
        ))}
      </div>

      <footer className="mt-10 border-t border-neutral-300 pt-3 text-center text-xs text-neutral-400">
        诺塔智财务 ERP · 本报表由系统依据记账凭证自动生成,仅供管理决策与申报预填参考
      </footer>
    </main>
  )
}
