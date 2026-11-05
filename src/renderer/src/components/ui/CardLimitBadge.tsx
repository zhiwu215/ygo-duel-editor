import React from 'react'
import { LIMIT_MARKS } from '@shared/index'
import limitSprite from '../../assets/card/limit.png'
import { cn } from '../../lib/utils'

const SPRITE_CELL = 64
const LEGEND_MARK = { spriteX: 64, spriteY: 64 }

interface CardLimitBadgeProps {
  limit?: 1 | 2 | 3
  legend?: boolean
  className?: string
}

export const CardLimitBadge: React.FC<CardLimitBadgeProps> = ({ limit, legend, className }) => {
  const mark = LIMIT_MARKS.find((item) => item.id === limit) ?? (legend ? LEGEND_MARK : null)
  if (!mark) return null

  return (
    <span
      className={cn('pointer-events-none block bg-no-repeat', className)}
      style={{
        backgroundImage: `url(${limitSprite})`,
        backgroundSize: '200% 200%',
        backgroundPosition: `${(mark.spriteX / SPRITE_CELL) * 100}% ${(mark.spriteY / SPRITE_CELL) * 100}%`
      }}
    />
  )
}
