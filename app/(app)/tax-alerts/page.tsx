import { getTaxAlerts } from '@/app/actions/finance'
import { TAX_THRESHOLDS } from '@/lib/tax'
import { PageHeader } from '@/components/page-header'
import { TaxAlertBar } from '@/components/tax-alert-bar'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { ShieldAlert, ShieldCheck, ShieldX } from 'lucide-react'
import { formatCompactCurrency } from '@/lib/format'

export default async function TaxAlertsPage() {
  const alerts = await getTaxAlerts()

  const danger = alerts.filter((a) => a.level === 'danger')
  const warning = alerts.filter((a) => a.level === 'warning')
  const safe = alerts.filter((a) => a.level === 'safe')

  return (
    <div className="mx-auto w-full max-w-7xl space-y-6 p-4 md:p-6 lg:p-8">
      <PageHeader
        title="税务额度临界点预警"
        description="实时监控各主体增值税、所得税与一般纳税人认定的关键临界点"
      />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <Card>
          <CardContent className="flex items-center gap-3 p-5">
            <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-red-50 text-destructive">
              <ShieldX className="size-5" />
            </span>
            <div>
              <p className="text-sm text-muted-foreground">已超临界点</p>
              <p className="text-xl font-semibold tracking-tight">{danger.length} 个</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-3 p-5">
            <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-amber-50 text-amber-600">
              <ShieldAlert className="size-5" />
            </span>
            <div>
              <p className="text-sm text-muted-foreground">临近临界点(≥80%)</p>
              <p className="text-xl font-semibold tracking-tight">{warning.length} 个</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-3 p-5">
            <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-emerald-50 text-emerald-600">
              <ShieldCheck className="size-5" />
            </span>
            <div>
              <p className="text-sm text-muted-foreground">安全范围</p>
              <p className="text-xl font-semibold tracking-tight">{safe.length} 个</p>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">各主体额度使用情况</CardTitle>
          <CardDescription>
            小规模盯增值税季度免征线({formatCompactCurrency(TAX_THRESHOLDS.vatQuarterly)})与一般纳税人认定线({formatCompactCurrency(TAX_THRESHOLDS.generalTaxpayerYearly)});一般纳税人盯小微企业优惠线({formatCompactCurrency(TAX_THRESHOLDS.smallProfitYearly)})
          </CardDescription>
        </CardHeader>
        <CardContent className="grid grid-cols-1 gap-x-8 gap-y-6 md:grid-cols-2">
          {alerts.map((a) => (
            <TaxAlertBar key={a.entityId} alert={a} />
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">临界点规则说明</CardTitle>
          <CardDescription>系统内置的关键财税临界点</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3 text-sm text-muted-foreground">
          <div className="flex items-start gap-2">
            <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-primary" />
            <p>
              <span className="font-medium text-foreground">小规模增值税免征:</span>
              季度销售额 30 万元(月 10 万)以内免征增值税,临近时提示控制开票节奏。
            </p>
          </div>
          <div className="flex items-start gap-2">
            <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-primary" />
            <p>
              <span className="font-medium text-foreground">一般纳税人强制认定:</span>
              连续 12 个月销售额超过 500 万元须登记为一般纳税人,提前预警便于税务筹划。
            </p>
          </div>
          <div className="flex items-start gap-2">
            <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-primary" />
            <p>
              <span className="font-medium text-foreground">小微企业所得税优惠:</span>
              年应纳税所得额 / 营收 300 万元临界点,关系到企业所得税优惠税率适用。
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
