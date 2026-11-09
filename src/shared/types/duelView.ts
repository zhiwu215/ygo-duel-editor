import type { DuelPuzzleState } from './duel'

export const DEFAULT_VIEW_TOP_SEAT: 0 | 1 = 1

const otherSeat = (seat: 0 | 1): 0 | 1 => (seat === 0 ? 1 : 0)

export function viewTopSeatOf(state: DuelPuzzleState): 0 | 1 {
  return state.viewTopSeat === 0 ? 0 : DEFAULT_VIEW_TOP_SEAT
}

export function viewBottomSeatOf(state: DuelPuzzleState): 0 | 1 {
  return otherSeat(viewTopSeatOf(state))
}

export function flipViewTopSeat(state: DuelPuzzleState): 0 | 1 {
  return otherSeat(viewTopSeatOf(state))
}
