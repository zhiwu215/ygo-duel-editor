import React from 'react'
import { isInfiniteVal } from '@shared/index'
import { CalculatorInput } from './CalculatorInput'
import { useAnimatedNumber } from '../../../hooks/useAnimatedNumber'
import { cn } from '../../../lib/utils'

export interface LpInputProps {
  lp: number
  onLpChange: (lp: number) => void
  player?: 0 | 1
  label?: string
  dotClass?: string
  size?: 'default' | 'sm'
  popoverPlacement?: 'top' | 'bottom' | 'auto'
  className?: string
}

export const LpInput: React.FC<LpInputProps> = ({
  lp,
  onLpChange,
  player,
  label,
  dotClass,
  size = 'sm',
  popoverPlacement = 'auto',
  className
}) => {
  const animatedLp = useAnimatedNumber(lp)
  const placement =
    popoverPlacement === 'auto' ? (player === 0 ? 'top' : 'bottom') : popoverPlacement

  return (
    <div className={cn('relative flex items-center gap-1 select-none', className)}>
      {dotClass && <span className={cn('w-2 h-2 rounded-full shrink-0', dotClass)} />}
      {label && (
        <span
          className={cn(
            'text-muted-foreground select-none font-medium',
            size === 'sm' ? 'text-[10px]' : 'text-[11px]'
          )}
        >
          {label}
        </span>
      )}
      <CalculatorInput
        density="compact"
        unit="LP"
        value={lp}
        displayValue={animatedLp}
        size={size}
        popoverPlacement={placement}
        inputTitle={`${label ?? '生命值'}：${isInfiniteVal(lp) ? '无限' : `${lp} LP`}。点击直接改写，或选择加减乘除四则运算与无限`}
        onCommit={(val) => {
          if (val !== undefined && val !== lp) onLpChange(val)
        }}
      />
    </div>
  )
}
