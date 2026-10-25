import React from 'react'
import { Check, Clapperboard } from 'lucide-react'
import { cn } from '../../lib/utils'

interface SceneEntryProps {
  active: boolean
  available: boolean
  editing: boolean
  engine: boolean
  onSelect: () => void
}

export const SceneEntry: React.FC<SceneEntryProps> = ({
  active,
  available,
  editing,
  engine,
  onSelect
}) => {
  const subtitle = editing
    ? '摆卡不会记录步骤 · 点击完成布景'
    : engine
      ? '引擎起点 · 退出引擎后可编辑布景'
      : active
        ? '第一个操作开始前的场面'
        : available
          ? '点击进入布景编辑'
          : '当前台本没有记录初始场面'

  return (
    <button
      type="button"
      disabled={!available}
      onClick={onSelect}
      className={cn(
        'group flex w-full select-none items-center gap-2 rounded-lg border px-2.5 py-2 text-left outline-none transition-all focus-visible:ring-2 focus-visible:ring-ring/30',
        editing
          ? 'border-amber-500/60 bg-amber-500/[0.08] ring-1 ring-amber-500/20'
          : active
            ? 'border-primary/60 bg-primary/[0.08] ring-1 ring-primary/20'
            : 'border-dashed border-border/70 bg-card/40 hover:border-primary/50 hover:bg-muted/40',
        !available && 'cursor-not-allowed opacity-55 hover:border-border/70 hover:bg-card/40'
      )}
    >
      <span
        className={cn(
          'flex h-8 w-8 shrink-0 items-center justify-center rounded-md border',
          editing
            ? 'border-amber-500/40 bg-amber-500/10 text-amber-600 dark:text-amber-400'
            : active
              ? 'border-primary/40 bg-primary/10 text-primary'
              : 'border-border/70 bg-muted/40 text-muted-foreground'
        )}
      >
        <Clapperboard className="h-4 w-4" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="flex items-center gap-1.5">
          <span className="text-[12px] font-extrabold text-foreground">布景</span>
          {editing ? (
            <span className="rounded-full border border-amber-500/40 bg-amber-500/10 px-1.5 py-0.5 text-[8px] font-bold leading-none text-amber-600 dark:text-amber-400">
              编辑中
            </span>
          ) : (
            active && (
              <span className="rounded-full border border-primary/40 bg-primary/10 px-1.5 py-0.5 text-[8px] font-bold leading-none text-primary">
                当前
              </span>
            )
          )}
        </span>
        <span className="mt-0.5 block truncate text-[10px] text-muted-foreground">{subtitle}</span>
      </span>
      {editing && <Check className="h-3.5 w-3.5 shrink-0 text-amber-600 dark:text-amber-400" />}
    </button>
  )
}
