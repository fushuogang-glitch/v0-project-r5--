'use client'

import { useState, useTransition } from 'react'
import {
  RefreshCw,
  Plug,
  CheckCircle2,
  XCircle,
  AlertCircle,
  Save,
  Link2,
} from 'lucide-react'
import {
  saveSaasConfig,
  testSaasConnection,
  saveEntityMapping,
  syncNow,
  type SaasSettings,
  type SaasSyncReport,
} from '@/app/actions/saas'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'

const STATUS_MAP: Record<
  string,
  { label: string; className: string; icon: typeof CheckCircle2 }
> = {
  connected: {
    label: '已连接',
    className: 'bg-emerald-100 text-emerald-700 border-emerald-200',
    icon: CheckCircle2,
  },
  error: {
    label: '连接异常',
    className: 'bg-rose-100 text-rose-700 border-rose-200',
    icon: XCircle,
  },
  unconfigured: {
    label: '未配置',
    className: 'bg-muted text-muted-foreground border-border',
    icon: AlertCircle,
  },
}

function fmt(iso: string | null) {
  if (!iso) return '从未'
  return new Date(iso).toLocaleString('zh-CN', { hour12: false })
}

export function SaasIntegrationManager({ initial }: { initial: SaasSettings }) {
  const [settings, setSettings] = useState<SaasSettings>(initial)
  const [baseUrl, setBaseUrl] = useState(initial.baseUrl)
  const [apiKey, setApiKey] = useState('')
  const [mappings, setMappings] = useState(initial.mappings)
  const [msg, setMsg] = useState<{ type: 'ok' | 'err'; text: string } | null>(null)
  const [report, setReport] = useState<SaasSyncReport | null>(initial.lastSyncReport)

  const [savingCfg, startSaveCfg] = useTransition()
  const [testing, startTest] = useTransition()
  const [savingMap, startSaveMap] = useTransition()
  const [syncing, startSync] = useTransition()

  const status = STATUS_MAP[settings.status] ?? STATUS_MAP.unconfigured
  const StatusIcon = status.icon

  const flash = (type: 'ok' | 'err', text: string) => {
    setMsg({ type, text })
    setTimeout(() => setMsg(null), 4000)
  }

  const handleSaveConfig = () =>
    startSaveCfg(async () => {
      const res = await saveSaasConfig({ baseUrl, apiKey: apiKey || undefined })
      if (res.ok) {
        setApiKey('')
        flash('ok', '配置已保存')
        const next = await testSaasConnection()
        if ('settings' in next) setSettings(next.settings)
      } else {
        flash('err', res.error)
      }
    })

  const handleTest = () =>
    startTest(async () => {
      const res = await testSaasConnection({ baseUrl, apiKey: apiKey || undefined })
      if ('settings' in res) {
        setSettings(res.settings)
        flash(res.ping.ok ? 'ok' : 'err', res.ping.ok ? '连接成功' : `连接失败:${res.ping.message}`)
      } else {
        flash('err', res.error)
      }
    })

  const handleSaveMapping = () =>
    startSaveMap(async () => {
      const res = await saveEntityMapping({
        items: mappings.map((m) => ({ entityId: m.entityId, storeCode: m.storeCode })),
      })
      if (res.ok) flash('ok', '门店映射已保存')
      else flash('err', res.error)
    })

  const handleSync = () =>
    startSync(async () => {
      const res = await syncNow()
      if (res.ok) {
        setReport(res.report)
        setSettings((s) => ({ ...s, lastSyncedAt: res.report.at, lastSyncReport: res.report }))
        flash('ok', `同步完成:新增 ${res.report.added} 条,跳过 ${res.report.skipped} 条`)
      } else {
        flash('err', res.error)
      }
    })

  return (
    <div className="space-y-6">
      {/* 连接状态卡 */}
      <Card>
        <CardHeader>
          <div className="flex items-start justify-between gap-4">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Plug className="size-4" />
                SaaS 系统对接
              </CardTitle>
              <CardDescription>
                对接 NOTA CoreControl™ 全智能 SaaS,自动拉取门店储值、消耗、营业、薪酬与采购数据
              </CardDescription>
            </div>
            <Badge variant="outline" className={`gap-1 ${status.className}`}>
              <StatusIcon className="size-3.5" />
              {status.label}
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {settings.envConfigured && (
            <p className="rounded-md bg-muted px-3 py-2 text-xs text-muted-foreground">
              检测到环境变量 SAAS_API_BASE_URL / SAAS_API_KEY,将作为默认兜底配置。下方填写的配置优先级更高。
            </p>
          )}

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="saas-url" className="text-xs">接口地址 (Base URL)</Label>
              <Input
                id="saas-url"
                value={baseUrl}
                onChange={(e) => setBaseUrl(e.target.value)}
                placeholder="https://api.nota-saas.com"
                className="h-9 text-sm"
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="saas-key" className="text-xs">
                API Key{' '}
                {settings.hasKey && (
                  <span className="text-muted-foreground">
                    (当前 {settings.apiKeyMasked},留空不修改)
                  </span>
                )}
              </Label>
              <Input
                id="saas-key"
                type="password"
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                placeholder={settings.hasKey ? '••••••••' : '粘贴 SaaS API Key'}
                className="h-9 text-sm"
              />
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Button onClick={handleSaveConfig} disabled={savingCfg} size="sm" className="gap-1.5">
              <Save className="size-4" />
              {savingCfg ? '保存中...' : '保存配置'}
            </Button>
            <Button onClick={handleTest} disabled={testing} size="sm" variant="outline" className="gap-1.5">
              <Plug className="size-4" />
              {testing ? '测试中...' : '测试连接'}
            </Button>
            <span className="text-xs text-muted-foreground">
              上次测试:{fmt(settings.lastTestedAt)}
            </span>
          </div>

          {msg && (
            <p className={`text-sm ${msg.type === 'ok' ? 'text-emerald-600' : 'text-rose-600'}`}>
              {msg.text}
            </p>
          )}
        </CardContent>
      </Card>

      {/* 门店映射卡 */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Link2 className="size-4" />
            主体 ↔ SaaS 门店编码映射
          </CardTitle>
          <CardDescription>
            默认使用主体编码作为 SaaS 门店编码,如 SaaS 侧编码不同请在此覆盖
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="overflow-hidden rounded-md border border-border">
            <table className="w-full text-sm">
              <thead className="bg-muted/50 text-xs text-muted-foreground">
                <tr>
                  <th className="px-3 py-2 text-left font-medium">主体名称</th>
                  <th className="px-3 py-2 text-left font-medium">主体编码</th>
                  <th className="px-3 py-2 text-left font-medium">SaaS 门店编码</th>
                </tr>
              </thead>
              <tbody>
                {mappings.map((m, i) => (
                  <tr key={m.entityId} className="border-t border-border">
                    <td className="px-3 py-2 text-foreground">{m.name}</td>
                    <td className="px-3 py-2 text-muted-foreground">{m.code}</td>
                    <td className="px-2 py-1.5">
                      <Input
                        value={m.storeCode}
                        onChange={(e) => {
                          const v = e.target.value
                          setMappings((prev) =>
                            prev.map((x, xi) => (xi === i ? { ...x, storeCode: v } : x)),
                          )
                        }}
                        className="h-8 text-sm"
                      />
                    </td>
                  </tr>
                ))}
                {mappings.length === 0 && (
                  <tr>
                    <td colSpan={3} className="px-3 py-6 text-center text-muted-foreground">
                      暂无主体,请先在组织管理中添加门店主体
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
          {mappings.length > 0 && (
            <Button onClick={handleSaveMapping} disabled={savingMap} size="sm" variant="outline" className="gap-1.5">
              <Save className="size-4" />
              {savingMap ? '保存中...' : '保存映射'}
            </Button>
          )}
        </CardContent>
      </Card>

      {/* 立即同步卡 */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <RefreshCw className="size-4" />
            数据同步
          </CardTitle>
          <CardDescription>
            手动触发从 SaaS 拉取全部门店数据并写入财务流水(自动去重,不会重复入账)
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap items-center gap-3">
            <Button onClick={handleSync} disabled={syncing} className="gap-1.5">
              <RefreshCw className={`size-4 ${syncing ? 'animate-spin' : ''}`} />
              {syncing ? '同步中...' : '立即同步'}
            </Button>
            <span className="text-xs text-muted-foreground">
              上次同步:{fmt(settings.lastSyncedAt)}
            </span>
          </div>

          {report && (
            <div className="space-y-3 rounded-md border border-border p-4">
              <div className="flex flex-wrap gap-x-6 gap-y-1 text-sm">
                <span className="text-foreground">
                  新增 <strong className="text-emerald-600">{report.added}</strong> 条
                </span>
                <span className="text-foreground">
                  跳过(已存在){' '}
                  <strong className="text-muted-foreground">{report.skipped}</strong> 条
                </span>
                <span className="self-center text-xs text-muted-foreground">{fmt(report.at)}</span>
              </div>
              <div className="grid grid-cols-2 gap-2 text-xs sm:grid-cols-5">
                {[
                  ['储值', report.byType.topUps],
                  ['消耗', report.byType.consumes],
                  ['营业', report.byType.dailyRevenue],
                  ['薪酬', report.byType.payroll],
                  ['采购', report.byType.purchases],
                ].map(([label, n]) => (
                  <div key={label as string} className="rounded bg-muted/50 px-2 py-1.5 text-center">
                    <div className="text-muted-foreground">{label}</div>
                    <div className="font-medium text-foreground">{n}</div>
                  </div>
                ))}
              </div>
              {report.storeResults.length > 0 && (
                <div className="space-y-1 border-t border-border pt-2 text-xs text-muted-foreground">
                  {report.storeResults.map((s, i) => (
                    <div key={i} className="flex items-center justify-between">
                      <span>
                        {s.entityName}
                        <Badge variant="outline" className="ml-2 text-[10px]">
                          {s.source === 'live' ? '实时' : '模拟'}
                        </Badge>
                      </span>
                      <span>
                        新增 {s.added} / 跳过 {s.skipped}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
