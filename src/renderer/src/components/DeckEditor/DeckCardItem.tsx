import React from 'react'
import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { CdbCard } from '@shared/index'
import { getCardImageUrl, CARD_BACK_IMAGE } from '../../utils/cardImage'
import { cn } from '../../lib/utils'

interface DeckCardItemProps {
  code: number
  card?: CdbCard
  section: 'main' | 'extra' | 'side'
  index: number
  sortableId: string
  isDragActive: boolean
  isDragging: boolean
  onSelect: (card: CdbCard | null) => void
  onRemove: (section: 'main' | 'extra' | 'side', index: number) => void
}

export const DeckCardItem: React.FC<DeckCardItemProps> = ({
  code,
  card,
  section,
  index,
  sortableId,
  isDragActive,
  isDragging,
  onSelect,
  onRemove
}) => {
  const { attributes, listeners, setNodeRef, transform, transition } = useSortable({
    id: sortableId
  })
  const imageUrl = getCardImageUrl(code, true)

  const handleMouseEnter = (): void => {
    if (card && !isDragActive) {
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
    <div
      ref={setNodeRef}
      {...attributes}
      {...listeners}
      onClick={handleClick}
      onMouseEnter={handleMouseEnter}
      onContextMenu={handleContextMenu}
      title={card ? `${card.name} (拖动排序，右键移除)` : `卡密: ${code} (拖动排序，右键移除)`}
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
  )
}
