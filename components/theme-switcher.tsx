'use client'

import * as React from 'react'
import { useTheme } from 'next-themes'
import { Check, Palette } from 'lucide-react'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { SidebarMenuButton } from '@/components/ui/sidebar'

type ThemeOption = {
  value: string
  label: string
  hint: string
  // 预览用的实色(与 globals.css 中各模板主色/背景一致)
  swatch: { primary: string; bg: string; accent: string }
}

const THEMES: ThemeOption[] = [
  {
    value: 'coffee',
    label: '高级咖色',
    hint: '暖棕奶咖',
    swatch: {
      primary: 'oklch(0.42 0.055 58)',
      bg: 'oklch(0.99 0.006 70)',
      accent: 'oklch(0.93 0.022 68)',
    },
  },
  {
    value: 'ocean',
    label: '深海蓝',
    hint: '沉稳专业',
    swatch: {
      primary: 'oklch(0.48 0.12 250)',
      bg: 'oklch(0.99 0.005 240)',
      accent: 'oklch(0.92 0.035 240)',
    },
  },
  {
    value: 'forest',
    label: '松墨绿',
    hint: '清新自然',
    swatch: {
      primary: 'oklch(0.46 0.09 158)',
      bg: 'oklch(0.99 0.007 150)',
      accent: 'oklch(0.92 0.04 150)',
    },
  },
  {
    value: 'wealth',
    label: '招财金',
    hint: '财神临门 · 暗纹',
    swatch: {
      primary: 'oklch(0.5 0.16 32)',
      bg: 'oklch(0.97 0.014 50)',
      accent: 'oklch(0.85 0.09 75)',
    },
  },
]

function Swatch({ s }: { s: ThemeOption['swatch'] }) {
  return (
    <span
      className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md border border-border"
      style={{ background: s.bg }}
      aria-hidden
    >
      <span className="flex gap-0.5">
        <span className="h-3 w-1.5 rounded-sm" style={{ background: s.primary }} />
        <span className="h-3 w-1.5 rounded-sm" style={{ background: s.accent }} />
      </span>
    </span>
  )
}

export function ThemeSwitcher() {
  const { theme, setTheme } = useTheme()
  const [mounted, setMounted] = React.useState(false)
  React.useEffect(() => setMounted(true), [])

  // 避免 hydration 不匹配:挂载前用默认主题占位
  const current = mounted ? (theme ?? 'coffee') : 'coffee'
  const active = THEMES.find((t) => t.value === current) ?? THEMES[0]

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <SidebarMenuButton className="h-auto py-2" aria-label="切换主题配色">
          <Palette className="size-4" />
          <span className="flex flex-col items-start leading-tight">
            <span className="text-sm font-medium">主题配色</span>
            <span className="text-xs text-muted-foreground">{active.label}</span>
          </span>
          <Swatch s={active.swatch} />
        </SidebarMenuButton>
      </DropdownMenuTrigger>
      <DropdownMenuContent side="top" align="start" className="w-56">
        <DropdownMenuLabel>选择主题模板</DropdownMenuLabel>
        <DropdownMenuSeparator />
        {THEMES.map((t) => (
          <DropdownMenuItem
            key={t.value}
            onClick={() => setTheme(t.value)}
            className="flex items-center gap-2.5 py-2"
          >
            <Swatch s={t.swatch} />
            <span className="flex flex-col leading-tight">
              <span className="text-sm">{t.label}</span>
              <span className="text-xs text-muted-foreground">{t.hint}</span>
            </span>
            {current === t.value && <Check className="ml-auto size-4 text-primary" />}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
