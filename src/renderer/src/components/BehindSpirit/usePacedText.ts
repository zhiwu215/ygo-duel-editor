import { useEffect, useRef, useState } from 'react'

const DEFAULT_INTERVAL_MS = 60

export function usePacedText(
  value: string,
  active: boolean,
  intervalMs = DEFAULT_INTERVAL_MS
): string {
  const [paced, setPaced] = useState(value)
  const lastFlushRef = useRef(0)

  useEffect(() => {
    if (!active || value === paced) return
    const elapsed = Date.now() - lastFlushRef.current
    const timer = window.setTimeout(
      () => {
        lastFlushRef.current = Date.now()
        setPaced(value)
      },
      elapsed >= intervalMs ? 0 : intervalMs - elapsed
    )
    return () => window.clearTimeout(timer)
  }, [active, intervalMs, paced, value])

  return active ? paced : value
}
