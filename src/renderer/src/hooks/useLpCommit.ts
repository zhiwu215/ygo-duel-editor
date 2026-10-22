import { useDuelEngineStore } from '../stores/useDuelEngineStore'

export function useLpCommit(): (
  player: 0 | 1,
  lp: number,
  localCommit: (lp: number) => void
) => void {
  return (player, lp, localCommit) => {
    const engine = useDuelEngineStore.getState()
    if (engine.isInitialized) {
      void engine.inject({ op: 'set-lp', player, lp })
      return
    }
    localCommit(lp)
  }
}
