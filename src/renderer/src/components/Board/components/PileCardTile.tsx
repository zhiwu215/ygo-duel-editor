import React from 'react'
import { motion } from 'framer-motion'
import { CardLocation, CardPosition, FieldCard } from '@shared/index'
import { Tooltip, TooltipTrigger, TooltipContent } from '../../ui/tooltip'
import { CardImage } from '../../ui/CardImage'
import { MoreHorizontal, Trash2 } from 'lucide-react'
import { cn } from '../../../lib/utils'

interface PileCardTileProps {
  card: FieldCard
  cardName: string
  originalIndex: number
  remainingIndex: number
  location: number
  isSelected: boolean
  isBeingDragged: boolean
  onPointerDown: (e: React.PointerEvent<HTMLDivElement>) => void
  onContextMenu: (e: React.MouseEvent<HTMLDivElement>) => void
  onMouseEnter: () => void
  onMouseLeave: () => void
  onTogglePosition: () => void
  onOpenMenu: (e: React.MouseEvent<HTMLButtonElement>) => void
  onRemove: () => void
}

export const PileCardTile: React.FC<PileCardTileProps> = ({
  card,
  cardName,
  originalIndex,
  remainingIndex,
  location,
  isSelected,
  isBeingDragged,
  onPointerDown,
  onContextMenu,
  onMouseEnter,
  onMouseLeave,
  onTogglePosition,
  onOpenMenu,
  onRemove
}) => {
  return (
    <motion.div
      layout="position"
      transition={{
        layout: {
          type: 'spring',
          stiffness: 300,
          damping: 30
        }
      }}
      data-remaining-index={remainingIndex}
      className={cn('h-full', isBeingDragged && 'opacity-0 pointer-events-none')}
    >
      <div
        title={cardName}
        onDragStart={(e) => {
          e.preventDefault()
        }}
        onPointerDown={onPointerDown}
        onContextMenu={onContextMenu}
        className={cn(
          'group relative flex flex-col rounded-md border bg-card p-1.5 shadow-sm transition-colors select-none cursor-grab active:cursor-grabbing',
          isSelected
            ? 'border-blue-500 ring-1 ring-blue-500/50'
            : 'border-border/80 hover:border-blue-500/70 hover:shadow-md'
        )}
        onMouseEnter={onMouseEnter}
        onMouseLeave={onMouseLeave}
      >
        <div className="relative w-full aspect-[59/86] rounded overflow-hidden border border-border/70 bg-black/30">
          <CardImage
            code={card.code}
            small
            alt={cardName}
            className="w-full h-full object-cover pointer-events-none"
          />

          <span className="absolute left-1 top-1 px-1 rounded bg-black/65 text-white/90 font-mono text-[9px] leading-[14px] pointer-events-none">
            #{originalIndex + 1}
          </span>

          {location === CardLocation.DECK && originalIndex === 0 && (
            <span className="absolute right-1 top-1 px-1 rounded border border-amber-500/50 bg-amber-500/85 text-black font-sans text-[9px] font-bold leading-[14px] pointer-events-none">
              下一抽
            </span>
          )}

          {location === CardLocation.EXTRA && (
            <span className="absolute right-1 top-1 inline-flex">
              <Tooltip>
                <TooltipTrigger
                  render={
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation()
                        onTogglePosition()
                      }}
                      className={cn(
                        'px-1 rounded font-sans text-[9px] leading-[14px] border transition-colors cursor-pointer',
                        card.position === CardPosition.FACEUP
                          ? 'bg-cyan-500/85 text-black border-cyan-500/50 font-bold'
                          : 'bg-black/65 text-white/85 border-white/25 hover:text-white'
                      )}
                    >
                      {card.position === CardPosition.FACEUP ? '表侧' : '里侧'}
                    </button>
                  }
                />
                <TooltipContent>点击切换 表侧 / 里侧 表示形式</TooltipContent>
              </Tooltip>
            </span>
          )}

          <div className="absolute inset-x-0 bottom-0 flex items-center justify-center gap-1 p-1 opacity-0 group-hover:opacity-100 transition-opacity bg-linear-to-t from-black/80 via-black/40 to-transparent">
            <Tooltip>
              <TooltipTrigger
                render={
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation()
                      onOpenMenu(e)
                    }}
                    className="p-1 rounded text-white/85 hover:text-white hover:bg-white/15 transition-colors cursor-pointer"
                  >
                    <MoreHorizontal className="w-3.5 h-3.5" />
                  </button>
                }
              />
              <TooltipContent>更多操作 (手牌/墓地/除外/回卡组，也可右键卡片)</TooltipContent>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger
                render={
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation()
                      onRemove()
                    }}
                    className="p-1 rounded text-white/85 hover:text-rose-300 hover:bg-white/15 transition-colors cursor-pointer"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                }
              />
              <TooltipContent>从决斗中移除</TooltipContent>
            </Tooltip>
          </div>
        </div>

        <span className="mt-1 min-h-[26px] px-0.5 text-[10.5px] leading-[13px] text-center text-foreground/85 line-clamp-2 break-all">
          {cardName}
        </span>
      </div>
    </motion.div>
  )
}
