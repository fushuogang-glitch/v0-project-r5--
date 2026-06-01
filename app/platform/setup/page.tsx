import { redirect } from 'next/navigation'
import { platformAdminExists } from '@/app/actions/platform-auth'
import { PlatformSetupForm } from '@/components/platform/platform-setup-form'

export const dynamic = 'force-dynamic'

export default async function PlatformSetupPage() {
  // 已有超管则关闭引导,回到登录
  if (await platformAdminExists()) redirect('/platform/login')
  return <PlatformSetupForm />
}
