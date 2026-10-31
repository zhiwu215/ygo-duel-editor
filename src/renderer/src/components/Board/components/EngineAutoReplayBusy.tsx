import React from 'react'
import { Loader2 } from 'lucide-react'
import { useDuelEngineStore } from '../../../stores/useDuelEngineStore'

export const EngineAutoReplayBusy: React.FC = () => {
  const busy = useDuelEngineStore((s) => s.autoReplayBusy)

  if (!busy) return null

  return (
    <div
      role="status"
      className="fixed inset-0 z-[120] flex items-center justify-center bg-background/85 backdrop-blur-sm"
    >
      <div className="flex flex-col items-center gap-3 rounded-xl border border-border bg-popover px-8 py-6 shadow-2xl">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
        <div className="text-sm font-medium text-popover-foreground">正在自动重打…</div>
        <div className="text-xs text-muted-foreground">
          正在用注入后的初始场面重演对局，完成后继续导出。
        </div>
      </div>
    </div>
  )
}
