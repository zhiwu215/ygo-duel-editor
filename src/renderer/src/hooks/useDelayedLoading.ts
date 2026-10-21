import { useEffect, useRef, useState } from 'react'

const DEFAULT_DELAY_MS = 150
const DEFAULT_MIN_DURATION_MS = 300

export function useDelayedLoading(
  isLoading: boolean,
  delayMs = DEFAULT_DELAY_MS,
  minDurationMs = DEFAULT_MIN_DURATION_MS
): boolean {
  const [visible, setVisible] = useState(false)
  const shownAtRef = useRef(0)

  useEffect(() => {
    if (!isLoading) {
      if (!visible) return
      const remaining = minDurationMs - (performance.now() - shownAtRef.current)
      if (remaining <= 0) {
        setVisible(false)
        return
      }
      const timer = window.setTimeout(() => setVisible(false), remaining)
      return () => window.clearTimeout(timer)
    }

    if (visible) return
    const timer = window.setTimeout(() => {
      shownAtRef.current = performance.now()
      setVisible(true)
    }, delayMs)
    return () => window.clearTimeout(timer)
  }, [delayMs, isLoading, minDurationMs, visible])

  return visible
}
