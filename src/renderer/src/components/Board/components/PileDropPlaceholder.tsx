import React from 'react'
import { CdbCard } from '@shared/index'
import { CardThumb } from '../../ui/CardThumb'

interface PileDropPlaceholderProps {
  card: CdbCard | null
  onDragOver: (event: React.DragEvent<HTMLDivElement>) => void
  onDrop: (event: React.DragEvent<HTMLDivElement>) => void
}

export const PileDropPlaceholder: React.FC<PileDropPlaceholderProps> = ({
  card,
  onDragOver,
  onDrop
}) => (
  <div
    onDragOver={onDragOver}
    onDrop={onDrop}
    className="group relative flex w-full min-w-0 select-none flex-col"
  >
    <span className="mb-1 h-5 w-full rounded-[3px] bg-blue-500/10" />
    <div className="relative aspect-[59/86] w-full overflow-hidden rounded-sm bg-black/20 ring-2 ring-blue-500/60 shadow-[0_0_18px_rgba(59,130,246,0.3)]">
      {card && (
        <CardThumb
          code={card.id}
          name={card.name}
          imageClassName="pointer-events-none"
          className="h-full w-full opacity-30"
        />
      )}
    </div>
    <span className="mt-1 line-clamp-2 h-[26px] w-full px-0.5 break-words text-center text-[10px] font-medium leading-[13px] text-muted-foreground">
      {card?.name ?? ''}
    </span>
  </div>
)
