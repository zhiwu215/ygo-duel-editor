import React from 'react'
import { CdbCard } from '@shared/index'
import {
  formatCardTypeLine,
  formatCardStatsLine,
  formatCardSeriesLine,
  getLinkMarkerMask
} from '../../utils/cardFormat'
import { LinkMarkerArrows } from './LinkMarkerArrows'
import { useCopyFeedback } from '../../hooks/useCopyFeedback'
import { Check, Copy } from 'lucide-react'

interface CardDetailTextProps {
  card: CdbCard
  source: string
  descFallback?: string
}

export const CardDetailText: React.FC<CardDetailTextProps> = ({ card, source, descFallback }) => {
  const { copiedField, copy } = useCopyFeedback(source)
  const statsLine = formatCardStatsLine(card)
  const linkMarkers = getLinkMarkerMask(card)
  const seriesLine = formatCardSeriesLine(card)

  const handleCopyName = (e: React.MouseEvent): void => {
    e.stopPropagation()
    if (!card.name) return
    void copy('name', card.name)
  }

  const handleCopyCode = (e: React.MouseEvent): void => {
    e.preventDefault()
    e.stopPropagation()
    void copy('code', String(card.id))
  }

  return (
    <div className="flex flex-col gap-2 p-3 select-text">
      <div
        onClick={handleCopyName}
        onContextMenu={handleCopyCode}
        className="group relative flex items-center justify-center rounded border border-border/70 bg-muted/60 px-2 py-1 text-center shadow-inner transition-colors select-none hover:bg-muted/80 dark:bg-muted/30"
      >
        <span className="truncate text-xs font-bold text-foreground">
          {card.name}[{card.id}]
        </span>
        {card.isCustom && (
          <span className="ml-1 shrink-0 rounded bg-violet-500/15 px-1 py-px text-[9px] font-bold text-violet-600 dark:text-violet-300">
            自定义
          </span>
        )}
        <span
          className={`absolute right-2 text-muted-foreground transition-opacity ${
            copiedField ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'
          }`}
        >
          {copiedField ? (
            <Check className="h-3 w-3 text-emerald-500" />
          ) : (
            <Copy className="h-3 w-3" />
          )}
        </span>
      </div>

      <div className="flex flex-col gap-0.5 text-xs leading-snug font-semibold text-blue-600 select-text dark:text-blue-400">
        <div>{formatCardTypeLine(card)}</div>

        {statsLine && (
          <div className="flex flex-wrap items-center gap-x-1">
            <span>{statsLine}</span>
            {linkMarkers > 0 && <LinkMarkerArrows markers={linkMarkers} />}
          </div>
        )}

        {seriesLine && <div>{seriesLine}</div>}
      </div>

      <div className="cursor-text pt-1 font-sans text-xs leading-relaxed whitespace-pre-wrap text-foreground/90 select-text selection:bg-primary/25">
        {card.desc || descFallback}
      </div>
    </div>
  )
}
