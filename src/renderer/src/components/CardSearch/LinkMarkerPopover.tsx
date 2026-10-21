import React, { useRef, useState } from 'react'
import { LINK_MARKERS } from '@shared/index'
import { cn } from '../../lib/utils'
import { LINK_MARKER_ICONS } from '../../utils/linkMarkerIcons'
import { usePopoverDismiss } from './usePopoverDismiss'

interface LinkMarkerPopoverProps {
  value: number
  onConfirm: (mask: number) => void
  onClose: () => void
  anchorRef: React.RefObject<HTMLElement | null>
}

const GRID: Array<{ mask: number } | null> = [
  LINK_MARKERS[0],
  LINK_MARKERS[1],
  LINK_MARKERS[2],
  LINK_MARKERS[3],
  null,
  LINK_MARKERS[4],
  LINK_MARKERS[5],
  LINK_MARKERS[6],
  LINK_MARKERS[7]
]
const CELL = 30
const GAP = 2

export const LinkMarkerPopover: React.FC<LinkMarkerPopoverProps> = ({
  value,
  onConfirm,
  onClose,
  anchorRef
}) => {
  const rootRef = useRef<HTMLDivElement>(null)
  const [pressed, setPressed] = useState<number>(value)

  usePopoverDismiss(rootRef, anchorRef, onClose)

  return (
    <div
      ref={rootRef}
      className="absolute right-0 top-full z-50 mt-1 rounded-md border border-border/70 bg-popover p-1.5 shadow-lg animate-in fade-in zoom-in-95 duration-100"
    >
      <div className="grid" style={{ gridTemplateColumns: `repeat(3, ${CELL}px)`, gap: GAP }}>
        {GRID.map((cell) =>
          cell === null ? (
            <button
              key="confirm"
              type="button"
              onClick={() => onConfirm(pressed >>> 0)}
              className="flex items-center justify-center rounded-sm bg-primary/15 text-[11px] font-semibold text-primary transition-colors hover:bg-primary/25"
              style={{ width: CELL, height: CELL }}
            >
              确定
            </button>
          ) : (
            (() => {
              const Icon = LINK_MARKER_ICONS[cell.mask]
              const active = (pressed & cell.mask) !== 0
              return (
                <button
                  key={cell.mask}
                  type="button"
                  aria-pressed={active}
                  onClick={() => setPressed((prev) => prev ^ cell.mask)}
                  className={cn(
                    'flex items-center justify-center rounded-sm transition-colors',
                    active
                      ? 'bg-primary text-primary-foreground shadow-sm'
                      : 'bg-neutral-500/10 text-foreground/70 hover:bg-neutral-500/25'
                  )}
                  style={{ width: CELL, height: CELL }}
                >
                  {Icon && <Icon className="w-4 h-4" strokeWidth={2} />}
                </button>
              )
            })()
          )
        )}
      </div>
    </div>
  )
}
