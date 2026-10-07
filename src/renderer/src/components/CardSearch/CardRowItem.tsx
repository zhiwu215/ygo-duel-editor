import { Tooltip, TooltipTrigger, TooltipContent } from '../ui/tooltip'
import React from 'react'
import { Star } from 'lucide-react'
import { CdbCard, CardUtils, LIMIT_MARKS, cardPoolLabel, otBadgeIds } from '@shared/index'
import { getCardImageUrl, UNKNOWN_CARD_IMAGE } from '../../utils/cardImage'
import { formatSearchItemLine2, formatSearchItemLine3 } from '../../utils/cardFormat'
import { CardPoolBadges } from './CardPoolBadges'
import { cn } from '../../lib/utils'
import limitSprite from '../../assets/textures/lim.png'

const LIMIT_SPRITE_SIZE = 64
const LIMIT_BADGE_SIZE = 24
const LIMIT_SPRITE_SCALE = LIMIT_BADGE_SIZE / LIMIT_SPRITE_SIZE

export interface CardRowItemProps {
  card: CdbCard
  cardPool?: string
  /** 紧凑模式：只显示卡名/卡密、卡池角标与文字标注，不显示类型攻防行 */
  compact?: boolean
  isFavorite?: boolean
  onToggleFavorite?: (code: number) => void
  onHover?: (card: CdbCard) => void
  /** 行点击回调（选择卡片等），未提供时沿用 hover 语义 */
  onRowClick?: (card: CdbCard) => void
  onDragStart?: (e: React.DragEvent, card: CdbCard) => void
  className?: string
}

export const CardRowItem: React.FC<CardRowItemProps> = ({
  card,
  cardPool,
  compact,
  isFavorite,
  onToggleFavorite,
  onHover,
  onRowClick,
  onDragStart,
  className
}) => {
  const line2 = formatSearchItemLine2(card)
  const line3 = formatSearchItemLine3(card)
  const poolText =
    card.pools && card.pools.length > 0
      ? card.pools.map((pool) => `[${cardPoolLabel(pool)}]`).join('')
      : ''
  const isMonster = CardUtils.isMonster(card.type)
  const otBadges = cardPool === 'ocgOnly' || cardPool === 'tcgOnly' ? otBadgeIds(card.ot) : []

  return (
    <div
      draggable={onDragStart !== undefined}
      onDragStart={onDragStart ? (e) => onDragStart(e, card) : undefined}
      onMouseEnter={onHover ? () => onHover(card) : undefined}
      onClick={onRowClick ? () => onRowClick(card) : onHover ? () => onHover(card) : undefined}
      className={cn(
        'flex items-center gap-2 px-2 py-1 rounded-md bg-card/60 hover:bg-muted/70 border border-border/40 hover:border-primary/40 transition-all group shadow-2xs',
        onDragStart && 'cursor-grab active:cursor-grabbing',
        onRowClick && 'cursor-pointer',
        className
      )}
    >
      <div className="relative shrink-0">
        <img
          src={getCardImageUrl(card.id)}
          alt={card.name}
          loading="lazy"
          className="w-[42px] h-[60px] object-cover rounded border border-border/60 group-hover:scale-102 transition-transform bg-black/40"
          onError={(e) => {
            const target = e.currentTarget
            if (target.src !== UNKNOWN_CARD_IMAGE) target.src = UNKNOWN_CARD_IMAGE
          }}
        />
        {(() => {
          const mark = LIMIT_MARKS.find((m) => m.id === card.limit)
          if (!mark) return null
          return (
            <span
              className="absolute -left-1 -top-1 drop-shadow"
              style={{
                width: `${LIMIT_BADGE_SIZE * 0.7}px`,
                height: `${LIMIT_BADGE_SIZE * 0.7}px`,
                backgroundImage: `url(${limitSprite})`,
                backgroundSize: `${LIMIT_SPRITE_SIZE * 2 * LIMIT_SPRITE_SCALE * 0.7}px ${LIMIT_SPRITE_SIZE * 2 * LIMIT_SPRITE_SCALE * 0.7}px`,
                backgroundPosition: `-${mark.spriteX * LIMIT_SPRITE_SCALE * 0.7}px -${mark.spriteY * LIMIT_SPRITE_SCALE * 0.7}px`
              }}
              title={mark.label}
            />
          )
        })()}
        <CardPoolBadges pools={card.pools} extraBadges={otBadges} width={26} />
      </div>

      <div className="flex-1 min-w-0 flex flex-col justify-center gap-0.5 select-none">
        <span className="text-[12px] font-semibold truncate text-foreground group-hover:text-primary transition-colors leading-tight">
          {card.name}
          {card.isCustom && (
            <span className="ml-1 align-middle inline-flex px-1 py-px rounded bg-violet-500/15 text-violet-600 dark:text-violet-300 text-[9px] font-bold leading-none">
              自建
            </span>
          )}
        </span>

        {compact ? (
          poolText && (
            <div className="text-[11px] font-mono text-muted-foreground leading-tight truncate">
              {poolText}
            </div>
          )
        ) : (
          <>
            <div className="text-[11px] text-foreground/80 leading-tight truncate">
              {line2}
              {!isMonster && poolText && (
                <span className="ml-1.5 text-muted-foreground font-normal">{poolText}</span>
              )}
            </div>

            {line3 && (
              <div className="text-[11px] font-mono text-foreground/75 leading-tight truncate">
                {line3}
                {isMonster && poolText && (
                  <span className="ml-1.5 font-sans text-muted-foreground font-normal">
                    {poolText}
                  </span>
                )}
              </div>
            )}
          </>
        )}
      </div>

      {onToggleFavorite && (
        <Tooltip>
          <TooltipTrigger
            render={
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation()
                  onToggleFavorite(card.id)
                }}
                className="p-1 rounded text-muted-foreground hover:text-amber-400 shrink-0 transition-opacity"
              >
                <Star
                  className={cn(
                    'w-3.5 h-3.5 transition-all',
                    isFavorite
                      ? 'fill-amber-400 text-amber-400 opacity-100'
                      : 'opacity-0 group-hover:opacity-100 hover:text-foreground'
                  )}
                />
              </button>
            }
          />
          <TooltipContent>{isFavorite ? '取消收藏' : '收藏此卡'}</TooltipContent>
        </Tooltip>
      )}
    </div>
  )
}
