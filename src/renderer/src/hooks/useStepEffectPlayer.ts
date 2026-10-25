import { useEffect } from 'react'
import { useDuelEngineStore } from '../stores/useDuelEngineStore'
import { STEP_EFFECT_DURATION_MS } from '../stores/duelEngine/stepEffectQueue'

export function useStepEffectPlayer(): void {
  const effectId = useDuelEngineStore((s) => s.stepEffects[0]?.id ?? 0)

  useEffect(() => {
    if (!effectId) return
    const timer = setTimeout(() => {
      useDuelEngineStore.getState().finishStepEffect(effectId)
    }, STEP_EFFECT_DURATION_MS)
    return () => clearTimeout(timer)
  }, [effectId])
}
