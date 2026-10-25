import { useEffect } from 'react'
import type { DuelStep } from '@shared/index'
import { useDuelStore } from '../stores/useDuelStore'
import { useDuelEngineStore } from '../stores/useDuelEngineStore'
import { dropBlankEventSteps } from '../utils/stepSanitize'

export function useCleanupBlankReplaySteps(steps: DuelStep[]): void {
  useEffect(() => {
    if (useDuelStore.getState().sceneEditing) return
    const engine = useDuelEngineStore.getState()
    if (engine.isInitialized && !engine.replayInfo) return
    const next = dropBlankEventSteps(steps)
    if (next.length === steps.length) return
    const current = useDuelStore.getState()
    const selectedStillThere = next.some((step) => step.id === current.selectedStepId)
    useDuelStore.setState((prev) => ({
      ...prev,
      state: { ...prev.state, steps: next },
      selectedStepId: selectedStillThere ? prev.selectedStepId : (next[0]?.id ?? null),
      currentStepIndex: selectedStillThere
        ? prev.currentStepIndex === null
          ? null
          : Math.min(prev.currentStepIndex, Math.max(0, next.length - 1))
        : next.length > 0
          ? 0
          : null
    }))
  }, [steps])
}
