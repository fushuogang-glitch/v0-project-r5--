'use client'

import { useState } from 'react'
import { authClient } from '@/lib/auth-client'
import { Button } from '@/components/ui/button'
import { LogOut } from 'lucide-react'

export function SignOutButton() {
  const [loading, setLoading] = useState(false)
  return (
    <Button
      variant="outline"
      className="w-full"
      disabled={loading}
      onClick={async () => {
        setLoading(true)
        await authClient.signOut()
        window.location.href = '/sign-in'
      }}
    >
      <LogOut className="size-4" />
      {loading ? '正在退出…' : '退出登录'}
    </Button>
  )
}
