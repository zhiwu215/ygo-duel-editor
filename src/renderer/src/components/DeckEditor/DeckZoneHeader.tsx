import React from 'react'
import { useDroppable } from '@dnd-kit/core'
import { DeckSection } from '@shared/index'
import { DeckDropTargetData } from './deckDnd'

export const DeckZone: React.FC<{
  section: DeckSection
  className?: string
  children: React.ReactNode
}> = ({ section, className, children }) => {
  const { setNodeRef } = useDroppable({
    id: `zone:${section}`,
    data: { kind: 'zone', section } as DeckDropTargetData
  })
  return (
    <div ref={setNodeRef} className={className}>
      {children}
    </div>
  )
}

export interface TypeTally {
  sprite: string
  label: string
  count: number
}

const TypeTallyBadge: React.FC<{ tally: TypeTally }> = ({ tally }) => (
  <span className="flex items-center gap-1 shrink-0" title={`${tally.label} ${tally.count} 张`}>
    <img src={tally.sprite} alt={tally.label} className="h-4 w-auto opacity-90" draggable={false} />
    <span className="text-[11px] font-mono text-muted-foreground tabular-nums">{tally.count}</span>
  </span>
)

export const ZoneHeader: React.FC<{
  title: string
  total: number
  tallies: TypeTally[]
  width: number
}> = ({ title, total, tallies, width }) => (
  <div
    className="flex items-center justify-between gap-3 h-7 pl-2 pr-2.5 rounded-md bg-neutral-500/15 dark:bg-neutral-500/20 border border-border/40"
    style={{ width: `${width}px` }}
  >
    <div className="flex items-center gap-1.5 min-w-0 shrink">
      <span className="text-xs font-bold text-foreground truncate">{title}</span>
      <span className="text-xs text-muted-foreground font-normal">{total} 张</span>
    </div>
    <div className="flex items-center gap-2.5 min-w-0 shrink-0">
      {tallies.map((t) => (
        <TypeTallyBadge key={t.label} tally={t} />
      ))}
    </div>
  </div>
)
