import ExcelJS from 'exceljs'
import type { ReportPackage } from '@/lib/report-data'

/** 生成多 Sheet 的 Excel 工作簿 Buffer */
export async function buildWorkbook(pkg: ReportPackage): Promise<Buffer> {
  const wb = new ExcelJS.Workbook()
  wb.creator = '诺塔智财务 ERP'
  wb.created = new Date()

  for (const sheet of pkg.sheets) {
    const ws = wb.addWorksheet(sheet.title)
    const colCount = sheet.columns.length

    // 标题行
    ws.mergeCells(1, 1, 1, colCount)
    const titleCell = ws.getCell(1, 1)
    titleCell.value = `${sheet.title} · ${pkg.scopeLabel}`
    titleCell.font = { bold: true, size: 14 }
    titleCell.alignment = { horizontal: 'center' }

    // 副标题(期间 + 备注)
    ws.mergeCells(2, 1, 2, colCount)
    const subCell = ws.getCell(2, 1)
    subCell.value = [pkg.period, sheet.note].filter(Boolean).join('  ·  ')
    subCell.font = { size: 10, color: { argb: 'FF888888' } }
    subCell.alignment = { horizontal: 'center' }

    // 表头
    const headerRow = ws.addRow(sheet.columns)
    headerRow.eachCell((cell) => {
      cell.font = { bold: true }
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF3F4F6' } }
      cell.border = { bottom: { style: 'thin', color: { argb: 'FFDDDDDD' } } }
      cell.alignment = { horizontal: 'center' }
    })

    // 数据行
    for (const row of sheet.rows) {
      const r = ws.addRow(row)
      r.eachCell((cell, col) => {
        if (col === 1) {
          cell.alignment = { horizontal: 'left' }
        } else if (typeof cell.value === 'number') {
          cell.numFmt = '#,##0'
          cell.alignment = { horizontal: 'right' }
        } else {
          cell.alignment = { horizontal: 'right' }
        }
      })
    }

    // 列宽
    ws.columns.forEach((col, i) => {
      col.width = i === 0 ? 24 : 16
    })
  }

  const arr = await wb.xlsx.writeBuffer()
  return Buffer.from(arr)
}

/** 生成 CSV(多表用空行分隔,BOM 头确保中文在 Excel 不乱码) */
export function buildCsv(pkg: ReportPackage): string {
  const esc = (v: string | number) => {
    const s = String(v)
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
  }
  const lines: string[] = []
  lines.push(`${pkg.title} - ${pkg.scopeLabel}`)
  lines.push(`${pkg.period}  生成时间:${pkg.generatedAt}`)
  lines.push('')
  for (const sheet of pkg.sheets) {
    lines.push(`# ${sheet.title}${sheet.note ? ` (${sheet.note})` : ''}`)
    lines.push(sheet.columns.map(esc).join(','))
    for (const row of sheet.rows) lines.push(row.map(esc).join(','))
    lines.push('')
  }
  return '\uFEFF' + lines.join('\r\n')
}

export function safeFileName(pkg: ReportPackage, ext: string): string {
  const stamp = new Date().toISOString().slice(0, 10)
  const scope = pkg.entityCount > 1 ? '集团合并' : pkg.scopeLabel
  return `财务报表_${scope}_${stamp}.${ext}`
}
