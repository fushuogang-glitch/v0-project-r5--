'use client'

import { useEffect } from 'react'
import { Printer } from 'lucide-react'

export function PrintTrigger() {
  useEffect(() => {
    const t = setTimeout(() => window.print(), 600)
    return () => clearTimeout(t)
  }, [])

  return (
    <button
      onClick={() => window.print()}
      className="fixed right-4 top-4 z-50 inline-flex items-center gap-1.5 rounded-md bg-rose-600 px-3 py-2 text-sm font-medium text-white shadow-lg print:hidden"
    >
      <Printer className="size-4" />
      打印 / 另存为 PDF
    </button>
  )
}
