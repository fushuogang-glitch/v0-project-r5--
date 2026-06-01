import Link from 'next/link'
import { getContracts } from '@/app/actions/contracts'
import { getScope, getViewableEntities } from '@/lib/scope'
import { PageHeader } from '@/components/page-header'
import { ContractFormDialog } from '@/components/contract-form-dialog'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { FileSignature, FileText, PenLine, Link2, AlertCircle } from 'lucide-react'
import {
  contractCategoryLabel,
  contractStatusMeta,
} from '@/lib/contract-meta'
import { formatCompactCurrency } from '@/lib/format'

export default async function ContractsPage() {
  const [contracts, scope, entities] = await Promise.all([
    getContracts(),
    getScope(),
    getScope().then((s) => getViewableEntities(s)),
  ])

  const entityOptions = entities.map((e) => ({ id: e.id, name: e.name, code: e.code }))

  const total = contracts.length
  const pending = contracts.filter((c) => c.status === 'pending').length
  const active = contracts.filter((c) => c.status === 'active').length
  const totalAmount = contracts.reduce((s, c) => s + c.amount, 0)

  return (
    <div className="mx-auto w-full max-w-7xl space-y-6 p-4 md:p-6 lg:p-8">
      <PageHeader
        title="合同管理"
        description="登记合同与编号、收集扫描件、在线签署,并与对公进账逐笔勾稽,实现合同流·资金流·发票流三流合一。"
        action={
          entityOptions.length > 0 ? (
            <ContractFormDialog
              entities={entityOptions}
              defaultEntityId={scope.entityId}
            />
          ) : null
        }
      />

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard icon={FileSignature} label="合同总数" value={`${total} 份`} />
        <StatCard icon={PenLine} label="待签署" value={`${pending} 份`} />
        <StatCard icon={FileText} label="履行中" value={`${active} 份`} />
        <StatCard icon={Link2} label="合同总额" value={formatCompactCurrency(totalAmount)} />
      </div>

      {contracts.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-3 p-12 text-center">
            <span className="flex h-12 w-12 items-center justify-center rounded-full bg-accent text-accent-foreground">
              <FileSignature className="size-6" />
            </span>
            <div>
              <p className="font-medium text-foreground">还没有登记任何合同</p>
              <p className="mt-1 text-sm text-muted-foreground">
                登记合同后,可上传扫描件、发起在线签署,并把对公进账逐笔挂接到对应合同。
              </p>
            </div>
            {entityOptions.length > 0 && (
              <ContractFormDialog entities={entityOptions} defaultEntityId={scope.entityId} />
            )}
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">合同台账</CardTitle>
            <CardDescription>点击合同进入详情,管理附件、签署与进账勾稽</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            {contracts.map((c) => {
              const st = contractStatusMeta(c.status)
              const unlinked = c.direction === 'income' && c.linkedCount === 0
              return (
                <Link
                  key={c.id}
                  href={`/contracts/${c.id}`}
                  className="flex flex-col gap-3 rounded-lg border border-border p-4 transition-colors hover:bg-accent/40 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div className="min-w-0 flex-1 space-y-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-medium text-foreground">{c.title}</span>
                      <Badge variant={st.variant} className="font-normal">
                        {st.label}
                      </Badge>
                      <Badge variant="outline" className="font-normal text-muted-foreground">
                        {contractCategoryLabel(c.category)}
                      </Badge>
                    </div>
                    <p className="truncate text-sm text-muted-foreground">
                      <span className="tabular-nums">{c.contractNo}</span>
                      <span className="mx-1.5">·</span>
                      {c.counterparty}
                      <span className="mx-1.5">·</span>
                      {c.entityName}
                    </p>
                    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
                      {c.signatureCount > 0 && (
                        <span className="flex items-center gap-1">
                          <PenLine className="size-3" />
                          已签署 {c.signatureCount}/2
                        </span>
                      )}
                      <span className="flex items-center gap-1">
                        <Link2 className="size-3" />
                        挂接进账 {c.linkedCount} 笔
                        {c.linkedAmount > 0 && ` · ${formatCompactCurrency(c.linkedAmount)}`}
                      </span>
                      {unlinked && (
                        <span className="flex items-center gap-1 text-amber-600 dark:text-amber-400">
                          <AlertCircle className="size-3" />
                          尚未挂接进账
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="shrink-0 text-left sm:text-right">
                    <p className="text-base font-semibold tabular-nums text-foreground">
                      {formatCompactCurrency(c.amount)}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {c.signDate ? `签订 ${c.signDate}` : '未签订'}
                    </p>
                  </div>
                </Link>
              )
            })}
          </CardContent>
        </Card>
      )}
    </div>
  )
}

function StatCard({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof FileText
  label: string
  value: string
}) {
  return (
    <Card>
      <CardContent className="flex items-center gap-3 p-4 sm:p-5">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-accent text-accent-foreground">
          <Icon className="size-5" />
        </span>
        <div className="min-w-0">
          <p className="truncate text-sm text-muted-foreground">{label}</p>
          <p className="text-lg font-semibold tracking-tight tabular-nums sm:text-xl">{value}</p>
        </div>
      </CardContent>
    </Card>
  )
}
