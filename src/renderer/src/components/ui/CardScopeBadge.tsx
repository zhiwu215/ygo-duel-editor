import React from 'react'
import { cardPoolSpriteY, CARD_POOL_SPRITE_HEIGHT, CARD_POOL_SPRITE_ROWS } from '@shared/index'
import cardPoolSprite from '../../assets/card/pool.png'
import { cn } from '../../lib/utils'

interface CardScopeBadgeProps {
  scope: string | undefined
  className?: string
}

export const CardScopeBadge: React.FC<CardScopeBadgeProps> = ({ scope, className }) => {
  const spriteY = scope ? cardPoolSpriteY(scope) : null
  if (spriteY === null) return null

  const position = (spriteY / (CARD_POOL_SPRITE_HEIGHT * (CARD_POOL_SPRITE_ROWS - 1))) * 100

  return (
    <span
      className={cn(
        'pointer-events-none absolute bottom-0 left-[16%] aspect-[2/1] w-[68%] bg-no-repeat drop-shadow',
        className
      )}
      style={{
        backgroundImage: `url(${cardPoolSprite})`,
        backgroundSize: `100% ${CARD_POOL_SPRITE_ROWS * 100}%`,
        backgroundPosition: `0 ${position}%`
      }}
    />
  )
}
