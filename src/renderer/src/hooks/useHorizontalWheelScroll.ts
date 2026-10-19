import { useEffect, type RefObject } from 'react'

export interface HorizontalWheelScrollOptions {
  scrollRef?: RefObject<HTMLElement | null> | null
  canHandle?: () => boolean
  skipWhenNoOverflow?: boolean
  stopPropagationAtEdges?: boolean
}

export function useHorizontalWheelScroll(
  listenerRef: RefObject<HTMLElement | null>,
  options: HorizontalWheelScrollOptions = {}
): void {
  const {
    scrollRef = null,
    canHandle,
    skipWhenNoOverflow = false,
    stopPropagationAtEdges = false
  } = options

  useEffect(() => {
    const el = listenerRef.current
    if (!el) return
    const onWheel = (e: WheelEvent): void => {
      if (e.deltaY === 0) return
      if (canHandle && !canHandle()) return
      const box = scrollRef ? scrollRef.current : el
      if (!box) return
      const maxScroll = box.scrollWidth - box.clientWidth
      if (skipWhenNoOverflow && maxScroll <= 0) return
      e.preventDefault()
      const next = box.scrollLeft + e.deltaY
      if (stopPropagationAtEdges && (next <= 0 || next >= maxScroll)) {
        e.stopPropagation()
      }
      box.scrollLeft = next
    }
    el.addEventListener('wheel', onWheel, { passive: false })
    return () => el.removeEventListener('wheel', onWheel)
  })
}
