import React, { useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'
import { cn } from '../../lib/utils'

export interface ContextMenuItem {
  label: string
  onSelect: () => void
  destructive?: boolean
}

interface ContextMenuProps {
  x: number
  y: number
  items: ContextMenuItem[]
  onClose: () => void
}

export const ContextMenu: React.FC<ContextMenuProps> = ({ x, y, items, onClose }) => {
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const handlePointerDown = (event: MouseEvent): void => {
      if (ref.current?.contains(event.target as Node)) return
      onClose()
    }
    const handleKeyDown = (event: KeyboardEvent): void => {
      if (event.key === 'Escape') onClose()
    }
    window.addEventListener('mousedown', handlePointerDown)
    window.addEventListener('keydown', handleKeyDown)
    return () => {
      window.removeEventListener('mousedown', handlePointerDown)
      window.removeEventListener('keydown', handleKeyDown)
    }
  }, [onClose])

  const width = 168
  const height = items.length * 30 + 8
  const left = Math.max(4, Math.min(x, window.innerWidth - width - 4))
  const top = Math.max(4, Math.min(y, window.innerHeight - height - 4))

  return createPortal(
    <div
      ref={ref}
      className="fixed z-[200] min-w-[168px] rounded-md border border-border bg-popover p-1 shadow-lg"
      style={{ left, top }}
      onContextMenu={(event) => event.preventDefault()}
    >
      {items.map((item) => (
        <button
          key={item.label}
          type="button"
          onClick={() => {
            item.onSelect()
            onClose()
          }}
          className={cn(
            'flex w-full items-center rounded px-2 py-1.5 text-left text-xs transition-colors',
            item.destructive
              ? 'text-destructive hover:bg-destructive/10'
              : 'text-foreground hover:bg-muted'
          )}
        >
          {item.label}
        </button>
      ))}
    </div>,
    document.body
  )
}
