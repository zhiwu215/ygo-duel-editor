import { ScrollArea } from '../ui/scroll-area'
import React, { useState } from 'react'
import { CdbCard, CardUtils } from '@shared/index'
import { getCardImageUrl, CARD_BACK_IMAGE } from '../../utils/cardImage'
import { CardImage } from '../ui/CardImage'
import {
  formatCardTypeLine,
  formatCardStatsLine,
  formatCardSeriesLine,
  getLinkMarkerMask
} from '../../utils/cardFormat'
import { LinkMarkerArrows } from '../CardDetail/LinkMarkerArrows'
import { cn } from '../../lib/utils'
import { useCustomCardStore } from '../../stores/useCustomCardStore'
import { confirmDialog } from '../../stores/useDialogStore'

import { Check, ZoomIn, Copy, Pencil, Trash2 } from 'lucide-react'
import { CardImageViewer } from '../CardDetail/CardImageViewer'

interface DeckDetailCardProps {
  card: CdbCard | null
  isCover?: boolean
  onToggleCover?: () => void
}

export const DeckDetailCard: React.FC<DeckDetailCardProps> = ({ card, isCover, onToggleCover }) => {
  const { openEdit, remove } = useCustomCardStore()
  const [showImageModal, setShowImageModal] = useState<boolean>(false)
  const [copied, setCopied] = useState<boolean>(false)
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

  const typeLine = card ? formatCardTypeLine(card) : ''
  const statsLine = card && CardUtils.isMonster(card.type) ? formatCardStatsLine(card) : ''
  const linkMarkers = card ? getLinkMarkerMask(card) : 0
  const seriesLine = card ? formatCardSeriesLine(card) : ''

  const handleCopyName = async (): Promise<void> => {
    if (!card?.name) return
    try {
      await navigator.clipboard.writeText(card.name)
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    } catch (err) {
      console.error('[DeckDetailCard] Failed to copy card name:', err)
    }
  }

  const handleDelete = async (): Promise<void> => {
    if (!card?.isCustom) return
    const confirmed = await confirmDialog({
      title: '删除自建卡',
      description: `确定删除自建卡「${card.name}」吗？卡组中已加入的该卡不会受影响。`,
      confirmText: '删除',
      destructive: true
    })
    if (!confirmed) return
    await remove(card.id)
  }

  return (
    <>
      <div className="w-[240px] shrink-0 h-full bg-card/40 border-r border-border flex flex-col overflow-hidden">
        <div className="h-10 px-3 border-b border-border flex items-center justify-between shrink-0 bg-neutral-100/60 dark:bg-neutral-900/60">
          <span className="text-xs font-bold text-foreground">卡片详情</span>
          {card?.isCustom && (
            <div className="flex items-center gap-0.5">
              <button
                type="button"
                onClick={() => openEdit(card.id)}
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
              <div className="p-3 flex flex-col gap-2 select-text">
                <div
                  onClick={handleCopyName}
                  className="group relative flex items-center justify-center px-2 py-1 rounded border border-border/70 bg-muted/60 dark:bg-muted/30 shadow-inner text-center cursor-pointer hover:bg-muted/80 transition-colors select-none"
                >
                  <span className="font-bold text-xs text-foreground truncate">
                    {card.name}[{card.id}]
                  </span>
                  {card.isCustom && (
                    <span className="ml-1 px-1 py-px rounded bg-violet-500/15 text-violet-600 dark:text-violet-300 text-[9px] font-bold shrink-0">
                      自建
                    </span>
                  )}
                  <span className="absolute right-2 opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground">
                    {copied ? (
                      <Check className="w-3 h-3 text-emerald-500" />
                    ) : (
                      <Copy className="w-3 h-3" />
                    )}
                  </span>
                </div>

                <div className="flex flex-col gap-0.5 text-xs font-semibold text-blue-600 dark:text-blue-400 select-text leading-snug">
                  {typeLine && <div>{typeLine}</div>}
                  {statsLine && (
                    <div className="flex items-center flex-wrap gap-x-1">
                      <span>{statsLine}</span>
                      {linkMarkers > 0 && <LinkMarkerArrows markers={linkMarkers} />}
                    </div>
                  )}
                  {seriesLine && <div>{seriesLine}</div>}
                </div>

                <div className="pt-1 text-xs text-foreground/90 font-sans leading-relaxed whitespace-pre-wrap select-text cursor-text selection:bg-primary/25">
                  {card.desc || '无效果描述'}
                </div>
              </div>
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
