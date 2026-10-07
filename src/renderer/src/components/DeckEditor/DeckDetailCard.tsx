import { Tooltip, TooltipTrigger, TooltipContent } from '../ui/tooltip'
import { ScrollArea } from '../ui/scroll-area'
import React, { useState } from 'react'
import { CdbCard, CardUtils } from '@shared/index'
import { getCardImageUrl, CARD_BACK_IMAGE } from '../../utils/cardImage'
import {
  formatCardTypeLine,
  formatCardStatsLine,
  formatCardSeriesLine
} from '../../utils/cardFormat'

import { Check, ZoomIn, Copy } from 'lucide-react'
import { CardImageViewer } from '../CardDetail/CardImageViewer'

interface DeckDetailCardProps {
  card: CdbCard | null
  isCover?: boolean
}

export const DeckDetailCard: React.FC<DeckDetailCardProps> = ({ card, isCover }) => {
  const [showImageModal, setShowImageModal] = useState<boolean>(false)
  const [copied, setCopied] = useState<boolean>(false)
  const imageUrl = card ? getCardImageUrl(card.id) : CARD_BACK_IMAGE
  const typeLine = card ? formatCardTypeLine(card) : ''
  const statsLine = card && CardUtils.isMonster(card.type) ? formatCardStatsLine(card) : ''
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

  return (
    <>
      <ScrollArea className="w-[200px] lg:w-[230px] xl:w-[280px] h-full bg-card border-r border-border shrink-0">
        <div className="flex flex-col p-3">
          {/* 1. 卡图预览 */}
          <div className="aspect-[59/86] w-full shrink-0">
            <Tooltip>
              <TooltipTrigger
                render={
                  <div
                    className="group relative h-full w-full cursor-zoom-in rounded-lg overflow-hidden border border-border/80 shadow-md bg-background/60"
                    onClick={() => setShowImageModal(true)}
                  >
                    <img
                      src={imageUrl}
                      alt={card?.name || '卡背'}
                      draggable={false}
                      className="w-full h-full object-cover transition-transform duration-200 group-hover:scale-[1.03]"
                      onError={(e) => {
                        ;(e.currentTarget as HTMLImageElement).src = CARD_BACK_IMAGE
                      }}
                    />
                    <div className="absolute inset-0 bg-black/0 group-hover:bg-black/25 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all duration-150 pointer-events-none">
                      <div className="flex items-center gap-1 px-2.5 py-1 rounded-full bg-black/70 text-white text-[11px] font-medium backdrop-blur-sm shadow-md">
                        <ZoomIn className="w-3.5 h-3.5" />
                        <span>点击放大</span>
                      </div>
                    </div>
                    {isCover && (
                      <div className="absolute top-2 right-2 bg-purple-950/90 text-purple-300 border border-purple-500/50 text-[10px] font-bold px-1.5 py-0.5 rounded shadow">
                        卡组封面
                      </div>
                    )}
                  </div>
                }
              />
              <TooltipContent>点击放大查看卡图</TooltipContent>
            </Tooltip>
          </div>

          {/* 2. 卡片详细信息 */}
          {card ? (
            <div className="flex flex-col gap-2 mt-3 text-xs flex-1 min-h-0 select-text">
              <div className="flex flex-col gap-0.5 border-b border-border/60 pb-2">
                <Tooltip>
                  <TooltipTrigger
                    render={
                      <div
                        onClick={handleCopyName}
                        className="group relative flex items-center justify-center px-2 py-1 rounded border border-border/70 bg-muted/60 dark:bg-muted/30 shadow-inner text-center cursor-pointer hover:bg-muted/80 transition-colors"
                      >
                        <span className="font-bold text-xs text-foreground truncate">
                          {card.name}[{card.id}]
                        </span>
                        <span className="absolute right-2 opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground">
                          {copied ? (
                            <Check className="w-3 h-3 text-emerald-500" />
                          ) : (
                            <Copy className="w-3 h-3" />
                          )}
                        </span>
                      </div>
                    }
                  />
                  <TooltipContent>点击快速复制卡名</TooltipContent>
                </Tooltip>
                <span className="text-[11px] text-muted-foreground font-mono">密码: {card.id}</span>
              </div>

              <div className="flex flex-col gap-1 text-[11px]">
                {typeLine && <div className="text-muted-foreground font-medium">{typeLine}</div>}
                {statsLine && (
                  <div className="font-mono font-bold text-foreground">{statsLine}</div>
                )}
                {seriesLine && (
                  <div className="text-[10px] text-muted-foreground/80 italic">{seriesLine}</div>
                )}
              </div>

              {/* 效果描述文本 */}
              <ScrollArea className="flex-1 mt-1 rounded bg-muted/40 border border-border/40">
                <div className="p-2 text-[11.5px] leading-relaxed text-foreground whitespace-pre-wrap font-sans cursor-text selection:bg-primary/25">
                  {card.desc || '无效果描述'}
                </div>
              </ScrollArea>
            </div>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center text-xs text-muted-foreground/60 italic">
              悬停或点击卡片查看详情
            </div>
          )}
        </div>
      </ScrollArea>

      {showImageModal && card && (
        <CardImageViewer
          cardCode={card.id}
          cardName={card.name}
          onClose={() => setShowImageModal(false)}
        />
      )}
    </>
  )
}
