import { Tooltip, TooltipTrigger, TooltipContent } from '../ui/tooltip'
import React from 'react'
import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { CdbCard, DeckSection } from '@shared/index'
import { getCardImageUrl, UNKNOWN_CARD_IMAGE } from '../../utils/cardImage'
import { cn } from '../../lib/utils'
import { DeckDragSourceData } from './deckDnd'

interface DeckCardItemProps {
  code: number
  card?: CdbCard
  section: DeckSection
  index: number
  sortableId: string
  isCover: boolean
  /** 刚被加入 / 移动到此位置的卡片，短暂高亮一次作为落位反馈 */
  isFlash: boolean
  onSelect: (card: CdbCard | null) => void
  onHover: (code: number | null) => void
  onOpenMenu: (code: number, x: number, y: number) => void
}

const DeckCardItemBase: React.FC<DeckCardItemProps> = ({
  code,
  card,
  section,
  index,
  sortableId,
  isCover,
  isFlash,
  onSelect,
  onHover,
  onOpenMenu
}) => {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: sortableId,
    data: { source: 'deck', section, index, code } as DeckDragSourceData,
    transition: { duration: 160, easing: 'cubic-bezier(0.2, 0, 0, 1)' }
  })
  const imageUrl = getCardImageUrl(code, true)

  /** 对齐 YGOPro：hovered_code 只在新卡进入时更新，移开鼠标保留上一张，左侧详情不回退不闪烁 */
  const handleMouseEnter = (): void => {
    if (card) {
      onHover(code)
    }
  }

  const handleClick = (e: React.MouseEvent): void => {
    e.stopPropagation()
    if (card) {
      onSelect(card)
    }
  }

  const handleContextMenu = (e: React.MouseEvent): void => {
    e.preventDefault()
    e.stopPropagation()
    onOpenMenu(code, e.clientX, e.clientY)
  }

  return (
    <Tooltip>
      <TooltipTrigger
        render={
          <div
            ref={setNodeRef}
            {...attributes}
            {...listeners}
            onClick={handleClick}
            onMouseEnter={handleMouseEnter}
            onContextMenu={handleContextMenu}

            style={{
              transform: CSS.Transform.toString(transform),
              transition,
              zIndex: isDragging ? 10 : undefined,
              willChange: isDragging ? 'transform' : undefined
            }}
            className={cn(
              'group relative aspect-[59/86] w-full rounded overflow-hidden cursor-grab active:cursor-grabbing select-none border border-border/40',
              'hover:border-primary/80 hover:shadow-md transition-[border-color,box-shadow] duration-150 bg-background/50',
              isDragging && 'opacity-30',
              isFlash && 'ring-2 ring-primary shadow-md shadow-primary/30'
            )}
          >
            <img
              src={imageUrl}
              alt={card?.name || String(code)}
              loading="lazy"
              draggable={false}
              className="w-full h-full object-cover pointer-events-none"
              onError={(e) => {
                ;(e.currentTarget as HTMLImageElement).src = UNKNOWN_CARD_IMAGE
              }}
            />
            {isCover && (
              <div className="absolute top-0 left-0 right-0 bg-purple-950/85 text-purple-300 text-[9px] font-bold py-px text-center pointer-events-none">
                封面
              </div>
            )}
          </div>
        }
      />
      <TooltipContent>
        {card ? `${card.name} (拖动调整，右键更多)` : `卡密: ${code} (拖动调整，右键更多)`}
      </TooltipContent>
    </Tooltip>
  )
}

export const DeckCardItem = React.memo(DeckCardItemBase)
