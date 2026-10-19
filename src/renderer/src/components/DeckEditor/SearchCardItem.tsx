import React from 'react'
import { useDraggable } from '@dnd-kit/core'
import { CdbCard, DeckSection } from '@shared/index'
import { CardRowItem } from '../CardSearch/CardRowItem'
import { DeckDragSourceData, deckDragGuard } from './deckDnd'
import { cn } from '../../lib/utils'

interface SearchCardItemProps {
  card: CdbCard
  fav: boolean
  onSelectCard: (card: CdbCard | null) => void
  onAddCard: (card: CdbCard, section?: DeckSection) => boolean
  onToggleFavorite: (code: number) => void
  onOpenMenu: (card: CdbCard, x: number, y: number) => void
}

export const SearchCardItem: React.FC<SearchCardItemProps> = ({
  card,
  fav,
  onSelectCard,
  onAddCard,
  onToggleFavorite,
  onOpenMenu
}) => {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: `search:${card.id}`,
    data: { source: 'search', card } as DeckDragSourceData
  })

  const handleClick = (): void => {
    if (Date.now() - deckDragGuard.lastDragEndAt < 250) return
    onAddCard(card)
  }

  const handleContextMenu = (e: React.MouseEvent): void => {
    e.preventDefault()
    onOpenMenu(card, e.clientX, e.clientY)
  }

  return (
    <div
      ref={setNodeRef}
      {...attributes}
      {...listeners}
      onClick={handleClick}
      onContextMenu={handleContextMenu}
      className={cn(isDragging && 'opacity-40')}
    >
      <CardRowItem
        card={card}
        isFavorite={fav}
        onToggleFavorite={onToggleFavorite}
        onHover={onSelectCard}
      />
    </div>
  )
}
