import { CardLocation, DuelPuzzleState } from '@shared/index'

export function isDuelStarted(state: Pick<DuelPuzzleState, 'cards' | 'steps'>): boolean {
  if ((state.steps?.length ?? 0) > 0) return true
  return state.cards.some((c) => c.location === CardLocation.HAND)
}
