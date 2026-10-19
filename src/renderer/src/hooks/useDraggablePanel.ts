import { useRef } from 'react'
import type { MouseEvent as ReactMouseEvent, RefObject } from 'react'

export interface DraggablePanelOptions {
  position: { x: number; y: number }
  onPositionChange: (position: { x: number; y: number }) => void
  bounds: { min: number; right: number; bottom: number }
}

export function useDraggablePanel({ position, onPositionChange, bounds }: DraggablePanelOptions): {
  panelRef: RefObject<HTMLDivElement | null>
  handleHeaderMouseDown: (e: ReactMouseEvent) => void
} {
  const panelRef = useRef<HTMLDivElement>(null)
  const isDraggingRef = useRef(false)
  const dragStartRef = useRef<{ startX: number; startY: number; initX: number; initY: number }>({
    startX: 0,
    startY: 0,
    initX: 0,
    initY: 0
  })
  const currentDeltaRef = useRef<{ dx: number; dy: number }>({ dx: 0, dy: 0 })
  const rafIdRef = useRef<number | null>(null)

  const handleHeaderMouseDown = (e: ReactMouseEvent): void => {
    if ((e.target as HTMLElement).closest('button, input, select')) return
    e.preventDefault()
    e.stopPropagation()

    isDraggingRef.current = true
    dragStartRef.current = {
      startX: e.clientX,
      startY: e.clientY,
      initX: position.x,
      initY: position.y
    }
    currentDeltaRef.current = { dx: 0, dy: 0 }

    const handleMouseMove = (moveEvent: MouseEvent): void => {
      if (!isDraggingRef.current) return
      moveEvent.preventDefault()
      const dx = moveEvent.clientX - dragStartRef.current.startX
      const dy = moveEvent.clientY - dragStartRef.current.startY
      currentDeltaRef.current = { dx, dy }

      if (rafIdRef.current) cancelAnimationFrame(rafIdRef.current)
      rafIdRef.current = requestAnimationFrame(() => {
        if (panelRef.current) {
          panelRef.current.style.transform = `translate3d(${dx}px, ${dy}px, 0)`
        }
      })
    }

    const handleMouseUp = (): void => {
      if (!isDraggingRef.current) return
      isDraggingRef.current = false
      if (rafIdRef.current) cancelAnimationFrame(rafIdRef.current)

      const finalX = Math.max(
        bounds.min,
        Math.min(
          dragStartRef.current.initX + currentDeltaRef.current.dx,
          window.innerWidth - bounds.right
        )
      )
      const finalY = Math.max(
        bounds.min,
        Math.min(
          dragStartRef.current.initY + currentDeltaRef.current.dy,
          window.innerHeight - bounds.bottom
        )
      )

      if (panelRef.current) {
        panelRef.current.style.transform = ''
      }
      onPositionChange({ x: finalX, y: finalY })

      window.removeEventListener('mousemove', handleMouseMove)
      window.removeEventListener('mouseup', handleMouseUp)
    }

    window.addEventListener('mousemove', handleMouseMove)
    window.addEventListener('mouseup', handleMouseUp)
  }

  return { panelRef, handleHeaderMouseDown }
}
