'use client'

import { useState, useTransition } from 'react'
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
import { Lock, ShieldCheck, KeyRound } from 'lucide-react'
import { AgentApiManager } from '@/components/agent-api-manager'
import { setSecurityPin, verifySecurityPin } from '@/app/actions/org-profile'

/**
 * NOTA API 密钥安全区:
 * - 该区域涉及生成/重置可访问全部门店数据的 API 密钥,风险高。
 * - 进入前必须通过 6 位安全 PIN 校验,且仅集团管理员(boss/超管)可见。
 * - 未设置 PIN 时引导先设置。
 */
export function SecureApiSection({
  initialKey,
  baseUrl,
  hasPin,
}: {
  initialKey: string | null
  baseUrl: string
  hasPin: boolean
}) {
  const [unlocked, setUnlocked] = useState(false)
  const [pinExists, setPinExists] = useState(hasPin)

  if (unlocked) {
    return (
      <div className="space-y-3">
        <div className="flex items-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
          <ShieldCheck className="size-4" />
          已通过安全验证,本次会话可管理密钥
          <button
            type="button"
            className="ml-auto text-xs font-medium underline"
            onClick={() => setUnlocked(false)}
          >
            重新锁定
          </button>
        </div>
        <AgentApiManager initialKey={initialKey} baseUrl={baseUrl} />
        <PinSettingCard pinExists={pinExists} onChanged={() => setPinExists(true)} />
      </div>
    )
  }

  return (
    <LockedGate
      pinExists={pinExists}
      onUnlock={() => setUnlocked(true)}
      onPinCreated={() => setPinExists(true)}
    />
  )
}

function LockedGate({
  pinExists,
  onUnlock,
  onPinCreated,
}: {
  pinExists: boolean
  onUnlock: () => void
  onPinCreated: () => void
}) {
  const [pin, setPin] = useState('')
  const [pending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)

  function unlock() {
    setError(null)
    startTransition(async () => {
      const res = await verifySecurityPin(pin)
      if (res.ok) onUnlock()
      else setError(res.error)
    })
  }

  return (
    <Card className="border-amber-200">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Lock className="size-4 text-amber-600" />
          NOTA API 密钥 · 安全区
        </CardTitle>
        <CardDescription>
          该密钥可调用接口访问全部门店财务数据,属高风险操作。请输入 6 位安全 PIN 解锁,仅集团 Boss / 超级管理员可操作。
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {pinExists ? (
          <>
            <div className="space-y-1.5">
              <Label className="text-xs font-medium">安全 PIN</Label>
              <Input
                type="password"
                inputMode="numeric"
                maxLength={6}
                value={pin}
                onChange={(e) => {
                  setPin(e.target.value.replace(/\D/g, '').slice(0, 6))
                  setError(null)
                }}
                placeholder="● ● ● ● ● ●"
                className="max-w-[200px] text-center font-mono tracking-[0.4em]"
                onKeyDown={(e) => e.key === 'Enter' && pin.length === 6 && unlock()}
              />
            </div>
            {error && <p className="text-sm text-destructive">{error}</p>}
            <Button onClick={unlock} disabled={pending || pin.length !== 6}>
              <KeyRound className="size-4" />
              解锁密钥管理
            </Button>
          </>
        ) : (
          <FirstTimePinSetup onCreated={onPinCreated} />
        )}
      </CardContent>
    </Card>
  )
}

/** 首次进入:尚未设置 PIN,引导设置 */
function FirstTimePinSetup({ onCreated }: { onCreated: () => void }) {
  const [pin, setPin] = useState('')
  const [confirm, setConfirm] = useState('')
  const [pending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)

  function create() {
    setError(null)
    if (pin !== confirm) {
      setError('两次输入的 PIN 不一致')
      return
    }
    startTransition(async () => {
      const res = await setSecurityPin({ newPin: pin })
      if (res.ok) onCreated()
      else setError(res.error)
    })
  }

  return (
    <div className="space-y-3">
      <p className="rounded-md bg-amber-50 px-3 py-2 text-sm text-amber-700">
        尚未设置安全 PIN。请先设置一个 6 位数字 PIN,之后每次管理密钥都需要它。
      </p>
      <div className="flex flex-wrap gap-3">
        <div className="space-y-1.5">
          <Label className="text-xs font-medium">设置 6 位 PIN</Label>
          <Input
            type="password"
            inputMode="numeric"
            maxLength={6}
            value={pin}
            onChange={(e) => setPin(e.target.value.replace(/\D/g, '').slice(0, 6))}
            className="max-w-[160px] text-center font-mono tracking-[0.3em]"
          />
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs font-medium">确认 PIN</Label>
          <Input
            type="password"
            inputMode="numeric"
            maxLength={6}
            value={confirm}
            onChange={(e) => setConfirm(e.target.value.replace(/\D/g, '').slice(0, 6))}
            className="max-w-[160px] text-center font-mono tracking-[0.3em]"
          />
        </div>
      </div>
      {error && <p className="text-sm text-destructive">{error}</p>}
      <Button onClick={create} disabled={pending || pin.length !== 6}>
        设置安全 PIN
      </Button>
    </div>
  )
}

/** 解锁后:允许修改 PIN */
function PinSettingCard({
  pinExists,
  onChanged,
}: {
  pinExists: boolean
  onChanged: () => void
}) {
  const [oldPin, setOldPin] = useState('')
  const [newPin, setNewPin] = useState('')
  const [pending, startTransition] = useTransition()
  const [msg, setMsg] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  function save() {
    setError(null)
    setMsg(null)
    startTransition(async () => {
      const res = await setSecurityPin({ newPin, oldPin: pinExists ? oldPin : undefined })
      if (res.ok) {
        setMsg('安全 PIN 已更新')
        setOldPin('')
        setNewPin('')
        onChanged()
      } else setError(res.error)
    })
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Lock className="size-4" />
          修改安全 PIN
        </CardTitle>
        <CardDescription>更新解锁本安全区所需的 6 位 PIN</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex flex-wrap gap-3">
          {pinExists && (
            <div className="space-y-1.5">
              <Label className="text-xs font-medium">原 PIN</Label>
              <Input
                type="password"
                inputMode="numeric"
                maxLength={6}
                value={oldPin}
                onChange={(e) => setOldPin(e.target.value.replace(/\D/g, '').slice(0, 6))}
                className="max-w-[160px] text-center font-mono tracking-[0.3em]"
              />
            </div>
          )}
          <div className="space-y-1.5">
            <Label className="text-xs font-medium">新 PIN</Label>
            <Input
              type="password"
              inputMode="numeric"
              maxLength={6}
              value={newPin}
              onChange={(e) => setNewPin(e.target.value.replace(/\D/g, '').slice(0, 6))}
              className="max-w-[160px] text-center font-mono tracking-[0.3em]"
            />
          </div>
        </div>
        {error && <p className="text-sm text-destructive">{error}</p>}
        {msg && <p className="text-sm text-emerald-600">{msg}</p>}
        <Button variant="outline" onClick={save} disabled={pending || newPin.length !== 6}>
          更新 PIN
        </Button>
      </CardContent>
    </Card>
  )
}
