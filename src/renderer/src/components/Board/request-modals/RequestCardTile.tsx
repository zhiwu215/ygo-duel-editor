import React from 'react'
import { CdbCard } from '@shared/index'
import type { RequestCard } from '@shared/engine/protocol'
import { cn } from '../../../lib/utils'
import { CardListTile } from '../components/CardListTile'
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
      <CardListTile
        code={card.code}
        name={name}
        location={card.location}
        sequence={card.sequence}
        selected={selected}
        interactive={interactive}
        overlay={
          badge ? (
            <span className="absolute left-1 top-1 rounded bg-black/70 px-1 py-0.5 text-[9px] font-bold text-white">
              {badge}
            </span>
          ) : null
        }
      />
    </button>
  )
}
