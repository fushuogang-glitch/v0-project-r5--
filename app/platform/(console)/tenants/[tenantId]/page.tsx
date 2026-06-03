import Link from 'next/link'
import { notFound } from 'next/navigation'
import { ArrowLeft } from 'lucide-react'
import { getTenantDetail, getTenantHealthDetail } from '@/app/actions/platform'
import { TenantProfileCard } from '@/components/platform/tenant-profile-card'
import { TenantSecurityCard } from '@/components/platform/tenant-security-card'
import { TenantSubscriptionCard } from '@/components/platform/tenant-subscription-card'
import { TenantOpsCard } from '@/components/platform/tenant-ops-card'

export const dynamic = 'force-dynamic'
export const metadata = { title: '客户详情 · 运营中控台' }

export default async function TenantDetailPage({
  params,
}: {
  params: Promise<{ tenantId: string }>
}) {
  const { tenantId } = await params
  const profile = await getTenantDetail(tenantId)
  if (!profile) notFound()

  // 运营健康数据(钻取),失败不阻断详情渲染
  const health = await getTenantHealthDetail(tenantId).catch(() => null)

  return (
    <div className="space-y-6 p-6">
      <div>
        <Link
          href="/platform/tenants"
          className="inline-flex items-center gap-1.5 text-sm text-neutral-400 transition-colors hover:text-neutral-200"
        >
          <ArrowLeft className="size-4" />
          返回客户明细
        </Link>
        <h1 className="mt-3 text-xl font-semibold text-neutral-100">{profile.brandName}</h1>
        <p className="mt-1 text-sm text-neutral-500">
          {[profile.province, profile.city].filter(Boolean).join(' · ') || '未填写地区'}
          {profile.bossName ? ` · 负责人 ${profile.bossName}` : ''}
        </p>
      </div>

      <div className="grid gap-5 lg:grid-cols-2">
        <TenantProfileCard profile={profile} />
        <TenantSubscriptionCard profile={profile} />
        <TenantSecurityCard profile={profile} />
        <TenantOpsCard profile={profile} health={health} />
      </div>
    </div>
  )
}
