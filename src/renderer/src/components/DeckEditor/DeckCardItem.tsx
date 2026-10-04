import React from 'react'
import { CdbCard } from '@shared/index'
import { getCardImageUrl, CARD_BACK_IMAGE } from '../../utils/cardImage'
import { cn } from '../../lib/utils'

interface DeckCardItemProps {
  code: number
  card?: CdbCard
  section: 'main' | 'extra' | 'side'
  index: number
  onSelect: (card: CdbCard | null) => void
  onRemove: (section: 'main' | 'extra' | 'side', index: number) => void
}

export const DeckCardItem: React.FC<DeckCardItemProps> = ({
  code,
  card,
  section,
  index,
  onSelect,
  onRemove
}) => {
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
    <div
      onClick={handleClick}
      onMouseEnter={handleMouseEnter}
      onContextMenu={handleContextMenu}
      title={card ? `${card.name} (右键移除)` : `卡密: ${code} (右键移除)`}
      className={cn(
        'group relative aspect-[59/86] w-full rounded overflow-hidden cursor-pointer select-none border border-border/40',
        'hover:border-primary/80 hover:shadow-md hover:scale-[1.03] transition-all duration-150 bg-background/50'
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
