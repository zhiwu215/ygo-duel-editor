import type { JSX } from 'react'
import { ArrowDownToLine, Loader2, RotateCcw } from 'lucide-react'
import { useUpdateStore } from '../../../stores/useUpdateStore'
import { Button } from '../../ui/button'

export function UpdateIndicator(): JSX.Element | null {
  const phase = useUpdateStore((s) => s.state.phase)
  const progress = useUpdateStore((s) => s.state.progress)
  const openDialog = useUpdateStore((s) => s.openDialog)

  if (phase === 'available') {
    return (
      <Button
        size="xs"
        variant="outline"
        onClick={openDialog}
        className="h-7 px-2 text-[11px] font-bold gap-1 bg-primary/10 text-primary border-primary/40 hover:bg-primary/15"
      >
        <ArrowDownToLine className="w-3.5 h-3.5" />
        <span>有新版本</span>
      </Button>
    )
  }

  if (phase === 'downloading') {
    return (
      <Button
        size="xs"
        variant="outline"
        onClick={openDialog}
        className="h-7 px-2 text-[11px] font-bold gap-1 bg-background/60 text-muted-foreground border-border"
      >
        <Loader2 className="w-3.5 h-3.5 animate-spin" />
        <span>{Math.round(progress?.percent ?? 0)}%</span>
      </Button>
    )
  }

  if (phase === 'ready') {
    return (
      <Button
        size="xs"
        variant="outline"
        onClick={openDialog}
        className="h-7 px-2 text-[11px] font-bold gap-1 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/30 hover:bg-emerald-500/20"
      >
        <RotateCcw className="w-3.5 h-3.5" />
        <span>重启更新</span>
      </Button>
    )
  }

  return null
}
