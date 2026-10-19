import { useEffect, useState } from 'react'
import { useDuelEngineStore } from '../stores/useDuelEngineStore'

export const HAND_SHUFFLE_PULSE_MS = 1600

export interface HandShufflePulse {
  tick: number
  active: boolean
}

export function useHandShufflePulse(controller: 0 | 1): HandShufflePulse {
  const signal = useDuelEngineStore((s) => s.handShuffle)
  const [expiredId, setExpiredId] = useState(0)
  const signalId = signal && signal.players.includes(controller) ? signal.id : 0

  useEffect(() => {
    if (!signalId) return
    const timer = setTimeout(() => setExpiredId(signalId), HAND_SHUFFLE_PULSE_MS)
    return () => clearTimeout(timer)
  }, [signalId])

  return { tick: signalId, active: signalId !== 0 && signalId !== expiredId }
}
