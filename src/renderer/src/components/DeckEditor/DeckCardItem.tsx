import React from 'react'
import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { CdbCard, DeckSection } from '@shared/index'
import { CardImage } from '../ui/CardImage'
import { resolveCardName } from '../../utils/cardNames'
import { cn } from '../../lib/utils'
import { DeckDragSourceData } from './deckDnd'
import { SORTABLE_TRANSITION } from '../../utils/dnd'

interface DeckCardItemProps {
  code: number
  card?: CdbCard
  section: DeckSection
  index: number
  sortableId: string
  isFlash: boolean
  onSelect: (card: CdbCard) => void
  onRemove: (section: DeckSection, index: number) => void
}

const DeckCardItemBase: React.FC<DeckCardItemProps> = ({
  code,
  card,
  section,
  index,
  sortableId,
  isFlash,
  onSelect,
  onRemove
}) => {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: sortableId,
    data: { source: 'deck', section, index, code } as DeckDragSourceData,
    transition: SORTABLE_TRANSITION
  })

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
      <CardImage
        code={code}
        small
        alt={card?.name || resolveCardName(code)}
        loading="lazy"
        draggable={false}
        className="w-full h-full object-cover pointer-events-none"
      />
    </div>
  )
}

export const DeckCardItem = React.memo(DeckCardItemBase)
