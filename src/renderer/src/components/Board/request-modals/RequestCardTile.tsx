import React from 'react'
import { Check } from 'lucide-react'
import { CdbCard } from '@shared/index'
import type { RequestCard } from '@shared/engine/protocol'
import { CardThumb } from '../../ui/CardThumb'
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
  const name = card.code > 0 ? cardNameOf(meta, card.code) : '未知卡片'
  return (
    <button
      type="button"
      disabled={disabled}
      aria-pressed={selected}
      onClick={onClick}
      className={cn(
        'group flex w-[86px] shrink-0 flex-col',
        onClick ? 'cursor-pointer' : 'cursor-default',
        disabled && 'pointer-events-none opacity-60'
      )}
    >
      <div
        className={cn(
          'relative aspect-[59/86] w-full overflow-hidden rounded-sm bg-black/30 transition-shadow',
          selected ? 'ring-2 ring-primary' : 'group-hover:ring-2 group-hover:ring-primary/70'
        )}
      >
        <CardThumb
          code={card.code}
          name={name}
          imageClassName="pointer-events-none"
          className="h-full w-full"
        />
        {selected && (
          <div className="absolute inset-0 flex items-center justify-center bg-foreground/25">
            <Check className="h-6 w-6 text-background" />
          </div>
        )}
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
