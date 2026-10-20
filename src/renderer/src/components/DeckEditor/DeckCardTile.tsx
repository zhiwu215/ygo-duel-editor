import React, { useState } from 'react'
import { DeckData, groupLeafName } from '@shared/index'
import { useDeckEditorStore } from '../../stores/useDeckEditorStore'
import { CardImage } from '../ui/CardImage'
import { CardImageViewer } from '../CardDetail/CardImageViewer'
import { getDeckCoverCode } from '../../utils/deckLibraryView'
import { Clock, Folder } from 'lucide-react'

interface DeckCardTileProps {
  deck: DeckData
  onContextMenu: (e: React.MouseEvent, deck: DeckData) => void
}

export const DeckCardTile: React.FC<DeckCardTileProps> = ({ deck, onContextMenu }) => {
  const { cardDetails, openDeck } = useDeckEditorStore()
  const coverCode = getDeckCoverCode(deck)
  const coverCard = coverCode ? cardDetails[coverCode] : undefined
  const [showViewer, setShowViewer] = useState<boolean>(false)

  const handleCoverClick = (e: React.MouseEvent): void => {
    e.stopPropagation()
    if (coverCode) setShowViewer(true)
  }

  return (
    <div
      data-deck-card
      draggable
      onDragStart={(e) => {
        e.dataTransfer.setData('text/deck-id', deck.id || '')
        e.dataTransfer.effectAllowed = 'move'
      }}
      onClick={() => void openDeck(deck)}
      onContextMenu={(e) => onContextMenu(e, deck)}
      className="group relative flex gap-3 rounded-lg bg-card border border-border/70 hover:border-primary/60 transition-all duration-200 hover:shadow-md overflow-hidden cursor-pointer p-2.5"
    >
      <div
        className="relative h-20 w-14 shrink-0 rounded-md bg-slate-950/80 overflow-hidden flex items-center justify-center cursor-zoom-in"
        onClick={handleCoverClick}
      >
        <CardImage
          code={coverCode}
          alt={deck.name}
          className="h-full object-contain drop-shadow-sm transition-transform duration-300 group-hover:scale-105"
        />
        {deck.group?.trim() && (
          <div className="absolute top-1 left-1 right-1 flex items-center gap-0.5 text-[9px] font-semibold text-white/90 bg-black/65 backdrop-blur-xs px-1 py-0.5 rounded">
            <Folder className="w-2 h-2 shrink-0" />
            <span className="truncate">{groupLeafName(deck.group.trim())}</span>
          </div>
        )}
      </div>

      {showViewer && coverCode && (
        <CardImageViewer
          cardCode={coverCode}
          cardName={coverCard?.name ?? deck.name}
          onClose={() => setShowViewer(false)}
        />
      )}

      <div className="flex flex-col min-w-0 flex-1">
        <h3 className="text-xs font-bold text-foreground group-hover:text-primary transition-colors line-clamp-1">
          {deck.name}
        </h3>

        <div className="flex items-center gap-1 text-[10px] text-muted-foreground mt-0.5">
          <Clock className="w-2.5 h-2.5" />
          <span>{deck.updatedAt ? new Date(deck.updatedAt).toLocaleDateString() : '未同步'}</span>
          {coverCard && <span className="truncate ml-1">· {coverCard.name}</span>}
        </div>

        {deck.tags && deck.tags.length > 0 && (
          <div className="flex flex-wrap gap-0.5 mt-1.5">
            {deck.tags.slice(0, 2).map((t) => (
              <span
                key={t}
                className="text-[9px] font-medium px-1 py-px rounded bg-muted/80 text-muted-foreground border border-border/40"
              >
                #{t}
              </span>
            ))}
            {deck.tags.length > 2 && (
              <span className="text-[9px] text-muted-foreground self-center">
                +{deck.tags.length - 2}
              </span>
            )}
          </div>
        )}

        <div className="text-[10px] text-muted-foreground line-clamp-2 mt-1.5 leading-snug">
          {deck.description ? (
            <span>{deck.description}</span>
          ) : (
            <span className="italic text-muted-foreground/60">暂无描述</span>
          )}
        </div>

        <div className="flex items-center gap-2.5 text-[10px] font-mono font-medium text-muted-foreground mt-auto pt-1.5">
          <span className="text-foreground">
            主 <span className="font-bold">{deck.main.length}</span>
          </span>
          <span className="text-foreground">
            额外 <span className="font-bold">{deck.extra.length}</span>
          </span>
          <span>
            副 <span>{deck.side.length}</span>
          </span>
        </div>
      </div>
    </div>
  )
}
