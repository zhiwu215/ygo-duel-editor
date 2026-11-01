import { ScrollArea } from '../ui/scroll-area'
import React, { useState, useEffect } from 'react'
import { useDuelStore } from '../../stores/useDuelStore'
import { CardImage } from '../ui/CardImage'
import { HelpCircle, ZoomIn } from 'lucide-react'
import { CardImageViewer } from './CardImageViewer'
import { CardDetailText } from './CardDetailText'

export const CardDetailPanel: React.FC = () => {
  const { hoveredCard, selectedCardId, state } = useDuelStore()
  const [showImageModal, setShowImageModal] = useState<boolean>(false)

  let currentCard = hoveredCard
  const selectedFieldCard = selectedCardId
    ? state.cards.find((c) => c.instanceId === selectedCardId)
    : undefined
  if (!currentCard && selectedFieldCard?.card) {
    currentCard = selectedFieldCard.card
  }

  useEffect(() => {
    if (!currentCard && selectedFieldCard && !selectedFieldCard.card) {
      window.api
        .getCardsByIds([selectedFieldCard.code])
        .then((cardMap) => {
          const cardData = cardMap[selectedFieldCard.code]
          if (cardData) {
            useDuelStore.getState().setCardData(selectedFieldCard.instanceId, cardData)
          }
        })
        .catch((err) => {
          void err
        })
    }
  }, [currentCard, selectedFieldCard])

  if (!currentCard) {
    return (
      <div className="w-full h-full bg-card/30 flex flex-col select-none">
        <div className="h-10 px-3 border-b border-border flex items-center justify-between shrink-0 bg-neutral-100/60 dark:bg-neutral-900/60">
          <span className="text-xs font-bold text-foreground">卡片详情</span>
        </div>
        <div className="flex-1 flex flex-col items-center justify-center p-6 text-center text-muted-foreground text-xs select-none">
          <HelpCircle className="w-10 h-10 text-muted-foreground/30 mb-3" />
          <p className="font-medium text-foreground/80">尚未选择卡片</p>
        </div>
      </div>
    )
  }

  return (
    <>
      <div className="w-full h-full bg-card/40 flex flex-col overflow-hidden">
        <div className="h-10 px-3 border-b border-border flex items-center justify-between shrink-0 bg-neutral-100/60 dark:bg-neutral-900/60">
          <span className="text-xs font-bold text-foreground">卡片详情</span>
        </div>

        <div className="pt-3 pb-2.5 px-4 flex flex-col items-center select-none shrink-0">
          <div
            className="group relative cursor-zoom-in rounded-md overflow-hidden shadow-md border border-border/80 bg-black/40"
            onClick={() => setShowImageModal(true)}
          >
            <CardImage
              code={currentCard.id}
              alt={currentCard.name}
              className="w-[200px] h-[291px] object-cover transition-transform duration-200 group-hover:scale-[1.02]"
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
          <CardDetailText card={currentCard} source="CardDetailPanel" />
        </ScrollArea>
      </div>

      {showImageModal && (
        <CardImageViewer
          cardCode={currentCard.id}
          cardName={currentCard.name}
          onClose={() => setShowImageModal(false)}
        />
      )}
    </>
  )
}
