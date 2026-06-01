'use client'

import { useRef, useState, useEffect, useCallback } from 'react'
import { Button } from '@/components/ui/button'
import { Eraser } from 'lucide-react'

/**
 * 手写签名画板:支持鼠标与触屏(手机/Pad),导出 PNG dataURL。
 * 通过 onChange 把当前签名(或 null)回传给父组件。
 */
export function SignaturePad({
  onChange,
  height = 180,
}: {
  onChange: (dataUrl: string | null) => void
  height?: number
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const drawing = useRef(false)
  const last = useRef<{ x: number; y: number } | null>(null)
  const [hasInk, setHasInk] = useState(false)

  // 适配高分屏 + 容器宽度
  const setup = useCallback(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const parent = canvas.parentElement
    if (!parent) return
    const ratio = window.devicePixelRatio || 1
    const width = parent.clientWidth
    canvas.width = width * ratio
    canvas.height = height * ratio
    canvas.style.width = width + 'px'
    canvas.style.height = height + 'px'
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    ctx.scale(ratio, ratio)
    ctx.lineWidth = 2.2
    ctx.lineCap = 'round'
    ctx.lineJoin = 'round'
    ctx.strokeStyle = '#111827'
  }, [height])

  useEffect(() => {
    setup()
    const onResize = () => {
      // 重设尺寸会清空画布,简单起见仅在无墨迹时跟随宽度
      if (!hasInk) setup()
    }
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [setup, hasInk])

  function pos(e: React.PointerEvent<HTMLCanvasElement>) {
    const canvas = canvasRef.current!
    const rect = canvas.getBoundingClientRect()
    return { x: e.clientX - rect.left, y: e.clientY - rect.top }
  }

  function start(e: React.PointerEvent<HTMLCanvasElement>) {
    e.preventDefault()
    drawing.current = true
    last.current = pos(e)
    canvasRef.current?.setPointerCapture(e.pointerId)
  }

  function move(e: React.PointerEvent<HTMLCanvasElement>) {
    if (!drawing.current) return
    e.preventDefault()
    const ctx = canvasRef.current?.getContext('2d')
    if (!ctx || !last.current) return
    const p = pos(e)
    ctx.beginPath()
    ctx.moveTo(last.current.x, last.current.y)
    ctx.lineTo(p.x, p.y)
    ctx.stroke()
    last.current = p
    if (!hasInk) setHasInk(true)
  }

  function end() {
    if (!drawing.current) return
    drawing.current = false
    last.current = null
    const canvas = canvasRef.current
    if (canvas && hasInk) onChange(canvas.toDataURL('image/png'))
  }

  function clear() {
    const canvas = canvasRef.current
    const ctx = canvas?.getContext('2d')
    if (canvas && ctx) {
      ctx.clearRect(0, 0, canvas.width, canvas.height)
    }
    setHasInk(false)
    onChange(null)
  }

  return (
    <div className="space-y-2">
      <div className="relative overflow-hidden rounded-lg border border-input bg-card">
        <canvas
          ref={canvasRef}
          onPointerDown={start}
          onPointerMove={move}
          onPointerUp={end}
          onPointerLeave={end}
          className="block w-full touch-none"
          style={{ height }}
          aria-label="手写签名区域"
        />
        {!hasInk && (
          <span className="pointer-events-none absolute inset-0 flex items-center justify-center text-sm text-muted-foreground">
            在此处手写签名
          </span>
        )}
      </div>
      <div className="flex justify-end">
        <Button type="button" variant="ghost" size="sm" onClick={clear} disabled={!hasInk}>
          <Eraser className="size-4" />
          清除重写
        </Button>
      </div>
    </div>
  )
}
