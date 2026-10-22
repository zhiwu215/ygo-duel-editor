import { useEffect, useRef, useState } from 'react'

const DEFAULT_INTERVAL_MS = 50

export function usePacedText(
  value: string,
  active: boolean,
  intervalMs = DEFAULT_INTERVAL_MS
): string {
  const [paced, setPaced] = useState(value)
  const latestRef = useRef(value)

  useEffect(() => {
    latestRef.current = value
  }, [value])

  useEffect(() => {
    if (!active) return
    const timer = window.setInterval(() => {
      setPaced((current) => (current === latestRef.current ? current : latestRef.current))
    }, intervalMs)
    return () => window.clearInterval(timer)
  }, [active, intervalMs])

  return active ? paced : value
}
