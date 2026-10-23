import React from 'react'
import { CardLocation } from '@shared/index'
import { cn } from '../../lib/utils'
import extraDeckIcon from '../../assets/history/summon.png'

interface StepLocationLabelProps {
  player: 0 | 1
  location?: number
  sequence?: number
  className?: string
}

interface LocationLayout {
  name: string
  slots: number
  index: number
}

function locationLayout(location: number, sequence?: number): LocationLayout {
  if (location === CardLocation.MZONE) {
    if (sequence !== undefined && sequence >= 5) {
      return { name: `EX怪兽区${sequence === 5 ? '1' : '2'}`, slots: 2, index: sequence - 5 }
    }
    return { name: '怪兽区', slots: 5, index: sequence ?? 0 }
  }
  if (location === CardLocation.SZONE) {
    if (sequence !== undefined && sequence >= 6) {
      return { name: '灵摆区', slots: 2, index: sequence - 6 }
    }
    if (sequence === 5) return { name: '场地魔法区', slots: 0, index: 0 }
    return { name: '魔陷区', slots: 5, index: sequence ?? 0 }
  }
  if (location === CardLocation.PZONE) {
    return { name: '灵摆区', slots: 2, index: sequence ?? 0 }
  }
  const zoneNames: Partial<Record<number, string>> = {
    [CardLocation.HAND]: '手牌',
    [CardLocation.GRAVE]: '墓地',
    [CardLocation.DECK]: '主卡组',
    [CardLocation.EXTRA]: '额外卡组',
    [CardLocation.REMOVED]: '除外区',
    [CardLocation.FZONE]: '场地魔法区'
  }
  return { name: zoneNames[location] ?? '未知区域', slots: 0, index: 0 }
}

export const StepLocationLabel: React.FC<StepLocationLabelProps> = ({
  player,
  location,
  sequence,
  className
}) => {
  if (location === undefined) return null
  const { name, slots, index } = locationLayout(location, sequence)

  return (
    <div
      className={cn(
        'flex flex-col items-center gap-0.5 text-center leading-tight min-w-0 select-none',
        className
      )}
    >
      <span className="text-[9px] text-muted-foreground/80 shrink-0">
        {player === 0 ? '我方' : '对方'}
      </span>
      <span className="flex items-center gap-1 text-[10px] text-foreground/80 break-all">
        {location === CardLocation.EXTRA && (
          <img src={extraDeckIcon} alt="" className="h-4 w-3 shrink-0 object-contain opacity-80" />
        )}
        {name}
      </span>
      {slots > 0 && (
        <span className="flex gap-[3px]" aria-hidden="true">
          {Array.from({ length: slots }, (_, slot) => (
            <i
              key={slot}
              className={cn(
                'w-1.5 h-2 border border-current rounded-[1px] opacity-30 text-muted-foreground',
                slot === index && 'bg-current opacity-100'
              )}
            />
          ))}
        </span>
      )}
    </div>
  )
}
