import { Lock, CalendarX } from 'lucide-react'
import { SignOutButton } from '@/components/sign-out-button'

export function TenantLockedScreen({
  reason,
  brandName,
  endedAt,
}: {
  reason: 'suspended' | 'expired'
  brandName: string | null
  endedAt: string | null
}) {
  const suspended = reason === 'suspended'
  const Icon = suspended ? Lock : CalendarX

  return (
    <main className="flex min-h-svh items-center justify-center bg-background px-4">
      <div className="w-full max-w-md rounded-2xl border border-border bg-card p-8 text-center">
        <div className="mx-auto flex size-14 items-center justify-center rounded-xl bg-destructive/10">
          <Icon className="size-7 text-destructive" />
        </div>
        <h1 className="mt-5 text-xl font-semibold text-card-foreground text-balance">
          {suspended ? '账号已被停用' : '订阅已到期'}
        </h1>
        <p className="mt-2 text-sm leading-relaxed text-muted-foreground text-pretty">
          {suspended ? (
            <>
              {brandName ? `「${brandName}」` : '您的'}账号已被运营方暂停使用。
              如需恢复服务,请联系您的专属客户经理或拨打服务热线。
            </>
          ) : (
            <>
              {brandName ? `「${brandName}」` : '您的'}订阅服务已于
              {endedAt ? ` ${new Date(endedAt).toLocaleDateString('zh-CN')} ` : ''}
              到期并超过宽限期,系统已暂停访问。请续费后继续使用。
            </>
          )}
        </p>

        <div className="mt-6 rounded-lg border border-border bg-muted/40 p-4 text-left">
          <p className="text-xs font-medium text-muted-foreground">续费 / 恢复服务</p>
          <p className="mt-1.5 text-sm text-card-foreground">服务热线:400-XXX-XXXX</p>
          <p className="mt-1 text-sm text-card-foreground">或联系您的专属客户经理</p>
        </div>

        <div className="mt-6">
          <SignOutButton />
        </div>
      </div>
    </main>
  )
}
