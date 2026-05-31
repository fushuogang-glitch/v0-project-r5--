'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Plus, Trash2, AlertTriangle, Calculator } from 'lucide-react'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { formatCurrency, formatPercent } from '@/lib/format'
import {
  SHARE_TYPE_LABEL,
  SHARE_TYPE_DESC,
  EQUITY_RULES,
  computeStandardRelease,
  type ShareType,
} from '@/lib/equity'
import {
  addShareholder,
  removeShareholder,
  type EquityData,
  type DividendForecast,
  type GroupDividendForecast,
} from '@/app/actions/equity'

const TYPE_COLOR: Record<ShareType, string> = {
  bank: 'bg-primary',
  position: 'bg-chart-2',
  growth: 'bg-chart-4',
}

const TYPE_BADGE: Record<ShareType, string> = {
  bank: 'border-primary/30 bg-primary/10 text-primary',
  position: 'border-chart-2/30 bg-chart-2/10 text-chart-2',
  growth: 'border-chart-4/30 bg-chart-4/10 text-chart-4',
}

export function EquityManager({
  entities,
  selectedId,
  data,
  forecast,
  canEdit,
}: {
  entities: { id: number; name: string }[]
  selectedId: number
  data: EquityData
  forecast: DividendForecast | null
  canEdit: boolean
}) {
  const router = useRouter()
  const { summary, rows } = data

  return (
    <div className="flex flex-col gap-6">
      {/* 门店选择 */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <span className="text-sm text-muted-foreground">门店主体</span>
          <Select
            value={String(selectedId)}
            onValueChange={(v) => router.push(`/equity?entity=${v}`)}
          >
            <SelectTrigger className="w-56">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {entities.map((e) => (
                <SelectItem key={e.id} value={String(e.id)}>
                  {e.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        {canEdit && <AddShareholderDialog entityId={selectedId} onDone={() => router.refresh()} />}
      </div>

      {/* 分红权释放结构 */}
      <ReleaseStructure summary={summary} />

      {/* 合规警告 */}
      {summary.warnings.length > 0 && (
        <div className="flex flex-col gap-2 rounded-lg border border-destructive/30 bg-destructive/5 p-4">
          <div className="flex items-center gap-2 text-sm font-medium text-destructive">
            <AlertTriangle className="size-4" />
            合规校验提示
          </div>
          <ul className="ml-6 list-disc text-sm text-destructive/90">
            {summary.warnings.map((w, i) => (
              <li key={i}>{w}</li>
            ))}
          </ul>
        </div>
      )}

      {/* 股权台账 */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">三层股权台账</CardTitle>
          <CardDescription>
            银股(出资实股)/ 身股(岗位人力股)/ 发展股(带教激励股),分红权释放总额上限{' '}
            {EQUITY_RULES.releaseCap}%
          </CardDescription>
        </CardHeader>
        <CardContent>
          {rows.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">
              暂无股权登记,{canEdit ? '点击右上角「登记持股人」开始' : '请联系集团管理员登记'}
            </p>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>持股人</TableHead>
                    <TableHead>股型</TableHead>
                    <TableHead>岗位</TableHead>
                    <TableHead className="text-right">分红权</TableHead>
                    {canEdit && <TableHead className="w-12" />}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.map((r) => {
                    const st = r.shareType as ShareType
                    return (
                      <TableRow key={r.id}>
                        <TableCell className="font-medium text-foreground">{r.name}</TableCell>
                        <TableCell>
                          <Badge variant="outline" className={TYPE_BADGE[st]}>
                            {SHARE_TYPE_LABEL[st]}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-muted-foreground">{r.position ?? '—'}</TableCell>
                        <TableCell className="text-right font-medium tabular-nums">
                          {formatPercent(r.ratio)}
                        </TableCell>
                        {canEdit && (
                          <TableCell>
                            <RemoveButton id={r.id} onDone={() => router.refresh()} />
                          </TableCell>
                        )}
                      </TableRow>
                    )
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* 标准释放计算器 */}
      <StandardCalculator />

      {/* 年度分红测算 */}
      {forecast && <DividendForecastCard forecast={forecast} />}
    </div>
  )
}

function ReleaseStructure({ summary }: { summary: EquityData['summary'] }) {
  const segments: { label: string; value: number; color: string }[] = [
    { label: '银股', value: summary.bankTotal, color: TYPE_COLOR.bank },
    { label: '身股', value: summary.positionTotal, color: TYPE_COLOR.position },
    { label: '发展股', value: summary.growthTotal, color: TYPE_COLOR.growth },
    { label: '公司留存', value: summary.retained, color: 'bg-muted-foreground/30' },
  ]
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">分红权释放结构</CardTitle>
        <CardDescription>
          实际释放 {formatPercent(summary.released)} · 公司留存 {formatPercent(summary.retained)}
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <div className="flex h-4 w-full overflow-hidden rounded-full bg-muted">
          {segments.map(
            (s, i) =>
              s.value > 0 && (
                <div
                  key={i}
                  className={s.color}
                  style={{ width: `${Math.min(100, s.value)}%` }}
                  title={`${s.label} ${s.value}%`}
                />
              ),
          )}
        </div>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {segments.map((s, i) => (
            <div key={i} className="flex items-center gap-2">
              <span className={`size-3 shrink-0 rounded-sm ${s.color}`} />
              <div className="flex flex-col">
                <span className="text-xs text-muted-foreground">{s.label}</span>
                <span className="text-sm font-medium tabular-nums">{formatPercent(s.value)}</span>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  )
}

function StandardCalculator() {
  const [consultants, setConsultants] = useState(3)
  const [hasMentor, setHasMentor] = useState(true)
  const [bankHolders, setBankHolders] = useState(2)
  const result = computeStandardRelease({
    consultantCount: consultants,
    hasMentor,
    bankHolders,
  })

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Calculator className="size-4 text-muted-foreground" />
          标准释放参考测算
        </CardTitle>
        <CardDescription>
          按岗位人数与带教状态动态测算建议释放结构(店长身股 5% + 顾问 3%/人 + 发展股 2%)
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <div className="grid gap-2">
            <Label htmlFor="consultants">顾问人数</Label>
            <Input
              id="consultants"
              type="number"
              min={0}
              value={consultants}
              onChange={(e) => setConsultants(Math.max(0, Number(e.target.value)))}
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="bankHolders">银股股东人数</Label>
            <Input
              id="bankHolders"
              type="number"
              min={0}
              value={bankHolders}
              onChange={(e) => setBankHolders(Math.max(0, Number(e.target.value)))}
            />
          </div>
          <div className="grid gap-2">
            <Label>店长是否有带教</Label>
            <Select value={hasMentor ? 'yes' : 'no'} onValueChange={(v) => setHasMentor(v === 'yes')}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="yes">有带教(给发展股)</SelectItem>
                <SelectItem value="no">无带教(不给)</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3 rounded-lg bg-muted/50 p-4 sm:grid-cols-5">
          <Stat label="银股" value={formatPercent(result.bank)} />
          <Stat label="身股" value={formatPercent(result.position)} />
          <Stat label="发展股" value={formatPercent(result.growth)} />
          <Stat label="释放合计" value={formatPercent(result.released)} highlight />
          <Stat label="公司留存" value={formatPercent(result.retained)} />
        </div>
        <p className="text-xs text-muted-foreground">
          银股建议每人约 {formatPercent(result.bankPerHolder)}(单人上限{' '}
          {EQUITY_RULES.bankPerHolderCap}%、总额上限 {EQUITY_RULES.bankCap}%)。逻辑:身股/发展股优先满足,剩余额度才给银股。
        </p>
      </CardContent>
    </Card>
  )
}

function Stat({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div className="flex flex-col">
      <span className="text-xs text-muted-foreground">{label}</span>
      <span className={`text-lg font-semibold tabular-nums ${highlight ? 'text-primary' : ''}`}>
        {value}
      </span>
    </div>
  )
}

function DividendForecastCard({ forecast }: { forecast: DividendForecast }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">年度分红测算</CardTitle>
        <CardDescription>
          可分配利润(税后净利润){formatCurrency(forecast.distributableProfit)} · 按分红权比例分配并代扣个税
        </CardDescription>
      </CardHeader>
      <CardContent>
        {forecast.details.length === 0 ? (
          <p className="py-6 text-center text-sm text-muted-foreground">
            暂无持股人,登记后自动测算分红
          </p>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>持股人</TableHead>
                  <TableHead>股型</TableHead>
                  <TableHead className="text-right">分红权</TableHead>
                  <TableHead className="text-right">应分金额</TableHead>
                  <TableHead>个税类型</TableHead>
                  <TableHead className="text-right">代扣个税</TableHead>
                  <TableHead className="text-right">税后实得</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {forecast.details.map((d, i) => {
                  const st = d.shareType as ShareType
                  return (
                    <TableRow key={i}>
                      <TableCell className="font-medium text-foreground">{d.name}</TableCell>
                      <TableCell>
                        <Badge variant="outline" className={TYPE_BADGE[st]}>
                          {SHARE_TYPE_LABEL[st]}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {formatPercent(d.ratio)}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {formatCurrency(d.gross)}
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">{d.taxType}</TableCell>
                      <TableCell className="text-right tabular-nums text-muted-foreground">
                        {d.taxWithheld > 0 ? formatCurrency(d.taxWithheld) : '—'}
                      </TableCell>
                      <TableCell className="text-right font-medium tabular-nums">
                        {formatCurrency(d.net)}
                      </TableCell>
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
            <div className="mt-4 flex flex-wrap justify-end gap-6 border-t pt-4 text-sm">
              <span className="text-muted-foreground">
                分红合计 <span className="font-medium text-foreground tabular-nums">{formatCurrency(forecast.totalGross)}</span>
              </span>
              <span className="text-muted-foreground">
                代扣个税 <span className="font-medium text-foreground tabular-nums">{formatCurrency(forecast.totalTax)}</span>
              </span>
              <span className="text-muted-foreground">
                税后实得 <span className="font-medium text-foreground tabular-nums">{formatCurrency(forecast.totalNet)}</span>
              </span>
              <span className="text-muted-foreground">
                公司留存 <span className="font-medium text-foreground tabular-nums">{formatCurrency(forecast.retained)}</span>
              </span>
            </div>
          </div>
        )}
        <p className="mt-3 text-xs text-muted-foreground">
          银股按股息红利所得 20% 代扣;身股/发展股的个税口径需按协议定性(工资薪金/劳务)由财务核定后代扣留痕。
        </p>
      </CardContent>
    </Card>
  )
}

function AddShareholderDialog({
  entityId,
  level = 'entity',
  onDone,
}: {
  entityId?: number
  level?: 'group' | 'entity'
  onDone: () => void
}) {
  const [open, setOpen] = useState(false)
  const [pending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const [form, setForm] = useState({
    name: '',
    shareType: 'bank' as ShareType,
    ratio: '',
    position: '',
  })

  function submit() {
    setError(null)
    startTransition(async () => {
      const res = await addShareholder({
        level,
        entityId,
        name: form.name,
        shareType: form.shareType,
        ratio: Number(form.ratio),
        position: form.position,
      })
      if (res.ok) {
        setForm({ name: '', shareType: 'bank', ratio: '', position: '' })
        setOpen(false)
        onDone()
      } else {
        setError(res.error)
      }
    })
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm">
          <Plus className="size-4" />
          登记持股人
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>登记持股人</DialogTitle>
          <DialogDescription>登记银股/身股/发展股持股人及其分红权比例</DialogDescription>
        </DialogHeader>
        <div className="flex flex-col gap-4">
          <div className="grid gap-2">
            <Label htmlFor="sh-name">姓名</Label>
            <Input
              id="sh-name"
              value={form.name}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              placeholder="持股人姓名"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="grid gap-2">
              <Label>股型</Label>
              <Select
                value={form.shareType}
                onValueChange={(v) => setForm((f) => ({ ...f, shareType: v as ShareType }))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="bank">银股</SelectItem>
                  <SelectItem value="position">身股</SelectItem>
                  <SelectItem value="growth">发展股</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="sh-ratio">分红权 %</Label>
              <Input
                id="sh-ratio"
                type="number"
                step="0.5"
                min={0}
                value={form.ratio}
                onChange={(e) => setForm((f) => ({ ...f, ratio: e.target.value }))}
                placeholder="如 5"
              />
            </div>
          </div>
          <div className="grid gap-2">
            <Label htmlFor="sh-pos">岗位(选填)</Label>
            <Input
              id="sh-pos"
              value={form.position}
              onChange={(e) => setForm((f) => ({ ...f, position: e.target.value }))}
              placeholder="店长 / 顾问 / 外部股东"
            />
          </div>
          <p className="text-xs text-muted-foreground">{SHARE_TYPE_DESC[form.shareType]}</p>
          {error && <p className="text-sm text-destructive">{error}</p>}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)} disabled={pending}>
            取消
          </Button>
          <Button onClick={submit} disabled={pending}>
            {pending ? '保存中...' : '确认登记'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

export function GroupEquityManager({
  data,
  forecast,
  canEdit,
}: {
  data: { rows: EquityData['rows']; summary: EquityData['summary'] }
  forecast: GroupDividendForecast | null
  canEdit: boolean
}) {
  const router = useRouter()
  const { summary, rows } = data

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">
          集团层股东跨门店持股,分红基数为旗下全部门店的合并税后净利润
        </p>
        {canEdit && <AddShareholderDialog level="group" onDone={() => router.refresh()} />}
      </div>

      <ReleaseStructure summary={summary} />

      {summary.warnings.length > 0 && (
        <div className="flex flex-col gap-2 rounded-lg border border-destructive/30 bg-destructive/5 p-4">
          <div className="flex items-center gap-2 text-sm font-medium text-destructive">
            <AlertTriangle className="size-4" />
            合规校验提示
          </div>
          <ul className="ml-6 list-disc text-sm text-destructive/90">
            {summary.warnings.map((w, i) => (
              <li key={i}>{w}</li>
            ))}
          </ul>
        </div>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="text-base">集团股权台账</CardTitle>
          <CardDescription>
            银股(创始/投资人出资)/ 身股(集团高管激励)/ 发展股,分红权释放总额上限{' '}
            {EQUITY_RULES.releaseCap}%
          </CardDescription>
        </CardHeader>
        <CardContent>
          {rows.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">
              暂无集团股权登记,{canEdit ? '点击右上角「登记持股人」开始' : '请联系集团管理员登记'}
            </p>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>持股人</TableHead>
                    <TableHead>股型</TableHead>
                    <TableHead>岗位</TableHead>
                    <TableHead className="text-right">分红权</TableHead>
                    {canEdit && <TableHead className="w-12" />}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.map((r) => {
                    const st = r.shareType as ShareType
                    return (
                      <TableRow key={r.id}>
                        <TableCell className="font-medium text-foreground">{r.name}</TableCell>
                        <TableCell>
                          <Badge variant="outline" className={TYPE_BADGE[st]}>
                            {SHARE_TYPE_LABEL[st]}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-muted-foreground">{r.position ?? '—'}</TableCell>
                        <TableCell className="text-right font-medium tabular-nums">
                          {formatPercent(r.ratio)}
                        </TableCell>
                        {canEdit && (
                          <TableCell>
                            <RemoveButton id={r.id} onDone={() => router.refresh()} />
                          </TableCell>
                        )}
                      </TableRow>
                    )
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* 合并净利润来源 */}
      {forecast && forecast.byEntity.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">合并净利润来源</CardTitle>
            <CardDescription>各门店税后净利润汇总构成集团可分配利润</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>门店</TableHead>
                    <TableHead className="text-right">税后净利润</TableHead>
                    <TableHead className="text-right">占比</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {forecast.byEntity.map((e) => {
                    const pct =
                      forecast.distributableProfit > 0
                        ? (e.netProfit / forecast.distributableProfit) * 100
                        : 0
                    return (
                      <TableRow key={e.entityId}>
                        <TableCell className="font-medium text-foreground">
                          {e.entityName}
                        </TableCell>
                        <TableCell className="text-right tabular-nums">
                          {formatCurrency(e.netProfit)}
                        </TableCell>
                        <TableCell className="text-right tabular-nums text-muted-foreground">
                          {formatPercent(Math.round(pct * 10) / 10)}
                        </TableCell>
                      </TableRow>
                    )
                  })}
                </TableBody>
              </Table>
              <div className="mt-4 flex justify-end border-t pt-4 text-sm">
                <span className="text-muted-foreground">
                  合并净利润{' '}
                  <span className="font-medium text-foreground tabular-nums">
                    {formatCurrency(forecast.distributableProfit)}
                  </span>
                </span>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {forecast && <DividendForecastCard forecast={forecast} />}
    </div>
  )
}

function RemoveButton({ id, onDone }: { id: number; onDone: () => void }) {
  const [pending, startTransition] = useTransition()
  return (
    <Button
      variant="ghost"
      size="icon"
      className="size-8 text-muted-foreground hover:text-destructive"
      disabled={pending}
      onClick={() =>
        startTransition(async () => {
          await removeShareholder(id)
          onDone()
        })
      }
    >
      <Trash2 className="size-4" />
      <span className="sr-only">移除</span>
    </Button>
  )
}
