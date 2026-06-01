'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { MoreVertical, Loader2, Trash2, CheckCheck, Ban } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { setContractStatus, deleteContract } from '@/app/actions/contracts'

export function ContractActions({
  contractId,
  status,
}: {
  contractId: number
  status: string
}) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [confirmDel, setConfirmDel] = useState(false)

  function changeStatus(next: string) {
    startTransition(async () => {
      try {
        await setContractStatus(contractId, next)
        toast.success('状态已更新')
        router.refresh()
      } catch (e) {
        toast.error(e instanceof Error ? e.message : '操作失败')
      }
    })
  }

  function doDelete() {
    startTransition(async () => {
      try {
        await deleteContract(contractId)
        toast.success('合同已删除')
        router.push('/contracts')
        router.refresh()
      } catch (e) {
        toast.error(e instanceof Error ? e.message : '删除失败')
      }
    })
  }

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" size="icon" disabled={pending}>
            {pending ? <Loader2 className="size-4 animate-spin" /> : <MoreVertical className="size-4" />}
            <span className="sr-only">更多操作</span>
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-44">
          {status !== 'completed' && (
            <DropdownMenuItem onClick={() => changeStatus('completed')}>
              <CheckCheck className="size-4" />
              标记为已完成
            </DropdownMenuItem>
          )}
          {status !== 'void' && (
            <DropdownMenuItem onClick={() => changeStatus('void')}>
              <Ban className="size-4" />
              作废合同
            </DropdownMenuItem>
          )}
          <DropdownMenuSeparator />
          <DropdownMenuItem
            className="text-destructive focus:text-destructive"
            onClick={() => setConfirmDel(true)}
          >
            <Trash2 className="size-4" />
            删除合同
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <AlertDialog open={confirmDel} onOpenChange={setConfirmDel}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>确认删除合同?</AlertDialogTitle>
            <AlertDialogDescription>
              删除后将解除其关联的进账流水勾稽,并永久删除合同附件与签署记录。此操作不可撤销。
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={pending}>取消</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault()
                doDelete()
              }}
              disabled={pending}
              className="bg-destructive text-white hover:bg-destructive/90"
            >
              确认删除
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
