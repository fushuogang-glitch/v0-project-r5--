'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { PenLine, Loader2, CheckCircle2, ShieldCheck } from 'lucide-react'
import { toast } from 'sonner'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { SignaturePad } from '@/components/signature-pad'
import { signContract } from '@/app/actions/contracts'

type Signature = {
  id: number
  party: string
  signerName: string
  signatureData: string
  contractHash: string | null
  signedAt: string
}

const PARTY_LABEL: Record<string, string> = {
  partyA: '甲方(我方)',
  partyB: '乙方(对方)',
}

function fmt(iso: string) {
  const d = new Date(iso)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(
    d.getDate(),
  ).padStart(2, '0')} ${String(d.getHours()).padStart(2, '0')}:${String(
    d.getMinutes(),
  ).padStart(2, '0')}`
}

export function ContractSignPanel({
  contractId,
  signatures,
  canSign,
}: {
  contractId: number
  signatures: Signature[]
  canSign: boolean
}) {
  const byParty = new Map(signatures.map((s) => [s.party, s]))

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
      {(['partyA', 'partyB'] as const).map((party) => {
        const sig = byParty.get(party)
        return (
          <div key={party} className="rounded-lg border border-border p-4">
            <div className="mb-3 flex items-center justify-between">
              <span className="text-sm font-medium text-foreground">{PARTY_LABEL[party]}</span>
              {sig ? (
                <span className="flex items-center gap-1 text-xs text-emerald-600 dark:text-emerald-400">
                  <CheckCircle2 className="size-3.5" />
                  已签署
                </span>
              ) : (
                <span className="text-xs text-muted-foreground">待签署</span>
              )}
            </div>

            {sig ? (
              <div className="space-y-2">
                <div className="flex items-center justify-center rounded-md border border-border bg-card p-2">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={sig.signatureData || '/placeholder.svg'}
                    alt={`${sig.signerName} 的签名`}
                    className="h-16 object-contain"
                  />
                </div>
                <div className="text-xs text-muted-foreground">
                  <p className="font-medium text-foreground">{sig.signerName}</p>
                  <p>签署时间:{fmt(sig.signedAt)}</p>
                  {sig.contractHash && (
                    <p className="mt-1 flex items-center gap-1 break-all">
                      <ShieldCheck className="size-3 shrink-0 text-primary" />
                      留痕哈希 {sig.contractHash.slice(0, 16)}…
                    </p>
                  )}
                </div>
                {canSign && (
                  <SignDialog contractId={contractId} party={party} reSign signerDefault={sig.signerName} />
                )}
              </div>
            ) : canSign ? (
              <SignDialog contractId={contractId} party={party} />
            ) : (
              <p className="text-xs text-muted-foreground">暂无签署权限</p>
            )}
          </div>
        )
      })}
    </div>
  )
}

function SignDialog({
  contractId,
  party,
  reSign = false,
  signerDefault = '',
}: {
  contractId: number
  party: 'partyA' | 'partyB'
  reSign?: boolean
  signerDefault?: string
}) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [pending, startTransition] = useTransition()
  const [signerName, setSignerName] = useState(signerDefault)
  const [signatureData, setSignatureData] = useState<string | null>(null)

  function submit() {
    if (!signerName.trim()) {
      toast.error('请填写签署人姓名')
      return
    }
    if (!signatureData) {
      toast.error('请先手写签名')
      return
    }
    startTransition(async () => {
      try {
        const res = await signContract(contractId, { party, signerName, signatureData })
        toast.success(res.bothSigned ? '双方已签署,合同进入履行中' : '签署成功')
        setOpen(false)
        router.refresh()
      } catch (e) {
        toast.error(e instanceof Error ? e.message : '签署失败')
      }
    })
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant={reSign ? 'ghost' : 'outline'} size="sm" className="w-full">
          <PenLine className="size-4" />
          {reSign ? '重新签署' : '在线签署'}
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{PARTY_LABEL[party]} 在线签署</DialogTitle>
          <DialogDescription>
            手写签名并确认。系统将记录签署人、时间戳与合同留痕哈希。
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-2">
          <div className="grid gap-2">
            <Label htmlFor="signerName">签署人姓名</Label>
            <Input
              id="signerName"
              placeholder="签署人姓名"
              value={signerName}
              onChange={(e) => setSignerName(e.target.value)}
            />
          </div>
          <div className="grid gap-2">
            <Label>手写签名</Label>
            <SignaturePad onChange={setSignatureData} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)} disabled={pending}>
            取消
          </Button>
          <Button onClick={submit} disabled={pending}>
            {pending && <Loader2 className="size-4 animate-spin" />}
            确认签署
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
