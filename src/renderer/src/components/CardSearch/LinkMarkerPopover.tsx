import React, { useEffect, useRef, useState } from 'react'
import { cn } from '../../lib/utils'

interface LinkMarkerPopoverProps {
  value: number
  onConfirm: (mask: number) => void
  onClose: () => void
  anchorRef: React.RefObject<HTMLElement | null>
}

const ORDER: number[] = [0x01, 0x02, 0x04, 0x08, 0x10, 0x20, 0x40, 0x80]
const GLYPHS = ['\u2196', '\u2191', '\u2197', '\u2190', '\u2192', '\u2199', '\u2193', '\u2198']
const CELL = 30
const GAP = 2

export const LinkMarkerPopover: React.FC<LinkMarkerPopoverProps> = ({
  value,
  onConfirm,
  onClose,
  anchorRef
}) => {
  const rootRef = useRef<HTMLDivElement>(null)
  const [pressed, setPressed] = useState<boolean[]>(() => ORDER.map((m) => (value & m) !== 0))

  useEffect(() => {
    const onDown = (e: MouseEvent): void => {
      const target = e.target as Node
      if (rootRef.current?.contains(target)) return
      if (anchorRef.current?.contains(target)) return
      onClose()
    }
    const onKey = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('mousedown', onDown)
    window.addEventListener('keydown', onKey)
    return () => {
      window.removeEventListener('mousedown', onDown)
      window.removeEventListener('keydown', onKey)
    }
  }, [onClose, anchorRef])

  const confirm = (): void => {
    let mask = 0
    for (let i = 0; i < ORDER.length; i += 1) {
      if (pressed[i]) mask |= ORDER[i]
    }
    onConfirm(mask >>> 0)
  }

  const cellClass = (active: boolean): string =>
    cn(
      'flex items-center justify-center rounded-sm text-[15px] leading-none transition-colors',
      active
        ? 'bg-primary/20 text-primary font-bold'
        : 'bg-neutral-500/10 text-foreground/70 hover:bg-neutral-500/25'
    )

  const cells: React.ReactNode[] = []
  for (let row = 0; row < 3; row += 1) {
    for (let col = 0; col < 3; col += 1) {
      if (row === 1 && col === 1) {
        cells.push(
          <button
            key="ok"
            type="button"
            onClick={confirm}
            className="flex items-center justify-center rounded-sm bg-primary/15 text-[11px] font-semibold text-primary transition-colors hover:bg-primary/25"
            style={{ width: CELL, height: CELL }}
          >
            确定
          </button>
        )
        continue
      }
      const index = row * 3 + col > 4 ? row * 3 + col - 1 : row * 3 + col
      cells.push(
        <button
          key={`mark-${index}`}
          type="button"
          aria-pressed={pressed[index]}
          onClick={() => setPressed((prev) => prev.map((p, i) => (i === index ? !p : p)))}
          className={cellClass(pressed[index])}
          style={{ width: CELL, height: CELL }}
        >
          {GLYPHS[index]}
        </button>
      )
    }
  }

  return (
    <div
      ref={rootRef}
      className="absolute right-0 top-full z-50 mt-1 rounded-md border border-border/70 bg-popover p-1.5 shadow-lg animate-in fade-in zoom-in-95 duration-100"
    >
      <div className="grid" style={{ gridTemplateColumns: `repeat(3, ${CELL}px)`, gap: GAP }}>
        {cells}
      </div>
    </div>
  )
}
