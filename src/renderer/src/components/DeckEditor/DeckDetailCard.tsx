import { ScrollArea } from '../ui/scroll-area'
import React, { useState } from 'react'
import { CdbCard } from '@shared/index'
import { getCardImageUrl, CARD_BACK_IMAGE } from '../../utils/cardImage'
import { CardImage } from '../ui/CardImage'
import { cn } from '../../lib/utils'
import { ZoomIn } from 'lucide-react'
import { CardImageViewer } from '../CardDetail/CardImageViewer'
import { CardDetailText } from '../CardDetail/CardDetailText'

interface DeckDetailCardProps {
  card: CdbCard | null
  isCover?: boolean
  onToggleCover?: () => void
}

export const DeckDetailCard: React.FC<DeckDetailCardProps> = ({ card, isCover, onToggleCover }) => {
  const [showImageModal, setShowImageModal] = useState<boolean>(false)
  const imageUrl = card ? getCardImageUrl(card.id) : CARD_BACK_IMAGE
  const [display, setDisplay] = useState<{ url: string; loaded: boolean; prevUrl: string | null }>(
    () => ({ url: imageUrl, loaded: true, prevUrl: null })
  )
  if (imageUrl !== display.url) {
    setDisplay({ url: imageUrl, loaded: false, prevUrl: display.url })
  }

  const handleImageLoaded = (): void => {
    setDisplay((s) => (s.loaded ? s : { ...s, loaded: true }))
  }

  return (
    <>
      <div className="w-[240px] shrink-0 h-full bg-card/40 border-r border-border flex flex-col overflow-hidden">
        <div className="h-10 px-3 border-b border-border flex items-center justify-between shrink-0 bg-neutral-100/60 dark:bg-neutral-900/60">
          <span className="text-xs font-bold text-foreground">卡片详情</span>
        </div>

        {card ? (
          <>
            <div className="pt-3 pb-2.5 px-4 flex flex-col items-center shrink-0">
              <div
                className="group relative cursor-zoom-in rounded-md overflow-hidden shadow-md border border-border/80 bg-background/60"
                onClick={() => setShowImageModal(true)}
              >
                {display.prevUrl && !display.loaded && (
                  <img
                    src={display.prevUrl}
                    alt=""
                    draggable={false}
                    className="absolute inset-0 size-full object-cover"
                    onError={() => setDisplay((s) => ({ ...s, prevUrl: null }))}
                  />
                )}
                <CardImage
                  key={display.url}
                  code={card.id}
                  alt={card.name || '卡背'}
                  draggable={false}
                  onLoad={handleImageLoaded}
                  className={cn(
                    'w-[200px] h-[291px] object-cover transition-[transform,opacity] duration-200 group-hover:scale-[1.02]',
                    !display.loaded && 'opacity-0'
                  )}
                />
                <div className="absolute inset-0 bg-black/0 group-hover:bg-black/25 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all duration-150 pointer-events-none">
                  <div className="flex items-center gap-1 px-2.5 py-1 rounded-full bg-black/70 text-white text-[11px] font-medium backdrop-blur-sm shadow-md">
                    <ZoomIn className="w-3.5 h-3.5" />
                    <span>点击放大</span>
                  </div>
                </div>
              </div>
            </div>

            <div className="border-t border-border" />

            <ScrollArea className="flex-1 min-h-0">
              <CardDetailText card={card} descFallback="无效果描述" source="DeckDetailCard" />
            </ScrollArea>
          </>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center p-6 text-center text-muted-foreground text-xs select-none">
            悬停或点击卡片查看详情
          </div>
        )}
      </div>

      {showImageModal && card && (
        <CardImageViewer
          cardCode={card.id}
          cardName={card.name}
          onClose={() => setShowImageModal(false)}
          isCover={isCover}
          onToggleCover={onToggleCover}
        />
      )}
    </>
  )
}
