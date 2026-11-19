import { useMemo } from 'react'
import { engineHistoryTargets } from '../stores/duelEngine/historyTargets'
import { useDuelEngineStore } from '../stores/useDuelEngineStore'
import { useDuelStore } from '../stores/useDuelStore'

export function useEngineHistoryTargets(): ReturnType<typeof engineHistoryTargets> {
  const timeline = useDuelEngineStore((state) => state.timeline)
  const currentStepId = useDuelEngineStore((state) => state.currentStepId)
  const isReplay = useDuelEngineStore((state) => state.replayInfo !== null)
  const loading = useDuelEngineStore((state) => state.loading)
  const steps = useDuelStore((state) => state.state.steps)

  return useMemo(
    () => (loading ? {} : engineHistoryTargets(timeline, currentStepId, steps, isReplay)),
    [timeline, currentStepId, steps, isReplay, loading]
  )
}
