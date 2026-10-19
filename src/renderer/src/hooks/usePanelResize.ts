import { useCallback } from 'react'
import type { MouseEvent as ReactMouseEvent } from 'react'

export function usePanelResize(
  getStartWidth: () => number,
  onResize: (width: number) => void
): (e: ReactMouseEvent) => void {
  return useCallback(
    (e: ReactMouseEvent): void => {
      e.preventDefault()
      const startX = e.clientX
      const startWidth = getStartWidth()

      const handleMouseMove = (moveEvent: MouseEvent): void => {
        const deltaX = moveEvent.clientX - startX
        onResize(startWidth + deltaX)
      }

      const handleMouseUp = (): void => {
        window.removeEventListener('mousemove', handleMouseMove)
        window.removeEventListener('mouseup', handleMouseUp)
      }

      window.addEventListener('mousemove', handleMouseMove)
      window.addEventListener('mouseup', handleMouseUp)
    },
    [getStartWidth, onResize]
  )
}
