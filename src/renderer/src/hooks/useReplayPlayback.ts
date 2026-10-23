import { useCallback, useEffect, useRef, useState } from 'react'
import { useDuelEngineStore } from '../stores/useDuelEngineStore'

const BASE_INTERVAL_MS = 1500

export const REPLAY_SPEEDS = [0.5, 1, 1.5, 2, 3] as const

interface UseReplayPlaybackOptions {
  enabled: boolean
  stepIndex: number | null
  stepCount: number
  onNext: () => void
  onPrev: () => void
  onReset: () => void
}

export function useReplayPlayback({
  enabled,
  stepIndex,
  stepCount,
  onNext,
  onPrev,
  onReset
}: UseReplayPlaybackOptions): {
  playing: boolean
  speed: number
  speeds: readonly number[]
  atEnd: boolean
  setSpeed: (speed: number) => void
  toggle: () => void
  pause: () => void
} {
  const [playing, setPlaying] = useState(false)
  const [speed, setSpeed] = useState(1)
  const [tick, setTick] = useState(0)
  const loading = useDuelEngineStore((state) => state.loading)
  const nextRef = useRef(onNext)
  const prevRef = useRef(onPrev)
  const resetRef = useRef(onReset)

  useEffect(() => {
    nextRef.current = onNext
  }, [onNext])

  useEffect(() => {
    prevRef.current = onPrev
  }, [onPrev])

  useEffect(() => {
    resetRef.current = onReset
  }, [onReset])

  const atEnd = stepCount > 0 && stepIndex !== null && stepIndex >= stepCount - 1
  const canToggle = enabled && stepCount > 0
  const active = playing && canToggle && !atEnd

  useEffect(() => {
    if (!active || loading) return
    const timer = window.setTimeout(() => {
      setTick((value) => value + 1)
      nextRef.current()
    }, BASE_INTERVAL_MS / speed)
    return () => window.clearTimeout(timer)
  }, [active, loading, speed, tick, stepIndex])

  const toggle = useCallback(() => {
    if (!canToggle) return
    if (atEnd) {
      resetRef.current()
      setPlaying(true)
      return
    }
    setPlaying((value) => !value)
  }, [canToggle, atEnd])

  const pause = useCallback(() => {
    setPlaying(false)
  }, [])

  useEffect(() => {
    if (!enabled) return
    const onKeyDown = (event: KeyboardEvent): void => {
      if (event.repeat || event.defaultPrevented) return
      if (document.querySelector('[role="dialog"]')) return
      const target = event.target as HTMLElement | null
      if (
        target &&
        (target.tagName === 'INPUT' ||
          target.tagName === 'TEXTAREA' ||
          target.isContentEditable ||
          target.closest('[role="dialog"], [role="menu"], [role="listbox"]') !== null)
      ) {
        return
      }
      if (event.code === 'Space') {
        event.preventDefault()
        toggle()
        return
      }
      if (target?.tagName === 'SELECT') return
      if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return
      event.preventDefault()
      pause()
      if (event.key === 'ArrowLeft') prevRef.current()
      else nextRef.current()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [enabled, toggle, pause])

  return {
    playing: active,
    speed,
    speeds: REPLAY_SPEEDS,
    atEnd,
    setSpeed,
    toggle,
    pause
  }
}
