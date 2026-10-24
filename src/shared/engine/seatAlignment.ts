import type { DuelPuzzleState, Duelist } from '../types/duel'
import { isStandardTag } from '../types/duelFactory'
import { mirrorDuelSeats } from './sideSwap'

export function firstDuelistOf(state: DuelPuzzleState): Duelist | undefined {
  const duelists = state.duelists ?? []
  return (
    duelists.find((duelist) => duelist.turnOrder === 1) ??
    duelists.find((duelist) => duelist.isFirst) ??
    duelists[0]
  )
}

export function alignFirstPlayerSeat(state: DuelPuzzleState): DuelPuzzleState {
  if (isStandardTag(state.matchConfig)) return state
  const first = firstDuelistOf(state)
  return first && first.team === 1 ? mirrorDuelSeats(state) : state
}
