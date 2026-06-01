'use client'

import { useRef, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Upload, FileText, Trash2, Loader2, Download } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { addAttachment, deleteAttachment } from '@/app/actions/contracts'
import { formatFileSize } from '@/lib/contract-meta'

type Attachment = {
  id: number
  fileName: string
  mimeType: string
  fileSize: number
  dataUrl: string
  createdAt: string
}

const MAX = 4 * 1024 * 1024

export function ContractAttachments({
  contractId,
  attachments,
}: {
  contractId: number
  attachments: Attachment[]
}) {
  const router = useRouter()
  const inputRef = useRef<HTMLInputElement>(null)
  const [pending, startTransition] = useTransition()
  const [uploading, setUploading] = useState(false)

  function pick() {
    inputRef.current?.click()
  }

  async function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    if (file.size > MAX) {
      toast.error('单个附件不能超过 4MB')
      return
    }
    setUploading(true)
    try {
      const dataUrl = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader()
        reader.onload = () => resolve(reader.result as string)
        reader.onerror = () => reject(new Error('读取文件失败'))
        reader.readAsDataURL(file)
      })
      await addAttachment(contractId, {
        fileName: file.name,
        mimeType: file.type || 'application/octet-stream',
        fileSize: file.size,
        dataUrl,
      })
      toast.success('附件已上传')
      router.refresh()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : '上传失败')
    } finally {
      setUploading(false)
    }
  }

  function remove(id: number) {
    startTransition(async () => {
      try {
        await deleteAttachment(id)
        toast.success('附件已删除')
        router.refresh()
      } catch (err) {
        toast.error(err instanceof Error ? err.message : '删除失败')
      }
    })
  }

  return (
    <div className="space-y-3">
      <input
        ref={inputRef}
        type="file"
        accept="image/*,.pdf"
        className="hidden"
        onChange={onFile}
      />
      <Button variant="outline" size="sm" onClick={pick} disabled={uploading}>
        {uploading ? <Loader2 className="size-4 animate-spin" /> : <Upload className="size-4" />}
        上传合同扫描件 / PDF
      </Button>

      {attachments.length === 0 ? (
        <p className="rounded-lg border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
          暂无附件,上传合同扫描件或 PDF 留存(单个不超过 4MB)
        </p>
      ) : (
        <ul className="divide-y divide-border rounded-lg border border-border">
          {attachments.map((a) => {
            const isImage = a.mimeType.startsWith('image/')
            return (
              <li key={a.id} className="flex items-center gap-3 p-3">
                {isImage ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={a.dataUrl || '/placeholder.svg'}
                    alt={a.fileName}
                    className="h-12 w-12 shrink-0 rounded border border-border object-cover"
                  />
                ) : (
                  <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded border border-border bg-muted text-muted-foreground">
                    <FileText className="size-5" />
                  </span>
                )}
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-foreground">{a.fileName}</p>
                  <p className="text-xs text-muted-foreground">{formatFileSize(a.fileSize)}</p>
                </div>
                <a href={a.dataUrl} download={a.fileName} aria-label={`下载 ${a.fileName}`}>
                  <Button variant="ghost" size="icon" className="size-8" type="button">
                    <Download className="size-4" />
                  </Button>
                </a>
                <Button
                  variant="ghost"
                  size="icon"
                  className="size-8 text-destructive"
                  onClick={() => remove(a.id)}
                  disabled={pending}
                  aria-label={`删除 ${a.fileName}`}
                >
                  <Trash2 className="size-4" />
                </Button>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
