import { useEffect, type RefObject } from 'react'

export interface DismissOptions {
  resize?: boolean
  contextmenu?: boolean
  capture?: boolean
  preventDefaultOnEscape?: boolean
}

export function useDismissOnOutside(
  ref: RefObject<HTMLElement | null> | null,
  active: boolean,
  onClose: () => void,
  options: DismissOptions = {}
): void {
  const {
    resize = true,
    contextmenu = false,
    capture = false,
    preventDefaultOnEscape = false
  } = options

  useEffect(() => {
    if (!active) return

    const handlePointerDown = (e: MouseEvent): void => {
      if (ref && ref.current && ref.current.contains(e.target as Node)) return
      onClose()
    }

    const handleKeyDown = (e: KeyboardEvent): void => {
      if (e.key !== 'Escape') return
      if (preventDefaultOnEscape) {
        e.preventDefault()
        e.stopPropagation()
        e.stopImmediatePropagation()
      }
      onClose()
    }

    window.addEventListener('mousedown', handlePointerDown)
    window.addEventListener('keydown', handleKeyDown, { capture })
    if (resize) window.addEventListener('resize', onClose)
    if (contextmenu) window.addEventListener('contextmenu', handlePointerDown)

    return () => {
      window.removeEventListener('mousedown', handlePointerDown)
      window.removeEventListener('keydown', handleKeyDown, { capture })
      if (resize) window.removeEventListener('resize', onClose)
      if (contextmenu) window.removeEventListener('contextmenu', handlePointerDown)
    }
  }, [ref, active, onClose, resize, contextmenu, capture, preventDefaultOnEscape])
}
