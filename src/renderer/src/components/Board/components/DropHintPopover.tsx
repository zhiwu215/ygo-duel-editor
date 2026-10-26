import React, { useLayoutEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { CardLocation, CardPosition, FieldCard } from '@shared/index'
import { useDuelStore } from '../../../stores/useDuelStore'
import { useDropHintStore } from '../../../stores/useDropHintStore'
import { useDismissOnOutside } from '../../../hooks/useDismissOnOutside'
import { cn } from '../../../lib/utils'

const POSITION_OPTIONS: Record<string, { pos: number; label: string }[]> = {
  szone: [
    { pos: CardPosition.FACEDOWN, label: '盖放' },
    { pos: CardPosition.FACEUP, label: '发动' }
  ],
  mzone: [
    { pos: CardPosition.FACEUP_ATTACK, label: '表攻' },
    { pos: CardPosition.FACEUP_DEFENSE, label: '表守' },
    { pos: CardPosition.FACEDOWN_DEFENSE, label: '盖守' }
  ]
}

interface DropHintPopoverProps {
  card: FieldCard
  location: number
}

export const DropHintPopover: React.FC<DropHintPopoverProps> = ({ card, location }) => {
  const closeHint = useDropHintStore((s) => s.close)
  const setPlacedCardPosition = useDuelStore((s) => s.setPlacedCardPosition)
  const anchorRef = useRef<HTMLDivElement>(null)
  const popoverRef = useRef<HTMLDivElement>(null)
  const [position, setPosition] = useState<{ left: number; top: number } | null>(null)

  useDismissOnOutside(popoverRef, true, closeHint, { resize: false })

  useLayoutEffect(() => {
    const anchor = anchorRef.current?.parentElement
    const popover = popoverRef.current
    if (!anchor || !popover) return
    const rect = anchor.getBoundingClientRect()
    const width = popover.offsetWidth
    const height = popover.offsetHeight
    setPosition({
      left: Math.min(
        Math.max(8, rect.left + rect.width / 2 - width / 2),
        window.innerWidth - width - 8
      ),
      top: Math.max(8, rect.top - height - 4)
    })
  }, [card.instanceId, card.position, location])

  const options = location === CardLocation.SZONE ? POSITION_OPTIONS.szone : POSITION_OPTIONS.mzone

  return (
    <>
      <div ref={anchorRef} className="hidden" />
      {createPortal(
        <div
          ref={popoverRef}
          style={{ left: position?.left ?? -9999, top: position?.top ?? -9999 }}
          className="fixed z-50 flex items-center gap-0.5 whitespace-nowrap bg-popover border border-border rounded-md shadow-lg p-0.5 animate-in fade-in"
        >
          {options.map((opt) => (
            <button
              key={opt.pos}
              type="button"
              onClick={() => {
                setPlacedCardPosition(card.instanceId, opt.pos)
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
        </div>,
        document.body
      )}
    </>
  )
}
