import React from 'react'
import { CalculatorInput } from './CalculatorInput'
import { useAnimatedNumber } from '../../../hooks/useAnimatedNumber'
import { cn } from '../../../lib/utils'
import lpBarTexture from '../../../assets/textures/lp.png'
import lpFrameTexture from '../../../assets/textures/lpf.png'

export interface LpInputProps {
  lp: number
  onLpChange: (lp: number) => void
  player?: 0 | 1
  label?: string
  size?: 'default' | 'sm'
  popoverPlacement?: 'top' | 'bottom' | 'auto'
  maxLp?: number
  className?: string
}

export const LpInput: React.FC<LpInputProps> = ({
  lp,
  onLpChange,
  player,
  label,
  size = 'sm',
  popoverPlacement = 'auto',
  maxLp = 8000,
  className
}) => {
  const animatedLp = useAnimatedNumber(lp)
  const placement =
    popoverPlacement === 'auto' ? (player === 0 ? 'top' : 'bottom') : popoverPlacement
  const exceedsMax = maxLp > 0 && lp > maxLp
  const layers = exceedsMax ? Math.floor(lp / maxLp) : 0
  const partialLp = exceedsMax ? lp % maxLp : Math.max(0, lp)
  const percent = Math.max(0, Math.min(100, maxLp > 0 ? (partialLp / maxLp) * 100 : 0))
  const backgroundRow = exceedsMax ? (layers - 1) % 5 : 0
  const fillRow = exceedsMax ? layers % 5 : 0
  const rowPosition = (row: number): string => `0 ${row * 25}%`

  return (
    <div
      aria-label={label ?? 'LP'}
      title={label ?? 'LP'}
      className={cn(
        'relative select-none bg-black/55',
        size === 'sm' ? 'h-5 w-24' : 'h-6 w-28',
        className
      )}
    >
      {exceedsMax && (
        <div
          className="absolute inset-[2px]"
          style={{
            backgroundImage: `url(${lpBarTexture})`,
            backgroundSize: '100% 500%',
            backgroundPosition: rowPosition(backgroundRow),
            imageRendering: 'pixelated'
          }}
        />
      )}
      <div
        className={cn('absolute inset-y-[2px]', player === 1 ? 'right-[2px]' : 'left-[2px]')}
        style={{ width: `max(0px, calc(${percent}% - 2px))` }}
      >
        <div
          className="h-full w-full"
          style={{
            backgroundImage: `url(${lpBarTexture})`,
            backgroundSize: '100% 500%',
            backgroundPosition: rowPosition(fillRow),
            imageRendering: 'pixelated'
          }}
        />
      </div>
      <img
        src={lpFrameTexture}
        alt=""
        className="pointer-events-none absolute inset-0 z-10 h-full w-full object-fill"
        style={{ imageRendering: 'pixelated' }}
      />
      <div className="absolute inset-0 z-20 flex items-center justify-center">
        <CalculatorInput
          density="compact"
          unit="LP"
          value={lp}
          displayValue={animatedLp}
          size={size}
          popoverPlacement={placement}
          inputClassName="h-full w-full rounded-none border-0 bg-transparent px-1 text-center font-mono text-[10px] font-bold text-white drop-shadow-[0_1px_1px_rgba(0,0,0,0.9)] caret-white shadow-none focus:border-0 focus:ring-0"
          onCommit={(val) => {
            if (val !== undefined && val !== lp) onLpChange(val)
          }}
        />
      </div>
    </div>
  )
}
