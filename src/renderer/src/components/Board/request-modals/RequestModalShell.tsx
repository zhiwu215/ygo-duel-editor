import React, { useRef, useState } from 'react'
import { ChevronUp, GripVertical, Minus } from 'lucide-react'
import { cn } from '../../../lib/utils'

interface RequestModalShellProps {
  title?: string
  subtitle?: string
  width?: string
  children: React.ReactNode
  footer?: React.ReactNode
}

interface DragState {
  pointerId: number
  x: number
  y: number
}

const stripPlayerPrefix = (text?: string): string | undefined => text?.replace(/^Player \d+\s*/, '')

export const RequestModalShell: React.FC<RequestModalShellProps> = ({
  title,
  subtitle,
  width = 'max-w-md',
  children,
  footer
}) => {
  const barTitle = stripPlayerPrefix(title)
  const barSubtitle = stripPlayerPrefix(subtitle)
  const panelRef = useRef<HTMLDivElement>(null)
  const dragRef = useRef<DragState | null>(null)
  const [minimized, setMinimized] = useState(false)
  const [offset, setOffset] = useState({ x: 0, y: 0 })

  const moveBy = (x: number, y: number): void => {
    const rect = panelRef.current?.getBoundingClientRect()
    if (!rect) return
    const margin = 8
    const dx = Math.max(margin - rect.left, Math.min(x, window.innerWidth - margin - rect.right))
    const dy = Math.max(margin - rect.top, Math.min(y, window.innerHeight - margin - rect.bottom))
    setOffset((current) => ({ x: current.x + dx, y: current.y + dy }))
  }

  const handlePointerDown = (event: React.PointerEvent<HTMLDivElement>): void => {
    if (minimized || event.button !== 0) return
    if ((event.target as HTMLElement).closest('button')) return
    dragRef.current = { pointerId: event.pointerId, x: event.clientX, y: event.clientY }
    event.currentTarget.setPointerCapture(event.pointerId)
    event.preventDefault()
  }

  const handlePointerMove = (event: React.PointerEvent<HTMLDivElement>): void => {
    const previous = dragRef.current
    if (!previous || previous.pointerId !== event.pointerId) return
    moveBy(event.clientX - previous.x, event.clientY - previous.y)
    dragRef.current = { pointerId: event.pointerId, x: event.clientX, y: event.clientY }
  }

  const handlePointerUp = (event: React.PointerEvent<HTMLDivElement>): void => {
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId)
    }
    dragRef.current = null
  }

  const titleBar = (
    <>
      <GripVertical className="h-3.5 w-3.5 shrink-0 opacity-50" />
      {barTitle && (
        <span className="min-w-0 break-words text-[11px] font-semibold leading-relaxed tracking-wide">
          {barTitle}
        </span>
      )}
      {barSubtitle && (
        <span className="min-w-0 break-words text-[11px] leading-relaxed opacity-60">
          {barSubtitle}
        </span>
      )}
    </>
  )

  if (minimized) {
    return (
      <div className="pointer-events-none fixed inset-x-0 bottom-0 z-[65] flex justify-center">
        <button
          type="button"
          onClick={() => setMinimized(false)}
          aria-label="展开弹窗"
          className={cn(
            'pointer-events-auto flex w-full items-center gap-2 rounded-t-md border border-b-0 border-border bg-card px-3 py-2 text-left text-card-foreground shadow-2xl',
            width
          )}
        >
          {titleBar}
          <ChevronUp className="ml-auto h-4 w-4 shrink-0 text-muted-foreground" />
        </button>
      </div>
    )
  }

  return (
    <div
      className="fixed inset-0 z-[65] flex items-center justify-center bg-black/40 p-4 select-none animate-in fade-in"
      role="dialog"
      aria-modal="true"
    >
      <div
        ref={panelRef}
        style={{ transform: `translate(${offset.x}px, ${offset.y}px)` }}
        className={cn(
          'flex max-h-[86vh] w-full flex-col overflow-hidden rounded-md border border-border bg-card text-card-foreground shadow-xl',
          width
        )}
      >
        {(barTitle || barSubtitle) && (
          <div
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
            onPointerCancel={() => {
              dragRef.current = null
            }}
            onLostPointerCapture={() => {
              dragRef.current = null
            }}
            onDoubleClick={() => setOffset({ x: 0, y: 0 })}
            className="flex shrink-0 cursor-move touch-none items-center gap-2 bg-foreground px-3 py-1.5 text-background dark:bg-muted dark:text-foreground"
          >
            {titleBar}
            <button
              type="button"
              onClick={() => {
                setOffset({ x: 0, y: 0 })
                setMinimized(true)
              }}
              aria-label="最小化弹窗"
              className="ml-auto flex h-5 w-5 shrink-0 cursor-pointer items-center justify-center rounded text-current hover:bg-black/10 dark:hover:bg-white/10"
            >
              <Minus className="h-3.5 w-3.5 opacity-70" />
            </button>
          </div>
        )}
        <div className="min-h-0 flex-1 overflow-y-auto px-3.5 py-3">{children}</div>
        {footer && (
          <div className="flex shrink-0 items-center justify-end gap-1.5 border-t border-border/60 px-3 py-2">
            {footer}
          </div>
        )}
      </div>
    </div>
  )
}
