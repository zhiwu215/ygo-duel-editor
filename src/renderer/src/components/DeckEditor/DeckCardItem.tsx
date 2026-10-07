import { Tooltip, TooltipTrigger, TooltipContent } from '../ui/tooltip'
import React from 'react'
import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { CdbCard, DeckSection } from '@shared/index'
import { getCardImageUrl, CARD_BACK_IMAGE } from '../../utils/cardImage'
import { cn } from '../../lib/utils'
import { DeckDragSourceData } from './deckDnd'

interface DeckCardItemProps {
  code: number
  card?: CdbCard
  section: DeckSection
  index: number
  sortableId: string
  onSelect: (card: CdbCard | null) => void
  onRemove: (section: DeckSection, index: number) => void
}

export const DeckCardItem: React.FC<DeckCardItemProps> = ({
  code,
  card,
  section,
  index,
  sortableId,
  onSelect,
  onRemove
}) => {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: sortableId,
    data: { source: 'deck', section, index, code } as DeckDragSourceData
  })
  const imageUrl = getCardImageUrl(code, true)

  const handleMouseEnter = (): void => {
    if (card) {
      onSelect(card)
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
    onRemove(section, index)
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
              zIndex: isDragging ? 10 : undefined
            }}
            className={cn(
              'group relative aspect-[59/86] w-full rounded overflow-hidden cursor-grab active:cursor-grabbing select-none border border-border/40',
              'hover:border-primary/80 hover:shadow-md transition-[border-color,box-shadow] duration-150 bg-background/50',
              isDragging && 'z-10 opacity-0'
            )}
          >
            <img
              src={imageUrl}
              alt={card?.name || String(code)}
              loading="lazy"
              draggable={false}
              className="w-full h-full object-cover pointer-events-none"
              onError={(e) => {
                ;(e.currentTarget as HTMLImageElement).src = CARD_BACK_IMAGE
              }}
            />
          </div>
        }
      />
      <TooltipContent>
        {card ? `${card.name} (拖动调整，右键移出)` : `卡密: ${code} (拖动调整，右键移出)`}
      </TooltipContent>
    </Tooltip>
  )
}
