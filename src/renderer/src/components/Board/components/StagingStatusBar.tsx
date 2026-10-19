import React from 'react'
import { Zap } from 'lucide-react'
import { useStagingStore } from '../../../stores/useStagingStore'
import { Button } from '../../ui/button'

export const StagingStatusBar: React.FC = () => {
  const session = useStagingStore((s) => s.session)
  const complete = useStagingStore((s) => s.complete)

  if (!session) return null

  return (
    <div className="absolute bottom-2 left-1/2 -translate-x-1/2 z-40 flex items-center gap-2 rounded-lg border border-amber-400/60 bg-popover px-2.5 py-1.5 text-xs shadow-lg select-none">
      <Zap className="h-3.5 w-3.5 shrink-0 text-amber-400" />
      <span className="shrink-0 font-medium">发动效果【{session.cardName}】</span>
      {session.description && (
        <span className="max-w-64 truncate text-muted-foreground">{session.description}</span>
      )}
      <Button
        variant="default"
        size="sm"
        className="h-6 shrink-0 px-2.5 text-[11px] font-bold cursor-pointer"
        onClick={complete}
      >
        ✓ 完成
      </Button>
    </div>
  )
}
