import React from 'react'
import { useDraggable } from '@dnd-kit/core'
import { CdbCard, CardPoolSchema, DeckSection } from '@shared/index'
import { CardRowItem } from '../CardSearch/CardRowItem'
import { DeckDragSourceData } from './deckDnd'
import { cn } from '../../lib/utils'

interface SearchCardItemProps {
  card: CdbCard
  cardPool?: string
  poolSchema?: CardPoolSchema
  fav: boolean
  onSelectCard: (card: CdbCard | null) => void
  onAddCard: (card: CdbCard, section?: DeckSection) => boolean
  onToggleFavorite: (code: number) => void
}

export const SearchCardItem: React.FC<SearchCardItemProps> = ({
  card,
  cardPool,
  poolSchema,
  fav,
  onSelectCard,
  onAddCard,
  onToggleFavorite
}) => {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: `search:${card.id}`,
    data: { source: 'search', card } as DeckDragSourceData
  })

  const handleContextMenu = (e: React.MouseEvent): void => {
    e.preventDefault()
    onAddCard(card)
  }

  return (
    <div
      ref={setNodeRef}
      {...attributes}
      {...listeners}
      onContextMenu={handleContextMenu}
      className={cn(isDragging && 'opacity-40')}
    >
      <CardRowItem
        card={card}
        cardPool={cardPool}
        poolSchema={poolSchema}
        isFavorite={fav}
        onToggleFavorite={onToggleFavorite}
        onHover={onSelectCard}
      />
    </div>
  )
}
