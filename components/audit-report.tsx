'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import {
  RefreshCw,
  Loader2,
  CheckCircle2,
  AlertTriangle,
  ShieldAlert,
  Check,
  RotateCcw,
} from 'lucide-react'
import { runMonthlyAudit, setFindingStatus, type AuditReport } from '@/app/actions/audit'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion'

const LEVEL_STYLE: Record<string, { label: string; cls: string }> = {
  pass: { label: '通过', cls: 'text-primary' },
  warn: { label: '警告', cls: 'text-amber-600 dark:text-amber-400' },
  risk: { label: '异常', cls: 'text-destructive' },
}

export function AuditReportView({ report }: { report: AuditReport }) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()

  function rerun() {
    startTransition(async () => {
      await runMonthlyAudit(report.period)
      router.refresh()
    })
  }

  function toggle(id: number, status: string) {
    startTransition(async () => {
      await setFindingStatus(id, status === 'resolved' ? 'open' : 'resolved')
      router.refresh()
    })
  }

  const scoreColor =
    report.score >= 90
      ? 'text-primary'
      : report.score >= 75
        ? 'text-amber-600 dark:text-amber-400'
        : 'text-destructive'

  const empty = report.total === 0

  return (
    <div className="flex flex-col gap-6">
      {/* 头部:健康分 + 重跑 */}
      <div className="flex flex-col gap-4 rounded-xl border border-border bg-card p-6 md:flex-row md:items-center md:justify-between">
        <div className="flex items-center gap-5">
          <div className="flex flex-col items-center">
            <span className={`text-4xl font-bold tabular-nums ${scoreColor}`}>
              {empty ? '--' : report.score}
            </span>
            <span className="text-xs text-muted-foreground">健康分</span>
          </div>
          <div className="h-12 w-px bg-border" />
          <div className="flex flex-col gap-1">
            <div className="flex items-center gap-3 text-sm">
              <span className="flex items-center gap-1 text-primary">
                <CheckCircle2 className="size-4" />
                通过 {report.passCount}
              </span>
              <span className="flex items-center gap-1 text-amber-600 dark:text-amber-400">
                <AlertTriangle className="size-4" />
                警告 {report.warnCount}
              </span>
              <span className="flex items-center gap-1 text-destructive">
                <ShieldAlert className="size-4" />
                异常 {report.riskCount}
              </span>
            </div>
            <p className="text-xs text-muted-foreground">
              审计期间 {report.period}
              {report.generatedAt &&
                ` · 生成于 ${new Date(report.generatedAt).toLocaleString('zh-CN')}`}
            </p>
          </div>
        </div>
        <Button onClick={rerun} disabled={pending} variant="outline" size="sm">
          {pending ? (
            <Loader2 className="size-4 animate-spin" />
          ) : (
            <RefreshCw className="size-4" />
          )}
          重新审计
        </Button>
      </div>

      {empty ? (
        <div className="rounded-xl border border-dashed border-border p-10 text-center">
          <p className="text-sm text-muted-foreground">
            本期暂无审计记录。点击「重新审计」立即生成本月审计报告。
          </p>
        </div>
      ) : (
        <Accordion type="multiple" defaultValue={report.byDimension.map((d) => d.dimension)}>
          {report.byDimension.map((dim) => (
            <AccordionItem key={dim.dimension} value={dim.dimension}>
              <AccordionTrigger className="hover:no-underline">
                <div className="flex w-full items-center justify-between pr-3">
                  <span className="font-medium text-foreground">{dim.label}</span>
                  <div className="flex items-center gap-1.5">
                    {dim.risk > 0 && (
                      <Badge variant="destructive" className="font-normal">
                        异常 {dim.risk}
                      </Badge>
                    )}
                    {dim.warn > 0 && (
                      <Badge
                        variant="outline"
                        className="border-amber-500/50 font-normal text-amber-600 dark:text-amber-400"
                      >
                        警告 {dim.warn}
                      </Badge>
                    )}
                    {dim.pass > 0 && (
                      <Badge variant="secondary" className="font-normal">
                        通过 {dim.pass}
                      </Badge>
                    )}
                  </div>
                </div>
              </AccordionTrigger>
              <AccordionContent>
                <ul className="flex flex-col gap-2">
                  {dim.findings.map((f) => {
                    const style = LEVEL_STYLE[f.level]
                    const resolved = f.status === 'resolved'
                    return (
                      <li
                        key={f.id}
                        className={`flex items-start justify-between gap-3 rounded-lg border border-border p-3 ${
                          resolved ? 'opacity-55' : ''
                        }`}
                      >
                        <div className="flex items-start gap-2.5">
                          <span className={`mt-0.5 shrink-0 ${style.cls}`}>
                            {f.level === 'pass' ? (
                              <CheckCircle2 className="size-4" />
                            ) : f.level === 'warn' ? (
                              <AlertTriangle className="size-4" />
                            ) : (
                              <ShieldAlert className="size-4" />
                            )}
                          </span>
                          <div className="flex flex-col gap-0.5">
                            <span
                              className={`text-sm font-medium text-foreground ${
                                resolved ? 'line-through' : ''
                              }`}
                            >
                              {f.title}
                            </span>
                            {f.detail && (
                              <span className="text-xs leading-relaxed text-muted-foreground">
                                {f.detail}
                              </span>
                            )}
                          </div>
                        </div>
                        {f.level !== 'pass' && (
                          <Button
                            variant="ghost"
                            size="sm"
                            className="shrink-0 text-xs text-muted-foreground"
                            onClick={() => toggle(f.id, f.status)}
                            disabled={pending}
                          >
                            {resolved ? (
                              <>
                                <RotateCcw className="size-3.5" />
                                重开
                              </>
                            ) : (
                              <>
                                <Check className="size-3.5" />
                                已处理
                              </>
                            )}
                          </Button>
                        )}
                      </li>
                    )
                  })}
                </ul>
              </AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>
      )}
    </div>
  )
}
