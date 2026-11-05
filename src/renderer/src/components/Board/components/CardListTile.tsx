import React from 'react'
import { CardThumb } from '../../ui/CardThumb'
import { CardLocationLabel } from './CardLocationLabel'
import { cn } from '../../../lib/utils'
import { cardLocationLabel } from '../../../utils/cardLocationLabel'

interface CardListTileProps {
  code?: number
  name: string
  location: number
  sequence: number
  selected?: boolean
  interactive?: boolean
  overlay?: React.ReactNode
}

export const CardListTile: React.FC<CardListTileProps> = ({
  code,
  name,
  location,
  sequence,
  selected = false,
  interactive = false,
  overlay
}) => (
  <div className="flex w-full min-w-0 flex-col">
    <CardLocationLabel
      label={cardLocationLabel(location, sequence)}
      selected={selected}
      interactive={interactive}
    />
    <div
      className={cn(
        'relative aspect-[59/86] w-full overflow-hidden rounded-sm bg-black/30 transition-shadow',
        selected
          ? 'ring-2 ring-amber-400'
          : interactive
            ? 'ring-1 ring-foreground/10 group-hover:ring-2 group-hover:ring-amber-300/80'
            : 'ring-1 ring-foreground/10'
      )}
    >
      <CardThumb
        code={code}
        name={name}
        imageClassName="pointer-events-none"
        className="h-full w-full"
      />
      {overlay}
    </div>
    <span className="mt-1 line-clamp-2 h-[26px] w-full px-0.5 break-words text-center text-[10px] font-medium leading-[13px] text-foreground">
      {name}
    </span>
  </div>
)
