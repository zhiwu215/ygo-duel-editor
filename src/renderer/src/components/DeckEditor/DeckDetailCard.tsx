import { Tooltip, TooltipTrigger, TooltipContent } from '../ui/tooltip'
import { ScrollArea } from '../ui/scroll-area'
import React from 'react'
import { CdbCard, CardUtils } from '@shared/index'
import { getCardImageUrl, CARD_BACK_IMAGE } from '../../utils/cardImage'
import {
  formatCardTypeLine,
  formatCardStatsLine,
  formatCardSeriesLine
} from '../../utils/cardFormat'

import { Sparkles, Check } from 'lucide-react'
import { Button } from '../ui/button'

interface DeckDetailCardProps {
  card: CdbCard | null
  isCover?: boolean
  onToggleCover?: () => void
}

export const DeckDetailCard: React.FC<DeckDetailCardProps> = ({ card, isCover, onToggleCover }) => {
  const imageUrl = card ? getCardImageUrl(card.id) : CARD_BACK_IMAGE
  const typeLine = card ? formatCardTypeLine(card) : ''
  const statsLine = card && CardUtils.isMonster(card.type) ? formatCardStatsLine(card) : ''
  const seriesLine = card ? formatCardSeriesLine(card) : ''

  return (
    <ScrollArea className="w-[280px] h-full bg-card border-r border-border shrink-0">
      <div className="flex flex-col p-3 select-none">
        {/* 1. 卡图预览 */}
        <div className="aspect-[59/86] w-full rounded-lg overflow-hidden border border-border/80 shadow-md bg-background/60 shrink-0 relative group">
          <img
            src={imageUrl}
            alt={card?.name || '卡背'}
            draggable={false}
            className="w-full h-full object-cover"
            onError={(e) => {
              ;(e.currentTarget as HTMLImageElement).src = CARD_BACK_IMAGE
            }}
          />
          {isCover && (
            <div className="absolute top-2 right-2 bg-purple-950/90 text-purple-300 border border-purple-500/50 text-[10px] font-bold px-1.5 py-0.5 rounded shadow flex items-center gap-1">
              <Sparkles className="w-3 h-3 text-purple-400" />
              <span>卡组封面</span>
            </div>
          )}
        </div>

        {/* 设为封面快捷操作 */}
        {card && onToggleCover && (
          <div className="mt-2">
            <Button
              variant={isCover ? 'secondary' : 'outline'}
              size="xs"
              onClick={onToggleCover}
              className="w-full h-6.5 text-[11px] font-medium gap-1 justify-center"
            >
              {isCover ? (
                <>
                  <Check className="w-3 h-3 text-emerald-500" />
                  <span>已设为卡组封面</span>
                </>
              ) : (
                <>
                  <Sparkles className="w-3 h-3 text-purple-400" />
                  <span>设为卡组封面</span>
                </>
              )}
            </Button>
          </div>
        )}

        {/* 2. 卡片详细信息 */}
        {card ? (
          <div className="flex flex-col gap-2 mt-3 text-xs flex-1 min-h-0">
            <div className="flex flex-col gap-0.5 border-b border-border/60 pb-2">
              <Tooltip>
                <TooltipTrigger
                  render={
                    <span className="font-bold text-sm text-foreground leading-tight">
                      {card.name}
                    </span>
                  }
                />
                <TooltipContent>{card.name}</TooltipContent>
              </Tooltip>
              <span className="text-[11px] text-muted-foreground font-mono">密码: {card.id}</span>
            </div>

            <div className="flex flex-col gap-1 text-[11px]">
              {typeLine && <div className="text-muted-foreground font-medium">{typeLine}</div>}
              {statsLine && <div className="font-mono font-bold text-foreground">{statsLine}</div>}
              {seriesLine && (
                <div className="text-[10px] text-muted-foreground/80 italic">{seriesLine}</div>
              )}
            </div>

            {/* 效果描述文本 */}
            <ScrollArea className="flex-1 mt-1 rounded bg-muted/40 border border-border/40">
              <div className="p-2 text-[11.5px] leading-relaxed text-foreground whitespace-pre-wrap font-sans">
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
  )
}
