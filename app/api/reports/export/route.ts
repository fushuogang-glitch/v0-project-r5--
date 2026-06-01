import { type NextRequest, NextResponse } from 'next/server'
import { buildReportPackage } from '@/lib/report-data'
import { buildTaxFilingPackage } from '@/lib/tax-filing'
import { buildWorkbook, buildCsv, safeFileName } from '@/lib/report-export'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const kind = searchParams.get('kind') ?? 'reports'
    const format = (searchParams.get('format') ?? 'xlsx').toLowerCase()

    let pkg
    if (kind === 'filing') {
      const entityId = Number(searchParams.get('entity'))
      const year = Number(searchParams.get('year')) || new Date().getFullYear()
      const quarter = Number(searchParams.get('quarter')) || 1
      if (!Number.isFinite(entityId)) {
        return NextResponse.json({ error: '无效的主体参数' }, { status: 400 })
      }
      pkg = await buildTaxFilingPackage(entityId, { year, quarter })
    } else {
      const targetRaw = searchParams.get('target') ?? 'group'
      const target: 'group' | number = targetRaw === 'group' ? 'group' : Number(targetRaw)
      if (target !== 'group' && !Number.isFinite(target)) {
        return NextResponse.json({ error: '无效的主体参数' }, { status: 400 })
      }
      pkg = await buildReportPackage(target)
    }

    if (format === 'csv') {
      const csv = buildCsv(pkg)
      const name = safeFileName(pkg, 'csv')
      return new NextResponse(csv, {
        headers: {
          'Content-Type': 'text/csv; charset=utf-8',
          'Content-Disposition': `attachment; filename*=UTF-8''${encodeURIComponent(name)}`,
        },
      })
    }

    const buffer = await buildWorkbook(pkg)
    const name = safeFileName(pkg, 'xlsx')
    return new NextResponse(new Uint8Array(buffer), {
      headers: {
        'Content-Type':
          'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename*=UTF-8''${encodeURIComponent(name)}`,
      },
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : '导出失败'
    const status = message === 'Unauthorized' ? 401 : 500
    return NextResponse.json({ error: message }, { status })
  }
}
