import { redirect } from 'next/navigation'
import { headers } from 'next/headers'
import { auth } from '@/lib/auth'
import { getPlatformAdmin } from '@/lib/platform'
import { pool } from '@/lib/db'
import { autoRunPlatformScanIfDue } from '@/app/actions/platform'
import { PlatformShell } from '@/components/platform/platform-shell'

export default async function PlatformConsoleLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const admin = await getPlatformAdmin()
  if (!admin) {
    // 已登录但非平台超管 → 回客户系统;未登录 → 去平台登录页
    const session = await auth.api.getSession({ headers: await headers() })
    redirect(session?.user ? '/' : '/platform/login')
  }

  // 进入中控台时若距上次扫描超过节流阈值则自动跑一次健康扫描(失败不影响渲染)
  await autoRunPlatformScanIfDue().catch(() => {})

  // 侧边栏告警角标:未处理告警数
  let alertCount = 0
  try {
    const { rows } = await pool.query(
      "SELECT COUNT(*)::int AS c FROM platform_alerts WHERE status = 'open'",
    )
    alertCount = rows[0]?.c ?? 0
  } catch {
    alertCount = 0
  }

  return (
    <PlatformShell admin={admin} alertCount={alertCount}>
      {children}
    </PlatformShell>
  )
}
