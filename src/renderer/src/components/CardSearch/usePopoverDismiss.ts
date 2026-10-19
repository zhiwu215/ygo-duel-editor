import { useEffect, type RefObject } from 'react'

export function usePopoverDismiss(
  rootRef: RefObject<HTMLDivElement | null>,
  anchorRef: RefObject<HTMLElement | null>,
  onClose: () => void
): void {
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
  }, [rootRef, anchorRef, onClose])
}
