import { redirect } from 'next/navigation'
import { getPlatformAdmin } from '@/lib/platform'
import { PlatformLoginForm } from '@/components/platform/platform-login-form'

export const metadata = {
  title: '运营中控台 · 登录',
}

export default async function PlatformLoginPage() {
  const admin = await getPlatformAdmin()
  if (admin) redirect('/platform')
  return <PlatformLoginForm />
}
