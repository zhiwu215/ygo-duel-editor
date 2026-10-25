import React, { useRef, useState } from 'react'
import { useDuelStore } from '../../stores/useDuelStore'
import { useDismissOnOutside } from '../../hooks/useDismissOnOutside'
import { cn } from '../../lib/utils'

const MENU_ITEM_CLASS =
  'w-full whitespace-nowrap rounded-xs px-2 py-1 text-left font-sans text-[10px] font-medium text-popover-foreground transition-colors hover:bg-accent cursor-pointer'

export const DuelStartButton: React.FC = () => {
  const startDuel = useDuelStore((s) => s.startDuel)
  const [open, setOpen] = useState(false)
  const rootRef = useRef<HTMLDivElement>(null)

  useDismissOnOutside(rootRef, open, () => setOpen(false))

  const choose = (drawOpeningHand: boolean) => (): void => {
    setOpen(false)
    startDuel(drawOpeningHand)
  }

  return (
    <div ref={rootRef} className="relative flex items-center justify-center">
      <button
        type="button"
        aria-expanded={open}
        onClick={() => setOpen((value) => !value)}
        className={cn(
          'w-[54px] h-[22px] rounded-xs border select-none flex items-center justify-center font-sans text-[10px] font-bold tracking-tight cursor-pointer transition-colors',
          'border-neutral-400 dark:border-neutral-500 bg-neutral-200/95 dark:bg-neutral-700/95 hover:bg-neutral-100 dark:hover:bg-neutral-600 active:bg-neutral-300 text-neutral-900 dark:text-neutral-100 shadow-xs'
        )}
      >
        开始
      </button>
      {open && (
        <div className="absolute bottom-full left-1/2 z-40 mb-1 flex min-w-[68px] -translate-x-1/2 flex-col gap-0.5 rounded-md border border-border bg-popover p-0.5 shadow-lg animate-in fade-in zoom-in-95 duration-75">
          <button type="button" onClick={choose(true)} className={MENU_ITEM_CLASS}>
            抽 5 张
          </button>
          <button type="button" onClick={choose(false)} className={MENU_ITEM_CLASS}>
            不抽牌
          </button>
        </div>
      )}
    </div>
  )
}
