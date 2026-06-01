import Link from 'next/link'
import { notFound } from 'next/navigation'
import { getContractDetail } from '@/app/actions/contracts'
import { getScope, getViewableEntities } from '@/lib/scope'
import { ContractAttachments } from '@/components/contract-attachments'
import { ContractSignPanel } from '@/components/contract-sign-panel'
import { ContractActions } from '@/components/contract-actions'
import { ContractFormDialog, type ContractFormValue } from '@/components/contract-form-dialog'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import {
  ArrowLeft,
  Building2,
  Calendar,
  Link2,
  Pencil,
} from 'lucide-react'
import {
  contractCategoryLabel,
  contractDirectionLabel,
  contractStatusMeta,
} from '@/lib/contract-meta'
import { formatCurrency } from '@/lib/format'

export default async function ContractDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const contractId = Number(id)
  if (!Number.isFinite(contractId)) notFound()

  let detail
  try {
    detail = await getContractDetail(contractId)
  } catch {
    notFound()
  }

  const scope = await getScope()
  const entities = await getViewableEntities(scope)
  const entityOptions = entities.map((e) => ({ id: e.id, name: e.name, code: e.code }))

  const { contract: c, attachments, signatures, linkedTransactions } = detail
  const st = contractStatusMeta(c.status)
  const linkedTotal = linkedTransactions.reduce((s, t) => s + t.amount, 0)
  const coverage = c.amount > 0 ? Math.min((linkedTotal / c.amount) * 100, 100) : 0

  const editInitial: ContractFormValue = {
    id: c.id,
    entityId: c.entityId,
    contractNo: c.contractNo,
    title: c.title,
    counterparty: c.counterparty,
    counterpartyContact: c.counterpartyContact ?? '',
    counterpartyPhone: c.counterpartyPhone ?? '',
    category: c.category,
    direction: c.direction,
    amount: String(c.amount),
    signDate: c.signDate ?? '',
    startDate: c.startDate ?? '',
    endDate: c.endDate ?? '',
    status: c.status,
    summary: c.summary ?? '',
  }

  return (
    <div className="mx-auto w-full max-w-5xl space-y-6 p-4 md:p-6 lg:p-8">
      <Link
        href="/contracts"
        className="inline-flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
      >
        <ArrowLeft className="size-4" />
        返回合同列表
      </Link>

      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-2xl font-semibold tracking-tight text-foreground text-balance">
              {c.title}
            </h1>
            <Badge variant={st.variant} className="font-normal">
              {st.label}
            </Badge>
          </div>
          <p className="text-sm text-muted-foreground">
            <span className="tabular-nums">{c.contractNo}</span>
            <span className="mx-1.5">·</span>
            {contractCategoryLabel(c.category)}
            <span className="mx-1.5">·</span>
            {contractDirectionLabel(c.direction)}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {entityOptions.length > 0 && (
            <ContractFormDialog
              entities={entityOptions}
              mode="edit"
              initial={editInitial}
              trigger={
                <Button variant="outline" size="sm">
                  <Pencil className="size-4" />
                  编辑
                </Button>
              }
            />
          )}
          <ContractActions contractId={c.id} status={c.status} />
        </div>
      </div>

      {/* 基本信息 */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">合同信息</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-2 gap-x-4 gap-y-5 sm:grid-cols-3 lg:grid-cols-4">
          <Field icon={Building2} label="签约主体" value={c.entityName} />
          <Field label="对方单位" value={c.counterparty} />
          <Field label="对方联系人" value={c.counterpartyContact || '—'} />
          <Field label="联系电话" value={c.counterpartyPhone || '—'} />
          <Field
            label="合同金额"
            value={formatCurrency(c.amount)}
            valueClass="text-foreground font-semibold tabular-nums"
          />
          <Field icon={Calendar} label="签订日期" value={c.signDate || '—'} />
          <Field label="履行开始" value={c.startDate || '—'} />
          <Field label="履行结束" value={c.endDate || '—'} />
          {c.summary && (
            <div className="col-span-2 sm:col-span-3 lg:col-span-4">
              <p className="text-xs text-muted-foreground">合同摘要</p>
              <p className="mt-0.5 text-sm text-foreground text-pretty">{c.summary}</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* 在线签署 */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">在线签署</CardTitle>
          <CardDescription>
            手写签名留痕(含签署人、时间戳、合同哈希)。双方签齐后合同自动进入履行中。
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ContractSignPanel
            contractId={c.id}
            signatures={signatures}
            canSign={c.status !== 'void'}
          />
        </CardContent>
      </Card>

      {/* 合同附件 */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">合同附件</CardTitle>
          <CardDescription>上传合同扫描件、PDF 等留存(单个不超过 4MB)</CardDescription>
        </CardHeader>
        <CardContent>
          <ContractAttachments contractId={c.id} attachments={attachments} />
        </CardContent>
      </Card>

      {/* 关联进账 */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Link2 className="size-4 text-muted-foreground" />
            关联进账流水
          </CardTitle>
          <CardDescription>
            该合同已勾稽 {linkedTransactions.length} 笔进账,合计 {formatCurrency(linkedTotal)}
            {c.amount > 0 && ` · 回款进度 ${coverage.toFixed(0)}%`}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {c.amount > 0 && (
            <div className="mb-4 h-1.5 w-full overflow-hidden rounded-full bg-muted">
              <div className="h-full rounded-full bg-primary" style={{ width: `${coverage}%` }} />
            </div>
          )}
          {linkedTransactions.length === 0 ? (
            <p className="rounded-lg border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
              暂无关联进账。可在「收款账户 - 对公进账」处将银行进账挂接到本合同。
            </p>
          ) : (
            <ul className="divide-y divide-border rounded-lg border border-border">
              {linkedTransactions.map((t) => (
                <li key={t.id} className="flex items-center justify-between gap-3 p-3">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-foreground">
                      {t.summary || t.category}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {t.bizDate} · {t.channel}
                    </p>
                  </div>
                  <span className="shrink-0 tabular-nums font-medium text-foreground">
                    {formatCurrency(t.amount)}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

function Field({
  icon: Icon,
  label,
  value,
  valueClass = 'text-foreground',
}: {
  icon?: typeof Building2
  label: string
  value: string
  valueClass?: string
}) {
  return (
    <div className="min-w-0">
      <p className="flex items-center gap-1 text-xs text-muted-foreground">
        {Icon && <Icon className="size-3" />}
        {label}
      </p>
      <p className={`mt-0.5 truncate text-sm ${valueClass}`}>{value}</p>
    </div>
  )
}
