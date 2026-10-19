import React, { useRef } from 'react'
import { CardLocation, CardPosition, FieldCard } from '@shared/index'
import { useDuelStore } from '../../../stores/useDuelStore'
import { useDropHintStore } from '../../../stores/useDropHintStore'
import { useDismissOnOutside } from '../../../hooks/useDismissOnOutside'
import { cn } from '../../../lib/utils'

const POSITION_OPTIONS: Record<string, { pos: number; label: string }[]> = {
  hand: [
    { pos: CardPosition.FACEUP, label: '表侧' },
    { pos: CardPosition.FACEDOWN, label: '里侧' }
  ],
  szone: [
    { pos: CardPosition.FACEDOWN, label: '盖放' },
    { pos: CardPosition.FACEUP, label: '发动' }
  ],
  mzone: [
    { pos: CardPosition.FACEUP_ATTACK, label: '表攻' },
    { pos: CardPosition.FACEUP_DEFENSE, label: '表守' },
    { pos: CardPosition.FACEDOWN_DEFENSE, label: '盖守' }
  ],
  deck: [
    { pos: CardPosition.FACEDOWN, label: '里侧' },
    { pos: CardPosition.FACEUP, label: '表侧' }
  ],
  extra: [
    { pos: CardPosition.FACEDOWN, label: '里侧' },
    { pos: CardPosition.FACEUP, label: '表侧' }
  ]
}

interface DropHintPopoverProps {
  card: FieldCard
  location: number
  controller: 0 | 1
}

export const DropHintPopover: React.FC<DropHintPopoverProps> = ({ card, location, controller }) => {
  const closeHint = useDropHintStore((s) => s.close)
  const updateCardPosition = useDuelStore((s) => s.updateCardPosition)
  const popoverRef = useRef<HTMLDivElement>(null)

  useDismissOnOutside(popoverRef, true, closeHint, { resize: false })

  const options =
    location === CardLocation.SZONE
      ? POSITION_OPTIONS.szone
      : location === CardLocation.HAND
        ? POSITION_OPTIONS.hand
        : location === CardLocation.DECK
          ? POSITION_OPTIONS.deck
          : location === CardLocation.EXTRA
            ? POSITION_OPTIONS.extra
            : POSITION_OPTIONS.mzone

  return (
    <div
      ref={popoverRef}
      className={cn(
        'absolute left-1/2 -translate-x-1/2 z-40 flex items-center gap-0.5 whitespace-nowrap bg-popover border border-border rounded-md shadow-lg p-0.5 animate-in fade-in',
        controller === 1 ? 'top-full mt-1' : 'bottom-full mb-1'
      )}
    >
      {options.map((opt) => (
        <button
          key={opt.pos}
          type="button"
          onClick={() => {
            updateCardPosition(card.instanceId, opt.pos)
            closeHint()
          }}
          className={cn(
            'px-1.5 py-0.5 rounded border text-[10px] transition-colors',
            card.position === opt.pos
              ? 'bg-blue-500/15 text-blue-600 dark:text-blue-400 border-blue-500/40 font-semibold'
              : 'border-transparent text-muted-foreground hover:text-foreground hover:bg-muted/60'
          )}
        >
          {opt.label}
        </button>
      ))}
    </div>
  )
}
