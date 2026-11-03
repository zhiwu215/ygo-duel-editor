import React from 'react'
import { CdbCard } from '@shared/index'
import type { RequestCard } from '@shared/engine/protocol'
import { CardThumb } from '../../ui/CardThumb'
import { CardLocationLabel } from '../components/CardLocationLabel'
import { cn } from '../../../lib/utils'
import { cardLocationLabel } from '../../../utils/cardLocationLabel'
import { cardNameOf } from './useCardMeta'

interface RequestCardTileProps {
  card: RequestCard
  meta: Record<number, CdbCard>
  selected?: boolean
  disabled?: boolean
  badge?: string
  onClick?: () => void
}

export const REQUEST_CARD_GRID_CLASS =
  'mx-auto flex w-full max-w-[720px] flex-wrap justify-center gap-x-5 gap-y-3'

export const RequestCardTile: React.FC<RequestCardTileProps> = ({
  card,
  meta,
  selected = false,
  disabled = false,
  badge,
  onClick
}) => {
  const name = card.code > 0 ? cardNameOf(meta, card.code) : '未知卡片'
  const interactive = Boolean(onClick) && !disabled
  return (
    <button
      type="button"
      disabled={disabled}
      aria-pressed={selected}
      onClick={onClick}
      className={cn(
        'group flex w-[128px] shrink-0 flex-col text-left',
        onClick ? 'cursor-pointer' : 'cursor-default',
        disabled && 'pointer-events-none opacity-60'
      )}
    >
      <CardLocationLabel
        label={cardLocationLabel(card.location, card.sequence)}
        selected={selected}
        interactive={interactive}
      />
      <div
        className={cn(
          'relative aspect-[59/86] w-full overflow-hidden rounded-sm bg-black/30 transition-shadow',
          selected
            ? 'ring-2 ring-amber-400 ring-offset-1 ring-offset-background'
            : interactive
              ? 'ring-1 ring-foreground/10 group-hover:ring-2 group-hover:ring-amber-300/80'
              : 'ring-1 ring-foreground/10'
        )}
      >
        <CardThumb
          code={card.code}
          name={name}
          imageClassName="pointer-events-none"
          className="h-full w-full"
        />
        {badge && (
          <span className="absolute left-1 top-1 rounded bg-black/70 px-1 py-0.5 text-[9px] font-bold text-white">
            {badge}
          </span>
        )}
      </div>
      <span className="mt-1 line-clamp-2 h-[26px] w-full px-0.5 break-words text-center text-[10px] font-medium leading-[13px] text-foreground">
        {name}
      </span>
    </button>
  )
}
