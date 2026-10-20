import React from 'react'
import { useDuelStore } from '../../stores/useDuelStore'
import { cn } from '../../lib/utils'

export const DuelStartButton: React.FC = () => {
  const executeOpeningDraw = useDuelStore((s) => s.executeOpeningDraw)

  return (
    <button
      type="button"
      onClick={() => executeOpeningDraw()}
      title="开始决斗：双方从主卡组抽取 5 张初始手牌"
      className={cn(
        'w-[54px] h-[22px] rounded-xs border select-none flex items-center justify-center font-sans text-[10px] font-bold tracking-tight cursor-pointer transition-colors',
        'border-neutral-400 dark:border-neutral-500 bg-neutral-200/95 dark:bg-neutral-700/95 hover:bg-neutral-100 dark:hover:bg-neutral-600 active:bg-neutral-300 text-neutral-900 dark:text-neutral-100 shadow-xs'
      )}
    >
      开始
    </button>
  )
}
