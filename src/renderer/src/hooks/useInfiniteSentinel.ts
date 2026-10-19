import { useEffect, type RefObject } from 'react'

export function useInfiniteSentinel(
  sentinelRef: RefObject<HTMLDivElement | null>,
  enabled: boolean,
  onIntersect: () => void,
  refreshKey: number
): void {
  useEffect(() => {
    if (!enabled) return
    const node = sentinelRef.current
    if (!node) return
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) void onIntersect()
      },
      { rootMargin: '320px' }
    )
    observer.observe(node)
    return () => observer.disconnect()
  }, [sentinelRef, enabled, onIntersect, refreshKey])
}
