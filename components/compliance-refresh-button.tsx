'use client'

import { useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { RefreshCw } from 'lucide-react'
import { generateComplianceNodes } from '@/app/actions/compliance'
import { Button } from '@/components/ui/button'

export function ComplianceRefreshButton() {
  const router = useRouter()
  const [pending, start] = useTransition()

  return (
    <Button
      size="sm"
      variant="outline"
      disabled={pending}
      onClick={() =>
        start(async () => {
          await generateComplianceNodes()
          router.refresh()
        })
      }
      className="gap-1.5"
    >
      <RefreshCw className={`size-4 ${pending ? 'animate-spin' : ''}`} />
      {pending ? '生成中...' : '刷新合规节点'}
    </Button>
  )
}
