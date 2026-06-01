'use client'

import { useState, useTransition } from 'react'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Switch } from '@/components/ui/switch'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import {
  ShieldCheck,
  Bot,
  RefreshCw,
  ArrowLeftRight,
  CheckCircle2,
  AlertCircle,
  XCircle,
} from 'lucide-react'
import type { ChannelHealth } from '@/app/actions/saas'
import { saveAutoSyncSettings } from '@/app/actions/org-profile'

function fmt(iso: string | null) {
  if (!iso) return '从未'
  return new Date(iso).toLocaleString('zh-CN', { hour12: false })
}

const STATUS_BADGE = {
  healthy: { label: '运行正常', className: 'bg-emerald-100 text-emerald-700 border-emerald-200', icon: CheckCircle2 },
  idle: { label: '待激活', className: 'bg-amber-100 text-amber-700 border-amber-200', icon: AlertCircle },
  down: { label: '未启用', className: 'bg-muted text-muted-foreground border-border', icon: XCircle },
} as const

export function SyncHealthPanel({
  health,
  initialEnabled,
  initialInterval,
  initialPrimary,
}: {
  health: ChannelHealth
  initialEnabled: boolean
  initialInterval: number
  initialPrimary: 'agent' | 'auto'
}) {
  const [enabled, setEnabled] = useState(initialEnabled)
  const [interval, setIntervalVal] = useState(initialInterval)
  const [primary, setPrimary] = useState<'agent' | 'auto'>(initialPrimary)
  const [pending, startTransition] = useTransition()
  const [msg, setMsg] = useState<string | null>(null)

  function save(next?: Partial<{ enabled: boolean; interval: number; primary: 'agent' | 'auto' }>) {
    const payload = {
      autoSyncEnabled: next?.enabled ?? enabled,
      autoSyncIntervalMin: next?.interval ?? interval,
      primaryChannel: next?.primary ?? primary,
    }
    startTransition(async () => {
      const res = await saveAutoSyncSettings(payload)
      setMsg(res.ok ? '已保存自动同步设置' : res.error)
      setTimeout(() => setMsg(null), 2500)
    })
  }

  const redundancy = health.redundancy
  const redundancyMeta =
    redundancy === 'dual'
      ? { label: '双通道互备', className: 'bg-emerald-100 text-emerald-700 border-emerald-200' }
      : redundancy === 'single'
        ? { label: '单通道运行', className: 'bg-amber-100 text-amber-700 border-amber-200' }
        : { label: '无可用通道', className: 'bg-rose-100 text-rose-700 border-rose-200' }

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <CardTitle className="flex items-center gap-2 text-base">
              <ArrowLeftRight className="size-4" />
              门店数据同步 · 双架构互备
            </CardTitle>
            <CardDescription>
              Agent 推送与自动拉取互为备份:任一通道异常,另一通道继续保障数据不断流
            </CardDescription>
          </div>
          <Badge variant="outline" className={redundancyMeta.className}>
            <ShieldCheck className="mr-1 size-3.5" />
            {redundancyMeta.label}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-5">
        {/* 双通道状态 */}
        <div className="grid gap-3 sm:grid-cols-2">
          <ChannelCard
            icon={Bot}
            title="通道 A · Agent 推送"
            desc="公司侧财务 Agent 凭 NOTA 密钥实时回填"
            status={health.agent.status}
            isPrimary={primary === 'agent'}
            rows={[
              ['密钥状态', health.agent.configured ? '已生成' : '未生成'],
              ['近 30 天回填', `${health.agent.recentCount} 条`],
              ['最近回填', fmt(health.agent.lastInboundAt)],
            ]}
          />
          <ChannelCard
            icon={RefreshCw}
            title="通道 B · 自动拉取"
            desc="系统按间隔主动从 SaaS 拉取兜底"
            status={health.auto.status}
            isPrimary={primary === 'auto'}
            rows={[
              ['接口配置', health.auto.configured ? '已配置' : '未配置'],
              ['自动同步', health.auto.enabled ? `每 ${health.auto.intervalMin} 分钟` : '已关闭'],
              ['最近同步', fmt(health.auto.lastSyncedAt)],
            ]}
          />
        </div>

        {/* 自动同步设置 */}
        <div className="space-y-4 rounded-lg border border-border bg-muted/30 p-4">
          <div className="flex items-center justify-between gap-3">
            <div className="space-y-0.5">
              <Label className="text-sm font-medium text-foreground">
                进入系统时自动补同步
              </Label>
              <p className="text-xs text-muted-foreground">
                开启后,登录加载页面时若距上次同步超过设定间隔,系统自动从 SaaS 拉取补齐
              </p>
            </div>
            <Switch
              checked={enabled}
              onCheckedChange={(v) => {
                setEnabled(v)
                save({ enabled: v })
              }}
            />
          </div>

          <div className="flex flex-wrap items-end gap-4">
            <div className="space-y-1.5">
              <Label className="text-xs font-medium">补同步间隔(分钟)</Label>
              <Input
                type="number"
                min={30}
                max={1440}
                value={interval}
                onChange={(e) => setIntervalVal(Number(e.target.value))}
                onBlur={() => save()}
                className="h-9 w-32"
                disabled={!enabled}
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-medium">主通道</Label>
              <div className="flex gap-2">
                {(['agent', 'auto'] as const).map((c) => (
                  <Button
                    key={c}
                    type="button"
                    size="sm"
                    variant={primary === c ? 'default' : 'outline'}
                    onClick={() => {
                      setPrimary(c)
                      save({ primary: c })
                    }}
                  >
                    {c === 'agent' ? 'Agent 推送' : '自动拉取'}
                  </Button>
                ))}
              </div>
            </div>
          </div>

          {msg && <p className="text-sm text-emerald-600">{msg}</p>}
          <p className="text-xs text-muted-foreground">
            说明:两条通道写入同一去重键,即便同时运行也不会重复入账。主通道异常时,备用通道自动补齐缺口。
          </p>
        </div>
      </CardContent>
    </Card>
  )
}

function ChannelCard({
  icon: Icon,
  title,
  desc,
  status,
  isPrimary,
  rows,
}: {
  icon: typeof Bot
  title: string
  desc: string
  status: 'healthy' | 'idle' | 'down'
  isPrimary: boolean
  rows: [string, string][]
}) {
  const meta = STATUS_BADGE[status]
  const StatusIcon = meta.icon
  return (
    <div className="space-y-3 rounded-lg border border-border p-3">
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2">
          <div className="flex size-8 items-center justify-center rounded-md bg-muted">
            <Icon className="size-4 text-foreground" />
          </div>
          <div>
            <div className="flex items-center gap-1.5">
              <span className="text-sm font-medium text-foreground">{title}</span>
              {isPrimary && (
                <Badge variant="secondary" className="px-1.5 py-0 text-[10px]">
                  主
                </Badge>
              )}
            </div>
            <p className="text-xs text-muted-foreground">{desc}</p>
          </div>
        </div>
        <Badge variant="outline" className={`shrink-0 gap-1 ${meta.className}`}>
          <StatusIcon className="size-3" />
          {meta.label}
        </Badge>
      </div>
      <dl className="space-y-1 text-xs">
        {rows.map(([k, v]) => (
          <div key={k} className="flex justify-between">
            <dt className="text-muted-foreground">{k}</dt>
            <dd className="font-medium text-foreground">{v}</dd>
          </div>
        ))}
      </dl>
    </div>
  )
}
