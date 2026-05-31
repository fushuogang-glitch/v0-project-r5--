'use client'

import { useState, useTransition } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Copy, KeyRound, RefreshCw, Check } from 'lucide-react'
import { rotateAgentApiKey } from '@/app/actions/org'

export function AgentApiManager({
  initialKey,
  baseUrl,
}: {
  initialKey: string | null
  baseUrl: string
}) {
  const [apiKey, setApiKey] = useState(initialKey)
  const [pending, startTransition] = useTransition()
  const [copied, setCopied] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  function rotate() {
    setError(null)
    startTransition(async () => {
      const res = await rotateAgentApiKey()
      if (res.ok) setApiKey(res.key)
      else setError(res.error)
    })
  }

  function copy(text: string, id: string) {
    navigator.clipboard.writeText(text)
    setCopied(id)
    setTimeout(() => setCopied(null), 1500)
  }

  const keyDisplay = apiKey ?? '尚未生成'

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <CardTitle className="flex items-center gap-2 text-base">
              <KeyRound className="size-4" />
              财务 Agent 密钥
            </CardTitle>
            <CardDescription>
              公司侧财务 Agent 凭此密钥调用接口,自动抓取门店数据并回填流水
            </CardDescription>
          </div>
          <Badge
            variant="outline"
            className={
              apiKey
                ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
                : 'border-amber-200 bg-amber-50 text-amber-700'
            }
          >
            {apiKey ? '已启用' : '未启用'}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center gap-2">
          <Input
            readOnly
            value={keyDisplay}
            className="font-mono text-sm"
            type="text"
          />
          <Button
            type="button"
            variant="outline"
            size="icon"
            disabled={!apiKey}
            onClick={() => apiKey && copy(apiKey, 'key')}
            aria-label="复制密钥"
          >
            {copied === 'key' ? <Check className="size-4" /> : <Copy className="size-4" />}
          </Button>
          <Button type="button" onClick={rotate} disabled={pending}>
            <RefreshCw className={pending ? 'size-4 animate-spin' : 'size-4'} />
            {apiKey ? '重置' : '生成'}
          </Button>
        </div>
        {error && <p className="text-sm text-destructive">{error}</p>}
        {apiKey && (
          <p className="text-xs text-muted-foreground">
            重置后旧密钥立即失效,请同步更新到财务 Agent 配置。
          </p>
        )}

        <div className="rounded-lg border border-border bg-muted/40 p-3">
          <p className="mb-1 text-xs font-medium text-foreground">接口根地址 Base URL</p>
          <div className="flex items-center gap-2">
            <code className="flex-1 truncate rounded bg-background px-2 py-1 font-mono text-xs">
              {baseUrl}/api/agent
            </code>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              onClick={() => copy(`${baseUrl}/api/agent`, 'url')}
              aria-label="复制地址"
            >
              {copied === 'url' ? <Check className="size-4" /> : <Copy className="size-4" />}
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
