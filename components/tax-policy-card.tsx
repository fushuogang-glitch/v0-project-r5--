import { Receipt, Percent, Landmark, Info } from 'lucide-react'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import type { TaxProfile } from '@/lib/tax-policy'
import { entityTypeLabel, taxpayerLabel } from '@/lib/entity-meta'

export function TaxPolicyCard({
  entityType,
  taxpayerType,
  profile,
}: {
  entityType: string
  taxpayerType: string
  profile: TaxProfile
}) {
  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between gap-2">
          <div>
            <CardTitle className="text-base">适用税收政策</CardTitle>
            <CardDescription>
              账目标准依「{entityTypeLabel(entityType)} · {taxpayerLabel(taxpayerType)}」自动适配
            </CardDescription>
          </div>
          <Badge variant="secondary" className="font-normal shrink-0">
            {profile.taxpayerLabel}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <PolicyItem icon={Percent} label="增值税" value={profile.vatLabel} />
          <PolicyItem icon={Landmark} label="附加税费" value={profile.surtaxLabel} />
          <PolicyItem icon={Receipt} label="所得税" value={profile.incomeTaxLabel} />
        </div>

        <ul className="space-y-1.5 rounded-lg bg-muted/40 p-3">
          {profile.notes.map((n, i) => (
            <li key={i} className="flex items-start gap-2 text-xs text-muted-foreground">
              <Info className="mt-0.5 size-3.5 shrink-0" />
              <span>{n}</span>
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  )
}

function PolicyItem({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof Receipt
  label: string
  value: string
}) {
  return (
    <div className="rounded-lg border border-border p-3">
      <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
        <Icon className="size-3.5" />
        {label}
      </div>
      <p className="mt-1 text-sm font-medium text-foreground text-pretty">{value}</p>
    </div>
  )
}
