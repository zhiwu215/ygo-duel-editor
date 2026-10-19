import { useEffect, useRef, useState } from 'react'
import { isInfiniteVal } from '@shared/index'

export function useAnimatedNumber(value: number, duration = 400): number {
  const [display, setDisplay] = useState(value)
  const displayRef = useRef(value)

  useEffect(() => {
    const from = displayRef.current
    if (from === value) return
    if (isInfiniteVal(from) || isInfiniteVal(value)) {
      displayRef.current = value
      setDisplay(value)
      return
    }

    let frame = 0
    const start = performance.now()
    const step = (now: number): void => {
      const progress = Math.min(1, (now - start) / duration)
      const eased = 1 - Math.pow(1 - progress, 3)
      const next = Math.round(from + (value - from) * eased)
      displayRef.current = next
      setDisplay(next)
      if (progress < 1) frame = requestAnimationFrame(step)
    }
    frame = requestAnimationFrame(step)
    return () => cancelAnimationFrame(frame)
  }, [value, duration])

  return display
}
