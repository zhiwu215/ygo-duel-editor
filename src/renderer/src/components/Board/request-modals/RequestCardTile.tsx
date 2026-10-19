import React from 'react'
import { Check } from 'lucide-react'
import { CdbCard, LOCATION_NAMES } from '@shared/index'
import type { RequestCard } from '@shared/engine/protocol'
import { getCardImageUrl, UNKNOWN_CARD_IMAGE } from '../../../utils/cardImage'
import { cn } from '../../../lib/utils'
import { cardNameOf } from './useCardMeta'

interface RequestCardTileProps {
  card: RequestCard
  meta: Record<number, CdbCard>
  selected?: boolean
  disabled?: boolean
  badge?: string
  onClick?: () => void
}

export const RequestCardTile: React.FC<RequestCardTileProps> = ({
  card,
  meta,
  selected = false,
  disabled = false,
  badge,
  onClick
}) => {
  const name = cardNameOf(meta, card.code)
  const locationName = LOCATION_NAMES[card.location]
  return (
    <button
      type="button"
      disabled={disabled}
      aria-pressed={selected}
      title={name}
      onClick={onClick}
      className={cn(
        'group flex w-[86px] shrink-0 flex-col items-center gap-1 rounded-lg border bg-background/60 p-1.5 text-center transition-all',
        onClick ? 'cursor-pointer' : 'cursor-default',
        selected
          ? 'border-primary ring-2 ring-primary/50 shadow-md'
          : 'border-border/70 hover:border-primary/60 hover:shadow-md',
        disabled && 'pointer-events-none opacity-60'
      )}
    >
      <div className="relative h-[112px] w-[80px] overflow-hidden rounded border border-border/60 bg-black/30">
        <img
          src={getCardImageUrl(card.code, true)}
          alt={name}
          className="h-full w-full object-cover pointer-events-none"
          onError={(e) => {
            if (e.currentTarget.src !== UNKNOWN_CARD_IMAGE) {
              e.currentTarget.src = UNKNOWN_CARD_IMAGE
            }
          }}
        />
        {selected && (
          <div className="absolute inset-0 flex items-center justify-center bg-primary/25">
            <Check className="h-6 w-6 text-primary-foreground drop-shadow" />
          </div>
        )}
        {badge && (
          <span className="absolute left-1 top-1 rounded bg-black/70 px-1 py-0.5 text-[9px] font-bold text-white">
            {badge}
          </span>
        )}
      </div>
      <span className="w-full truncate text-[10px] leading-tight text-foreground/90">{name}</span>
      {locationName && (
        <span className="w-full truncate text-[9px] leading-none text-muted-foreground">
          {locationName}
        </span>
      )}
    </button>
  )
}
