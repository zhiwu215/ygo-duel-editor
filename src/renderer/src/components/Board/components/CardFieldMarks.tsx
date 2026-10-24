import React from 'react'
import attackTexture from '../../../assets/textures/attack.png'
import equipTexture from '../../../assets/textures/equip.png'
import targetTexture from '../../../assets/textures/target.png'
import { cn } from '../../../lib/utils'

export type CardFieldMark = 'attack' | 'target' | 'equip'

const MARK_TEXTURES: Record<Exclude<CardFieldMark, 'attack'>, string> = {
  equip: equipTexture,
  target: targetTexture
}

interface CardFieldMarksProps {
  mark: CardFieldMark
  controller: 0 | 1
}

export const CardFieldMarks: React.FC<CardFieldMarksProps> = ({ mark, controller }) => {
  if (mark === 'attack') {
    return (
      <img
        src={attackTexture}
        alt=""
        className={cn(
          'pointer-events-none absolute left-1/2 z-20 w-[58%] -translate-x-1/2 object-contain drop-shadow-[0_2px_5px_rgba(0,0,0,0.55)]',
          controller === 0 ? 'bottom-0 translate-y-[34%]' : 'top-0 -translate-y-[34%] rotate-180'
        )}
      />
    )
  }

  return (
    <img
      src={MARK_TEXTURES[mark]}
      alt=""
      className="pointer-events-none absolute inset-0 z-20 m-auto h-[40%] w-[40%] object-contain drop-shadow-[0_1px_4px_rgba(0,0,0,0.7)]"
    />
  )
}
