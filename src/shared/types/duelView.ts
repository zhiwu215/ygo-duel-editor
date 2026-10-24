import type { DuelPuzzleState } from './duel'

export const DEFAULT_VIEW_TOP_SEAT: 0 | 1 = 1

export function viewTopSeatOf(state: DuelPuzzleState): 0 | 1 {
  return state.viewTopSeat === 0 ? 0 : DEFAULT_VIEW_TOP_SEAT
}

export function flipViewTopSeat(state: DuelPuzzleState): 0 | 1 {
  return viewTopSeatOf(state) === 0 ? 1 : 0
}
