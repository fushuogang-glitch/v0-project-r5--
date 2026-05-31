import { notFound } from 'next/navigation'
import Link from 'next/link'
import {
  Wallet,
  PiggyBank,
  TrendingUp,
  Receipt,
  ArrowLeft,
  Building2,
  MapPin,
  CalendarDays,
  FileText,
} from 'lucide-react'
import {
  getEntityDetail,
  getEntityAccounts,
  getEntityTransactions,
  getTaxAlerts,
  getEntityTaxPolicy,
  getMembershipData,
  getEntityVouchers,
  getFinancialStatements,
} from '@/app/actions/finance'
import { getStoreAccounts } from '@/app/actions/org'
import { getScope } from '@/lib/scope'
import { PageHeader } from '@/components/page-header'
import { KpiCard } from '@/components/kpi-card'
import { TaxAlertBar } from '@/components/tax-alert-bar'
import { StoreAccountManager } from '@/components/store-account-manager'
import { TransactionForm } from '@/components/transaction-form'
import { TaxPolicyCard } from '@/components/tax-policy-card'
import { MembershipPanel } from '@/components/membership-panel'
import { AccountForm } from '@/components/account-form'
import { EntityInfoForm } from '@/components/entity-info-form'
import { VoucherList } from '@/components/voucher-list'
import { FinancialStatements } from '@/components/financial-statements'
import { Progress } from '@/components/ui/progress'
import { invoiceMediumLabel, invoiceKindLabel } from '@/lib/invoice-meta'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
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
import { accountMeta } from '@/lib/account-meta'
import { formatCompactCurrency, formatCurrency, formatPercent } from '@/lib/format'
import { entityTypeLabel, taxpayerLabel } from '@/lib/entity-meta'
import { cn } from '@/lib/utils'

