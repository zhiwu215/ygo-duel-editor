import React from 'react'
import { CardLocation, CardPosition, FieldCard } from '@shared/index'
import { CardImage } from '../../ui/CardImage'
import { Hand, Trash2 } from 'lucide-react'
import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { cn } from '../../../lib/utils'
import { SORTABLE_TRANSITION } from '../../../utils/dnd'

interface PileCardTileProps {
  card: FieldCard
  cardName: string
  index: number
  location: number
  isSelected: boolean
  dragDisabled: boolean
  onSelect: (card: FieldCard) => void
  onHoverChange: (card: FieldCard, hovering: boolean) => void
  onTogglePosition: (card: FieldCard) => void
  onHold: (card: FieldCard, point: { x: number; y: number }) => void
  holdEnabled: boolean
  onRemove: (card: FieldCard) => void
}

const PileCardTileBase: React.FC<PileCardTileProps> = ({
  card,
  cardName,
  index,
  location,
  isSelected,
  dragDisabled,
  onSelect,
  onHoverChange,
  onTogglePosition,
  onHold,
  holdEnabled,
  onRemove
}) => {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: card.instanceId,
    disabled: dragDisabled,
    transition: SORTABLE_TRANSITION
  })

  return (
    <div
      ref={setNodeRef}
      style={{
        transform: CSS.Transform.toString(transform),
        transition,
        zIndex: isDragging ? 10 : undefined,
        willChange: isDragging ? 'transform' : undefined
      }}
      {...attributes}
      {...listeners}
      onClick={() => onSelect(card)}
      onMouseEnter={() => onHoverChange(card, true)}
      onMouseLeave={() => onHoverChange(card, false)}
      className={cn(
        'group relative rounded overflow-hidden select-none',
        dragDisabled ? 'cursor-default' : 'cursor-grab active:cursor-grabbing touch-none',
        isDragging ? 'opacity-30' : '',
        isSelected ? 'ring-2 ring-blue-500' : 'hover:ring-2 hover:ring-blue-500/70'
      )}
    >
      <div className="relative w-full aspect-[59/86] bg-black/30">
        <CardImage
          code={card.code}
          small
          alt={cardName}
          className="w-full h-full object-cover pointer-events-none"
        />

        <span className="absolute left-1 top-1 px-1 rounded bg-black/65 text-white/90 font-mono text-[9px] leading-[14px] pointer-events-none">
          #{index + 1}
        </span>

        {location === CardLocation.DECK && index === 0 && (
          <span className="absolute right-1 top-1 px-1 rounded border border-amber-500/50 bg-amber-500/85 text-black font-sans text-[9px] font-bold leading-[14px] pointer-events-none">
            下一抽
          </span>
        )}

        {location === CardLocation.EXTRA && (
          <span className="absolute right-1 top-1 inline-flex">
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation()
                onTogglePosition(card)
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
          </span>
        )}

        <div className="absolute inset-x-0 bottom-0 flex items-center justify-center gap-1 p-1 opacity-0 group-hover:opacity-100 transition-opacity bg-linear-to-t from-black/80 via-black/40 to-transparent">
          {holdEnabled && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation()
                onHold(card, { x: e.clientX, y: e.clientY })
              }}
              className="p-1 rounded text-white/85 hover:text-white hover:bg-white/15 transition-colors cursor-pointer"
            >
              <Hand className="w-3.5 h-3.5" />
            </button>
          )}
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation()
              onRemove(card)
            }}
            className="p-1 rounded text-white/85 hover:text-rose-300 hover:bg-white/15 transition-colors cursor-pointer"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </div>
  )
}

export const PileCardTile = React.memo(PileCardTileBase)
