import { useDuelEngineStore } from '../stores/useDuelEngineStore'
import { useStagingStore } from '../stores/useStagingStore'

export function useLpCommit(): (
  player: 0 | 1,
  lp: number,
  localCommit: (lp: number) => void
) => void {
  return (player, lp, localCommit) => {
    const engine = useDuelEngineStore.getState()
    const stagingActive = useStagingStore.getState().session !== null
    if (engine.isInitialized && !stagingActive) {
      void engine.inject({ op: 'set-lp', player, lp })
      return
    }
    localCommit(lp)
  }
}
