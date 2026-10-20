import React from 'react'
import { cardPoolSpriteY, CARD_POOL_SPRITE_WIDTH, CARD_POOL_SPRITE_HEIGHT } from '@shared/index'
import cardPoolSprite from '../../assets/textures/ot.png'

const SPRITE_TOTAL_HEIGHT = CARD_POOL_SPRITE_HEIGHT * 10

interface CardPoolBadgesProps {
  pools: string[] | undefined
  extraBadges?: string[]
  width?: number
}

export const CardPoolBadges: React.FC<CardPoolBadgesProps> = ({
  pools,
  extraBadges,
  width = 32
}) => {
  const ids = [...(pools ?? []), ...(extraBadges ?? [])]
  const visible = ids.filter((id) => cardPoolSpriteY(id) !== null)
  if (visible.length === 0) return null

  const scale = width / CARD_POOL_SPRITE_WIDTH
  const height = CARD_POOL_SPRITE_HEIGHT * scale

  return (
    <span className="absolute inset-x-0 bottom-0 flex gap-px">
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
        />
      ))}
    </span>
  )
}
