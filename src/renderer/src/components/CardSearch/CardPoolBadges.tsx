import React from 'react'
import {
  cardPoolLabel,
  cardPoolSpriteY,
  CARD_POOL_SPRITE_WIDTH,
  CARD_POOL_SPRITE_HEIGHT
} from '@shared/index'
import cardPoolSprite from '../../assets/textures/ot.png'
import { cn } from '../../lib/utils'

const SPRITE_TOTAL_HEIGHT = CARD_POOL_SPRITE_HEIGHT * 10

interface CardPoolBadgesProps {
  pools: string[] | undefined
  /** 额外角标（如 OCG / TCG 独有），由调用方按当前筛选决定是否传入 */
  extraBadges?: string[]
  width?: number
  className?: string
  align?: 'center' | 'start' | 'end'
}

export const CardPoolBadges: React.FC<CardPoolBadgesProps> = ({
  pools,
  extraBadges,
  width = 32,
  className,
  align = 'center'
}) => {
  const ids = [...(pools ?? []), ...(extraBadges ?? [])]
  const visible = ids.filter((id) => cardPoolSpriteY(id) !== null)
  if (visible.length === 0) return null

  const scale = width / CARD_POOL_SPRITE_WIDTH
  const height = CARD_POOL_SPRITE_HEIGHT * scale

  return (
    <span
      className={cn(
        'absolute inset-x-0 bottom-0 flex gap-px',
        align === 'center' && 'justify-center',
        align === 'start' && 'justify-start',
        align === 'end' && 'justify-end',
        className
      )}
    >
      {visible.map((id) => (
        <span
          key={id}
          className="block drop-shadow shrink-0"
          style={{
            width: `${width}px`,
            height: `${height}px`,
            backgroundImage: `url(${cardPoolSprite})`,
            backgroundSize: `${CARD_POOL_SPRITE_WIDTH * scale}px ${SPRITE_TOTAL_HEIGHT * scale}px`,
            backgroundPosition: `0 -${(cardPoolSpriteY(id) as number) * scale}px`
          }}
          title={cardPoolLabel(id)}
        />
      ))}
    </span>
  )
}
