import { useDuelEngineStore } from '../stores/useDuelEngineStore'

export interface HandShufflePulse {
  tick: number
  active: boolean
}

export function useHandShufflePulse(controller: 0 | 1, duelistId?: string): HandShufflePulse {
  const effect = useDuelEngineStore((s) => s.stepEffects[0] ?? null)
  const shuffled = effect && effect.kind === 'shuffle-hand' ? effect : null
  const matches =
    shuffled !== null &&
    (shuffled.duelistId ? shuffled.duelistId === duelistId : shuffled.player === controller)
  const effectId = shuffled && matches ? shuffled.id : 0

  return { tick: effectId, active: Boolean(effectId) }
}
