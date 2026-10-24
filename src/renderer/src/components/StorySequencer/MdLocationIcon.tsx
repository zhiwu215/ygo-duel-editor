import React from 'react'
import { DuelLogCardRef } from '@shared/index'
import { cn } from '../../lib/utils'
import { locationIcon } from './mdpro3LogAssets'
import { zoneLabel } from './stepLogFormat'

interface MdLocationIconProps {
  card: DuelLogCardRef | undefined
  size?: number
  className?: string
}

export const MdLocationIcon: React.FC<MdLocationIconProps> = ({ card, size = 35, className }) => {
  if (!card) return null
  const icon = locationIcon(card.controller, card.location, card.sequence)
  if (!icon) return null
  return (
    <span
      className={cn('relative inline-flex shrink-0 items-center justify-center', className)}
      style={{ width: size, height: size }}
      title={zoneLabel(card)}
    >
      <img
        src={icon.base}
        alt=""
        className="h-full w-full object-contain drop-shadow-[0_1px_2px_rgba(0,0,0,0.65)]"
      />
      {icon.controller && (
        <img
          src={icon.controller}
          alt=""
          className="absolute -bottom-0.5 -right-0.5 rounded-full ring-1 ring-black/60"
          style={{
            width: Math.max(10, Math.round(size * 0.34)),
            height: Math.max(10, Math.round(size * 0.34))
          }}
        />
      )}
    </span>
  )
}
