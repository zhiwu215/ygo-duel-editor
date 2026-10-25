import React from 'react'
import { useDuelEngineStore } from '../../../stores/useDuelEngineStore'

export const EngineCardEditBusy: React.FC = () => {
  const busy = useDuelEngineStore((s) => s.cardEditLoading)

  if (!busy) return null

  return (
    <div
      role="status"
      className="fixed left-1/2 top-16 z-[90] -translate-x-1/2 rounded-lg border border-border bg-popover/95 px-4 py-2 text-xs text-popover-foreground shadow-2xl backdrop-blur-md"
    >
      正在重演到当前步骤…
    </div>
  )
}
