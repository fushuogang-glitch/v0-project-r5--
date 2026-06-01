import { redirect } from 'next/navigation'
import { getPlatformAdmin } from '@/lib/platform'
import { platformAdminExists } from '@/app/actions/platform-auth'
import { PlatformLoginForm } from '@/components/platform/platform-login-form'

export const dynamic = 'force-dynamic'

export const metadata = {
  title: '运营中控台 · 登录',
}

export default async function PlatformLoginPage() {
  const admin = await getPlatformAdmin()
  if (admin) redirect('/platform')
  // 系统尚无超管:进入首次引导
  if (!(await platformAdminExists())) redirect('/platform/setup')
  return <PlatformLoginForm />
}
