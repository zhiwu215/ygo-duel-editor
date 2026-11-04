import { useEffect } from 'react'
import { useDuelEngineStore } from '../stores/useDuelEngineStore'
import { stepEffectDurationMs } from '../stores/duelEngine/stepEffectQueue'

export function useStepEffectPlayer(): void {
  const effect = useDuelEngineStore((s) => s.stepEffects[0] ?? null)
  const effectId = effect?.id ?? 0
  const duration = effect ? stepEffectDurationMs(effect) : 0

  useEffect(() => {
    if (!effectId) return
    const timer = setTimeout(() => {
      useDuelEngineStore.getState().finishStepEffect(effectId)
    }, duration)
    return () => clearTimeout(timer)
  }, [effectId, duration])
}
