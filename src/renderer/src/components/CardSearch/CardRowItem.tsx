import React from 'react'
import { Star } from 'lucide-react'
import { CdbCard, CardPoolSchema, LIMIT_MARKS, isLegendCard } from '@shared/index'
import { formatSearchItemLine2, formatSearchItemLine3 } from '../../utils/cardFormat'
import { CardImage } from '../ui/CardImage'
import { CardScopeBadge } from '../ui/CardScopeBadge'
import { cn } from '../../lib/utils'
import limitSprite from '../../assets/textures/lim.png'

const LIMIT_SPRITE_SIZE = 64
const LIMIT_BADGE_SIZE = 24
const LIMIT_SPRITE_SCALE = LIMIT_BADGE_SIZE / LIMIT_SPRITE_SIZE

export interface CardRowItemProps {
  card: CdbCard
  cardPool?: string
  poolSchema?: CardPoolSchema
  compact?: boolean
  isFavorite?: boolean
  onToggleFavorite?: (code: number, anchor: DOMRect) => void
  onHover?: (card: CdbCard) => void
  onRowClick?: (card: CdbCard) => void
  onRowDoubleClick?: (card: CdbCard) => void
  onDragStart?: (e: React.DragEvent, card: CdbCard) => void
  onContextMenu?: (e: React.MouseEvent, card: CdbCard) => void
}

const CardRowItemBase: React.FC<CardRowItemProps> = ({
  card,
  cardPool,
  poolSchema,
  compact,
  isFavorite,
  onToggleFavorite,
  onHover,
  onRowClick,
  onRowDoubleClick,
  onDragStart,
  onContextMenu
}) => {
  const line2 = formatSearchItemLine2(card)
  const line3 = formatSearchItemLine3(card)
  const showScopeBadge = poolSchema !== 'classic' || (cardPool !== undefined && cardPool !== 'any')
  const scopeText = showScopeBadge && card.scopeText ? `[${card.scopeText}]` : ''

  return (
    <div
      draggable={onDragStart !== undefined}
      onDragStart={onDragStart ? (e) => onDragStart(e, card) : undefined}
      onContextMenu={onContextMenu ? (e) => onContextMenu(e, card) : undefined}
      onMouseEnter={onHover ? () => onHover(card) : undefined}
      onClick={onRowClick ? () => onRowClick(card) : undefined}
      onDoubleClick={onRowDoubleClick ? () => onRowDoubleClick(card) : undefined}
      className={cn(
        'flex items-center gap-2 px-2 py-1 rounded-md bg-card/60 hover:bg-muted/70 border border-border/40 hover:border-primary/40 transition-all group shadow-2xs',
        onDragStart && 'cursor-grab active:cursor-grabbing',
        onRowClick && 'cursor-pointer'
      )}
    >
      <div className="relative shrink-0">
        <CardImage
          code={card.id}
          alt={card.name}
          loading="lazy"
          draggable={false}
          className="w-[42px] h-[60px] object-cover rounded border border-border/60 group-hover:scale-102 transition-transform bg-black/40"
        />
        {(() => {
          const mark =
            LIMIT_MARKS.find((m) => m.id === card.limit) ??
            (isLegendCard(card.ot) ? { spriteX: 64, spriteY: 64 } : null)
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
            />
          )
        })()}
        <CardScopeBadge scope={showScopeBadge ? card.scopeBadge : undefined} />
      </div>

      <div className="flex-1 min-w-0 flex flex-col justify-center gap-0.5 select-none">
        <span className="text-[12px] font-semibold truncate text-foreground group-hover:text-primary transition-colors leading-tight">
          {card.name}
          {card.isCustom && (
            <span className="ml-1 align-middle inline-flex px-1 py-px rounded bg-violet-500/15 text-violet-600 dark:text-violet-300 text-[9px] font-bold leading-none">
              自定义
            </span>
          )}
        </span>

        {compact ? (
          scopeText && (
            <div className="text-[11px] font-mono text-muted-foreground leading-tight truncate">
              {scopeText}
            </div>
          )
        ) : (
          <>
            <div className="text-[11px] text-foreground/80 leading-tight truncate">{line2}</div>

            {(line3 || scopeText) && (
              <div className="text-[11px] font-mono text-foreground/75 leading-tight truncate">
                {line3}
                {scopeText && (
                  <span
                    className={cn('font-sans text-muted-foreground font-normal', line3 && 'ml-1.5')}
                  >
                    {scopeText}
                  </span>
                )}
              </div>
            )}
          </>
        )}
      </div>

      {onToggleFavorite && (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation()
            onToggleFavorite(card.id, e.currentTarget.getBoundingClientRect())
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
      )}
    </div>
  )
}

export const CardRowItem = React.memo(CardRowItemBase)
