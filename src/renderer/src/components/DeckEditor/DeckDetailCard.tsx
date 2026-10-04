import React from 'react'
import { CdbCard, CardUtils } from '@shared/index'
import { getCardImageUrl, CARD_BACK_IMAGE } from '../../utils/cardImage'
import {
  formatCardTypeLine,
  formatCardStatsLine,
  formatCardSeriesLine
} from '../../utils/cardFormat'

interface DeckDetailCardProps {
  card: CdbCard | null
}

export const DeckDetailCard: React.FC<DeckDetailCardProps> = ({ card }) => {
  const imageUrl = card ? getCardImageUrl(card.id) : CARD_BACK_IMAGE
  const typeLine = card ? formatCardTypeLine(card) : ''
  const statsLine = card && CardUtils.isMonster(card.type) ? formatCardStatsLine(card) : ''
  const seriesLine = card ? formatCardSeriesLine(card) : ''

  return (
    <div className="w-[280px] h-full flex flex-col bg-card border-r border-border p-3 select-none shrink-0 overflow-y-auto">
      {/* 1. 卡图预览 */}
      <div className="aspect-[59/86] w-full rounded-lg overflow-hidden border border-border/80 shadow-md bg-background/60 shrink-0">
        <img
          src={imageUrl}
          alt={card?.name || '卡背'}
          draggable={false}
          className="w-full h-full object-cover"
          onError={(e) => {
            ;(e.currentTarget as HTMLImageElement).src = CARD_BACK_IMAGE
          }}
        />
      </div>

      {/* 2. 卡片详细信息 */}
      {card ? (
        <div className="flex flex-col gap-2 mt-3 text-xs flex-1 min-h-0">
          <div className="flex flex-col gap-0.5 border-b border-border/60 pb-2">
            <span className="font-bold text-sm text-foreground leading-tight" title={card.name}>
              {card.name}
            </span>
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
          <div className="flex-1 overflow-y-auto mt-1 p-2 rounded bg-muted/40 border border-border/40 text-[11.5px] leading-relaxed text-foreground whitespace-pre-wrap font-sans">
            {card.desc || '无效果描述'}
          </div>
        </div>
      ) : (
        <div className="flex-1 flex flex-col items-center justify-center text-xs text-muted-foreground/60 italic">
          悬停或点击卡片查看详情
        </div>
      )}
    </div>
  )
}
