'use client'

import { useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Building2, Store, Check, ChevronsUpDown } from 'lucide-react'
import { setViewEntity } from '@/app/actions/org'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

type EntityOpt = { id: number; name: string; code: string }

export function ViewSwitcher({
  role,
  entities,
  currentEntityId,
}: {
  role: 'group' | 'store'
  entities: EntityOpt[]
  currentEntityId: number | null
}) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()

  // 门店端:锁定显示自己的门店,不可切换
  if (role === 'store') {
    const self = entities[0]
    return (
      <div className="flex items-center gap-2 rounded-lg border border-border bg-muted/40 px-3 py-1.5">
        <Store className="size-4 text-muted-foreground" />
        <div className="flex flex-col leading-tight">
          <span className="text-sm font-medium text-foreground">{self?.name ?? '门店'}</span>
          <span className="text-[11px] text-muted-foreground">门店端 · 仅本店数据</span>
        </div>
      </div>
    )
  }

  const current = currentEntityId
    ? entities.find((e) => e.id === currentEntityId)
    : null

  const select = (value: string) => {
    startTransition(async () => {
      await setViewEntity(value)
      router.refresh()
    })
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="outline"
          className="h-auto justify-between gap-2 py-1.5 min-w-[220px]"
          disabled={pending}
        >
          <span className="flex items-center gap-2">
            {current ? (
              <Store className="size-4 text-muted-foreground" />
            ) : (
              <Building2 className="size-4 text-primary" />
            )}
            <span className="flex flex-col items-start leading-tight">
              <span className="text-sm font-medium">
                {current ? current.name : '集团总览'}
              </span>
              <span className="text-[11px] text-muted-foreground">
                {current ? current.code : '全部主体汇总'}
              </span>
            </span>
          </span>
          <ChevronsUpDown className="size-4 text-muted-foreground" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-[260px]">
        <DropdownMenuLabel>切换视图</DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={() => select('group')} className="gap-2">
          <Building2 className="size-4" />
          <span className="flex-1">集团总览</span>
          {!current && <Check className="size-4 text-primary" />}
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuLabel className="text-xs text-muted-foreground">
          单门店 / 主体
        </DropdownMenuLabel>
        {entities.map((e) => (
          <DropdownMenuItem
            key={e.id}
            onClick={() => select(String(e.id))}
            className="gap-2"
          >
            <Store className="size-4" />
            <span className="flex flex-1 flex-col leading-tight">
              <span className={cn('truncate', current?.id === e.id && 'font-medium')}>
                {e.name}
              </span>
              <span className="text-[11px] text-muted-foreground">{e.code}</span>
            </span>
            {current?.id === e.id && <Check className="size-4 shrink-0 text-primary" />}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