export default async function EntityDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const entityId = Number(id)
  if (Number.isNaN(entityId)) notFound()

  let detail
  try {
    detail = await getEntityDetail(entityId)
  } catch {
    notFound()
  }

  const scope = await getScope()
  const [accounts, txs, alerts, storeUsers, taxPolicy, membership, vouchers, statements] =
    await Promise.all([
      getEntityAccounts(entityId),
      getEntityTransactions(entityId, 100),
      getTaxAlerts(entityId),
      scope.role === 'group' ? getStoreAccounts(entityId) : Promise.resolve([]),
      getEntityTaxPolicy(entityId),
      getMembershipData(entityId),
      getEntityVouchers(entityId),
      getFinancialStatements(entityId),
    ])

  const { entity, summary } = detail
  const alert = alerts.find((a) => a.entityId === entityId)
  const totalReceived = accounts.reduce((s, a) => s + a.received, 0)

  return (
    <div className="mx-auto w-full max-w-6xl space-y-6 p-4 md:p-6 lg:p-8">
      {scope.role === 'group' && (
        <Link
          href="/entities"
          className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="size-4" />
          返回主体管理
        </Link>
      )}

      <PageHeader
        title={entity.name}
        description={`${entity.code} · ${entityTypeLabel(entity.entityType)} · ${taxpayerLabel(entity.taxpayerType)}`}
        action={
          <Badge
            variant={entity.status === 'active' ? 'secondary' : 'outline'}
            className="font-normal"
          >
            {entity.status === 'active' ? '经营中' : '已注销'}
          </Badge>
        }
      />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <KpiCard label="累计营收" value={formatCompactCurrency(summary.revenue)} icon={Wallet} />
        <KpiCard label="净利润" value={formatCompactCurrency(summary.profit)} icon={PiggyBank} />
        <KpiCard label="利润率" value={formatPercent(summary.margin)} icon={TrendingUp} />
        <KpiCard
          label="累计税额"
          value={formatCompactCurrency(summary.totalTax)}
          icon={Receipt}
        />
      </div>

      <Tabs defaultValue="overview">
        <TabsList className="flex-wrap">
          <TabsTrigger value="overview">经营概况</TabsTrigger>
          <TabsTrigger value="accounts">收款账户</TabsTrigger>
          <TabsTrigger value="transactions">流水明细</TabsTrigger>
          <TabsTrigger value="vouchers">记账凭证</TabsTrigger>
          <TabsTrigger value="statements">财务报表</TabsTrigger>
          <TabsTrigger value="tax">税务额度</TabsTrigger>
          <TabsTrigger value="membership">会员对账</TabsTrigger>
          {scope.role === 'group' && (
            <TabsTrigger value="access">门店账号</TabsTrigger>
          )}
          {scope.role === 'group' && (
            <TabsTrigger value="settings">设置</TabsTrigger>
          )}
        </TabsList>

        {/* 经营概况 */}
        <TabsContent value="overview" className="mt-4 space-y-4">
          <TaxPolicyCard
            entityType={taxPolicy.entityType}
            taxpayerType={taxPolicy.taxpayerType}
            profile={taxPolicy.profile}
          />
          <Card>
            <CardHeader>
              <CardTitle className="text-base">工商与税务信息</CardTitle>
              <CardDescription>主体登记的基础档案</CardDescription>
            </CardHeader>
            <CardContent>
              <dl className="grid grid-cols-1 gap-x-8 gap-y-4 sm:grid-cols-2">
                <InfoRow icon={Building2} label="法定代表人" value={entity.legalPerson ?? '—'} />
                <InfoRow icon={FileText} label="统一社会信用代码" value={entity.creditCode ?? '—'} />
                <InfoRow
                  icon={MapPin}
                  label="经营区域"
                  value={`${entity.region ?? '—'} · ${entity.city ?? '—'}`}
                />
                <InfoRow icon={MapPin} label="经营地址" value={entity.address ?? '—'} />
                <InfoRow
                  icon={CalendarDays}
                  label="成立日期"
                  value={entity.establishDate ?? '—'}
                />
                <InfoRow
                  icon={Wallet}
                  label="收款账户累计"
                  value={formatCurrency(totalReceived)}
                />
              </dl>
            </CardContent>
          </Card>
        </TabsContent>

        {/* 收款账户 */}
        <TabsContent value="accounts" className="mt-4">
          <Card>
            <CardHeader>
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <CardTitle className="text-base">收款账户明细</CardTitle>
                  <CardDescription>
                    各收款渠道累计收款 {formatCompactCurrency(totalReceived)}
                  </CardDescription>
                </div>
                <AccountForm entityId={entity.id} />
              </div>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>账户</TableHead>
                      <TableHead>类型</TableHead>
                      <TableHead>账号</TableHead>
                      <TableHead className="text-right">累计收款</TableHead>
                      <TableHead className="w-[200px]">收款占比</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {accounts.map((a) => {
                      const meta = accountMeta(a.accountType)
                      const pct = totalReceived > 0 ? (a.received / totalReceived) * 100 : 0
                      return (
                        <TableRow key={a.id}>
                          <TableCell className="font-medium text-foreground">
                            <span className="flex items-center gap-2">
                              <meta.icon className="size-4 text-muted-foreground" />
                              {a.name}
                            </span>
                          </TableCell>
                          <TableCell className="text-muted-foreground">{meta.label}</TableCell>
                          <TableCell className="text-muted-foreground tabular-nums">
                            {a.accountNo ?? '—'}
                          </TableCell>
                          <TableCell className="text-right tabular-nums font-medium">
                            {formatCurrency(a.received)}
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              <Progress value={pct} className="h-2 flex-1" />
                              <span className="w-12 shrink-0 text-right text-xs tabular-nums text-muted-foreground">
                                {formatPercent(pct)}
                              </span>
                            </div>
                          </TableCell>
                        </TableRow>
                      )
                    })}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* 流水明细 */}
        <TabsContent value="transactions" className="mt-4">
          <Card>
            <CardHeader>
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <CardTitle className="text-base">收支流水明细</CardTitle>
                  <CardDescription>
                    共 {txs.length} 条 · 含价税分离与发票信息
                  </CardDescription>
                </div>
                <TransactionForm
                  entityId={entity.id}
                  expenseOnly={scope.role === 'store'}
                  profile={{
                    vatRate: taxPolicy.profile.vatRate,
                    surtaxRate: taxPolicy.profile.surtaxRate,
                    vatLabel: taxPolicy.profile.vatLabel,
                  }}
                />
              </div>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>日期</TableHead>
                      <TableHead>类型</TableHead>
                      <TableHead>分类</TableHead>
                      <TableHead>渠道</TableHead>
                      <TableHead>发票</TableHead>
                      <TableHead className="text-right">不含税</TableHead>
                      <TableHead className="text-right">税额</TableHead>
                      <TableHead className="text-right">含税金额</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {txs.length === 0 && (
                      <TableRow>
                        <TableCell colSpan={8} className="py-8 text-center text-muted-foreground">
                          暂无流水,点击右上角「录入流水」开始记账
                        </TableCell>
                      </TableRow>
                    )}
                    {txs.map((t) => {
                      const income = t.bizType === 'income'
                      return (
                        <TableRow key={t.id}>
                          <TableCell className="text-muted-foreground tabular-nums">
                            {t.bizDate}
                          </TableCell>
                          <TableCell>
                            <Badge
                              variant="outline"
                              className={cn(
                                'font-normal',
                                income
                                  ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
                                  : 'border-border text-muted-foreground',
                              )}
                            >
                              {income ? '收入' : '支出'}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-foreground">{t.category}</TableCell>
                          <TableCell className="text-muted-foreground">{t.channel}</TableCell>
                          <TableCell className="text-muted-foreground">
                            {t.invoiceMedium === 'none' ? (
                              <span className="text-xs">未开票</span>
                            ) : (
                              <span className="flex flex-col">
                                <span className="text-xs text-foreground">
                                  {invoiceKindLabel(t.invoiceKind)}
                                </span>
                                <span className="text-[11px] text-muted-foreground">
                                  {invoiceMediumLabel(t.invoiceMedium)}
                                  {t.invoiceNo ? ` · ${t.invoiceNo}` : ''}
                                </span>
                              </span>
                            )}
                          </TableCell>
                          <TableCell className="text-right tabular-nums text-muted-foreground">
                            {formatCurrency(t.netAmount)}
                          </TableCell>
                          <TableCell className="text-right tabular-nums text-muted-foreground">
                            {formatCurrency(t.taxAmount)}
                          </TableCell>
                          <TableCell
                            className={cn(
                              'text-right tabular-nums font-medium',
                              income ? 'text-emerald-600' : 'text-foreground',
                            )}
                          >
                            {income ? '+' : '-'}
                            {formatCurrency(t.amount)}
                          </TableCell>
                        </TableRow>
                      )
                    })}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* 记账凭证 */}
        <TabsContent value="vouchers" className="mt-4">
          <VoucherList vouchers={vouchers} />
        </TabsContent>

        {/* 财务报表:利润表 + 资产负债表 */}
        <TabsContent value="statements" className="mt-4">
          <FinancialStatements income={statements.income} balance={statements.balance} />
        </TabsContent>

        {/* 税务额度 */}
        <TabsContent value="tax" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">税务额度状态</CardTitle>
              <CardDescription>关键临界点使用率监控</CardDescription>
            </CardHeader>
            <CardContent className="space-y-5">
              {alert ? (
                <>
                  <TaxAlertBar alert={alert} />
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                    <div className="rounded-lg border border-border p-4">
                      <p className="text-xs text-muted-foreground">近 12 个月销售额</p>
                      <p className="mt-1 text-lg font-semibold tabular-nums">
                        {formatCurrency(alert.trailingRevenue)}
                      </p>
                    </div>
                    <div className="rounded-lg border border-border p-4">
                      <p className="text-xs text-muted-foreground">本季度销售额</p>
                      <p className="mt-1 text-lg font-semibold tabular-nums">
                        {formatCurrency(alert.quarterRevenue)}
                      </p>
                    </div>
                  </div>
                </>
              ) : (
                <p className="text-sm text-muted-foreground">暂无税务额度数据</p>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* 会员对账 */}
        <TabsContent value="membership" className="mt-4">
          <MembershipPanel data={membership} />
        </TabsContent>

        {/* 门店账号(仅集团端) */}
        {scope.role === 'group' && (
          <TabsContent value="access" className="mt-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">门店登录账号</CardTitle>
                <CardDescription>
                  创建门店端账号,登录后仅能查看本门店数据
                </CardDescription>
              </CardHeader>
              <CardContent>
                <StoreAccountManager
                  entityId={entity.id}
                  entityName={entity.name}
                  accounts={storeUsers}
                />
              </CardContent>
            </Card>
          </TabsContent>
        )}

        {/* 设置 · 信息登记 */}
        {scope.role === 'group' && (
          <TabsContent value="settings" className="mt-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">信息登记</CardTitle>
                <CardDescription>
                  登记 {entity.name} 的工商、税务与银行信息,用于报税与开票资料
                </CardDescription>
              </CardHeader>
              <CardContent>
                <EntityInfoForm entity={entity} />
              </CardContent>
            </Card>
          </TabsContent>
        )}
      </Tabs>
    </div>
  )
}

function InfoRow({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof Building2
  label: string
  value: string
}) {
  return (
    <div className="flex items-start gap-3">
      <span className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-lg bg-accent text-accent-foreground">
        <Icon className="size-4" />
      </span>
      <div className="min-w-0">
        <dt className="text-xs text-muted-foreground">{label}</dt>
        <dd className="text-sm font-medium text-foreground break-all">{value}</dd>
      </div>
    </div>
  )
}
