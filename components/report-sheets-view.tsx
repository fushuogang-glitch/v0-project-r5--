import type { ReportPackage } from '@/lib/report-data'

function fmtCell(v: string | number) {
  if (typeof v === 'number') return v.toLocaleString('zh-CN')
  return v
}

export function ReportSheetsView({ pkg }: { pkg: ReportPackage }) {
  return (
    <div className="space-y-6">
      {pkg.sheets.map((sheet) => (
        <div key={sheet.key} className="overflow-hidden rounded-lg border border-border bg-card">
          <div className="flex items-baseline justify-between border-b border-border px-4 py-2.5">
            <h3 className="text-sm font-semibold text-foreground">{sheet.title}</h3>
            {sheet.note && <span className="text-xs text-muted-foreground">{sheet.note}</span>}
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted/40 text-xs text-muted-foreground">
                <tr>
                  {sheet.columns.map((c, i) => (
                    <th
                      key={i}
                      className={`px-4 py-2 font-medium ${i === 0 ? 'text-left' : 'text-right'}`}
                    >
                      {c}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {sheet.rows.map((row, ri) => (
                  <tr key={ri} className="border-t border-border">
                    {row.map((cell, ci) => (
                      <td
                        key={ci}
                        className={`px-4 py-2 tabular-nums ${
                          ci === 0 ? 'text-left text-foreground' : 'text-right text-muted-foreground'
                        }`}
                      >
                        {fmtCell(cell)}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ))}
    </div>
  )
}
