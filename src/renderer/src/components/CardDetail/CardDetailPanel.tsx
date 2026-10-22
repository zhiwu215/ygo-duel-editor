import { ScrollArea } from '../ui/scroll-area'
import React, { useState, useEffect } from 'react'
import { useDuelStore } from '../../stores/useDuelStore'
import { useCustomCardStore } from '../../stores/useCustomCardStore'
import { confirmDialog } from '../../stores/useDialogStore'
import {
  formatCardTypeLine,
  formatCardStatsLine,
  formatCardSeriesLine,
  getLinkMarkerMask
} from '../../utils/cardFormat'
import { LinkMarkerArrows } from './LinkMarkerArrows'
import { CardImage } from '../ui/CardImage'
import { useCopyFeedback } from '../../hooks/useCopyFeedback'
import { HelpCircle, ZoomIn, Copy, Check, Pencil, Trash2 } from 'lucide-react'
import { CardImageViewer } from './CardImageViewer'

export const CardDetailPanel: React.FC = () => {
  const { hoveredCard, selectedCardId, state } = useDuelStore()
  const { openEdit, remove } = useCustomCardStore()
  const [showImageModal, setShowImageModal] = useState<boolean>(false)
  const { copiedField, copy } = useCopyFeedback('CardDetailPanel')

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

  const handleCopyName = (e: React.MouseEvent): void => {
    e.stopPropagation()
    if (!currentCard?.name) return
    void copy('name', currentCard.name)
  }

  const handleCopyCode = (e: React.MouseEvent): void => {
    e.preventDefault()
    e.stopPropagation()
    if (!currentCard) return
    void copy('code', String(currentCard.id))
  }

  const handleEdit = (): void => {
    if (!currentCard?.isCustom) return
    openEdit(currentCard.id)
  }

  const handleDelete = async (): Promise<void> => {
    if (!currentCard?.isCustom) return
    const confirmed = await confirmDialog({
      title: '删除自定义卡片',
      description: `确定删除自定义卡片「${currentCard.name}」吗？已拖上场面的该卡不会受影响。`,
      confirmText: '删除',
      destructive: true
    })
    if (!confirmed) return
    await remove(currentCard.id)
  }

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

  const statsLine = formatCardStatsLine(currentCard)
  const linkMarkers = getLinkMarkerMask(currentCard)
  const seriesLine = formatCardSeriesLine(currentCard)

  return (
    <>
      <div className="w-full h-full bg-card/40 flex flex-col overflow-hidden">
        <div className="h-10 px-3 border-b border-border flex items-center justify-between shrink-0 bg-neutral-100/60 dark:bg-neutral-900/60">
          <span className="text-xs font-bold text-foreground">卡片详情</span>
          {currentCard.isCustom && (
            <div className="flex items-center gap-0.5">
              <button
                type="button"
                onClick={handleEdit}
                className="p-1.5 rounded text-muted-foreground hover:text-foreground hover:bg-muted/70 transition-colors"
              >
                <Pencil className="w-3.5 h-3.5" />
              </button>
              <button
                type="button"
                onClick={() => void handleDelete()}
                className="p-1.5 rounded text-muted-foreground hover:text-red-500 hover:bg-muted/70 transition-colors"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>
          )}
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
          <div className="p-3 flex flex-col gap-2 select-text">
            <div
              onClick={handleCopyName}
              onContextMenu={handleCopyCode}
              className="group relative flex items-center justify-center px-2 py-1 rounded border border-border/70 bg-muted/60 dark:bg-muted/30 shadow-inner text-center cursor-pointer hover:bg-muted/80 transition-colors select-none"
            >
              <span className="font-bold text-xs text-foreground truncate">
                {currentCard.name}[{currentCard.id}]
              </span>
              {currentCard.isCustom && (
                <span className="ml-1 px-1 py-px rounded bg-violet-500/15 text-violet-600 dark:text-violet-300 text-[9px] font-bold shrink-0">
                  自定义
                </span>
              )}
              <span
                className={`absolute right-2 transition-opacity text-muted-foreground ${
                  copiedField ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'
                }`}
              >
                {copiedField ? (
                  <Check className="w-3 h-3 text-emerald-500" />
                ) : (
                  <Copy className="w-3 h-3" />
                )}
              </span>
            </div>

            <div className="flex flex-col gap-0.5 text-xs font-semibold text-blue-600 dark:text-blue-400 select-text leading-snug">
              <div>{formatCardTypeLine(currentCard)}</div>

              {statsLine && (
                <div className="flex items-center flex-wrap gap-x-1">
                  <span>{statsLine}</span>
                  {linkMarkers > 0 && <LinkMarkerArrows markers={linkMarkers} />}
                </div>
              )}

              {seriesLine && <div>{seriesLine}</div>}
            </div>

            <div className="pt-1 text-xs text-foreground/90 font-sans leading-relaxed whitespace-pre-wrap select-text cursor-text selection:bg-primary/25">
              {currentCard.desc}
            </div>
          </div>
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
