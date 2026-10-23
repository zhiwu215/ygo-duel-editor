import React from 'react'
import chainNumbers from '../../../assets/textures/number.png'
import { ChainGlyph } from '../../common/ChainGlyph'
import { cn } from '../../../lib/utils'

const NUMBER_COLUMNS = 5
const NUMBER_CELL = 62
const NUMBER_PITCH = 64
const NUMBER_SPRITE_WIDTH = 320
const NUMBER_SPRITE_HEIGHT = 256
const MAX_CHAIN_NUMBER = 20

function numberSpriteStyle(index: number): React.CSSProperties {
  const cell = index - 1
  const column = cell % NUMBER_COLUMNS
  const row = Math.floor(cell / NUMBER_COLUMNS)
  return {
    backgroundColor: '#ffff00',
    maskImage: `url(${chainNumbers})`,
    maskSize: `${(NUMBER_SPRITE_WIDTH / NUMBER_CELL) * 100}% ${(NUMBER_SPRITE_HEIGHT / NUMBER_CELL) * 100}%`,
    maskPosition: `${((column * NUMBER_PITCH) / (NUMBER_SPRITE_WIDTH - NUMBER_CELL)) * 100}% ${
      ((row * NUMBER_PITCH) / (NUMBER_SPRITE_HEIGHT - NUMBER_CELL)) * 100
    }%`,
    maskRepeat: 'no-repeat'
  }
}

interface ChainRingProps {
  index: number
  className?: string
  style?: React.CSSProperties
}

export const ChainRing: React.FC<ChainRingProps> = ({ index, className, style }) => (
  <div className={cn('relative aspect-square', className)} style={style}>
    <div className="absolute inset-0 animate-[spin_5.2s_linear_infinite] motion-reduce:animate-none">
      <ChainGlyph className="h-full w-full" />
    </div>
    {index >= 1 && index <= MAX_CHAIN_NUMBER && (
      <span
        className="absolute left-1/2 top-1/2 h-[60%] w-[60%] -translate-x-1/2 -translate-y-1/2"
        style={numberSpriteStyle(index)}
      />
    )}
  </div>
)
