import React from 'react'
import { Loader2 } from 'lucide-react'
import { useBlockingTaskStore } from '../../../stores/useBlockingTaskStore'

export const BlockingTaskOverlay: React.FC = () => {
  const notice = useBlockingTaskStore((s) => s.notice)

  if (!notice) return null

  return (
    <div
      className="fixed inset-0 z-[110] flex items-center justify-center bg-black/35 backdrop-blur-[2px]"
      role="status"
      aria-live="polite"
    >
      <div className="flex items-center gap-3 rounded-xl border border-border bg-card px-5 py-4 shadow-2xl">
        <Loader2 className="h-5 w-5 animate-spin text-primary" />
        <div>
          <div className="text-sm font-semibold">{notice.title}</div>
          <div className="mt-0.5 text-[11px] text-muted-foreground">{notice.detail}</div>
        </div>
      </div>
    </div>
  )
}
