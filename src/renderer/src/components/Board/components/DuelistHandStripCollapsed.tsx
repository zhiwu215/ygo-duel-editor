import { Tooltip, TooltipTrigger, TooltipContent } from '../../ui/tooltip'
import React from 'react'
import { Crown } from 'lucide-react'
import { Duelist, FieldCard } from '@shared/index'
import { cn } from '../../../lib/utils'
import { turnOrderOf } from '../../../utils/duelistNames'

interface DuelistHandStripCollapsedProps {
  duelist: Duelist
  cards: FieldCard[]
  isOpponent: boolean
  isActiveViewer: boolean
  isDragOver: boolean
  ref?: React.Ref<HTMLDivElement>
  onFocus: () => void
  onExpand: () => void
  onDragEnter: (e: React.DragEvent) => void
  onDragLeave: (e: React.DragEvent<HTMLDivElement>) => void
  onDragOver: (e: React.DragEvent<HTMLDivElement>) => void
  onDrop: (e: React.DragEvent) => void
}

export const DuelistHandStripCollapsed: React.FC<DuelistHandStripCollapsedProps> = ({
  duelist,
  cards,
  isOpponent,
  isActiveViewer,
  isDragOver,
  ref,
  onFocus,
  onExpand,
  onDragEnter,
  onDragLeave,
  onDragOver,
  onDrop
}) => {
  const currentOrder = turnOrderOf(duelist)
  const isFirst = currentOrder === 1
  return (
    <Tooltip>
      <TooltipTrigger
        render={
          <div
            ref={ref}
            onClick={() => {
              onFocus()
              onExpand()
            }}
            onDragEnter={onDragEnter}
            onDragLeave={onDragLeave}
            onDragOver={onDragOver}
            onDrop={onDrop}

            className={cn(
              'w-9 shrink-0 h-[136px] rounded border-2 transition-all cursor-pointer select-none flex flex-col items-center justify-between py-1 px-0.5',
              isActiveViewer && 'ring-2 ring-primary ring-offset-1 ring-offset-background',
              isDragOver
                ? isOpponent
                  ? 'border-red-500 ring-2 ring-red-500/30 bg-red-500/10'
                  : 'border-blue-500 ring-2 ring-blue-500/30 bg-blue-500/10'
                : isOpponent
                  ? 'border-red-500/30 bg-red-500/5 hover:bg-red-500/15 hover:border-red-500/50'
                  : 'border-blue-500/30 bg-blue-500/5 hover:bg-blue-500/15 hover:border-blue-500/50'
            )}
          >
            <div className="flex flex-col items-center gap-0.5">
              <span
                className={cn(
                  'w-2 h-2 rounded-full shrink-0',
                  isOpponent ? 'bg-red-500' : 'bg-blue-500'
                )}
              />
              {isFirst ? (
                <Crown className="w-3 h-3 text-amber-500 shrink-0" />
              ) : (
                <span className="text-[9px] font-mono font-bold text-muted-foreground">
                  #{currentOrder}
                </span>
              )}
            </div>

            <span
              className={cn(
                'text-[10px] font-semibold tracking-wider text-center leading-tight line-clamp-3 my-auto',
                isOpponent ? 'text-red-400' : 'text-blue-400'
              )}
              style={{ writingMode: 'vertical-rl' }}
            >
              {duelist.name}
            </span>

            <span
              className={cn(
                'text-[9px] font-mono font-bold px-1 py-0.5 rounded-full shrink-0',
                cards.length > 0
                  ? 'bg-muted-foreground/20 text-foreground'
                  : 'text-muted-foreground/60'
              )}
            >
              {cards.length}
            </span>
          </div>
        }
      />
      <TooltipContent>{`点击展开 ${duelist.name} 的全部手牌（${cards.length} 张，行动顺位：第 ${currentOrder} 位）`}</TooltipContent>
    </Tooltip>
  )
}
