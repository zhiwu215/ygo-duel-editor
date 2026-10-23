import { CardLocation } from '../constants/locations'
import { DuelPuzzleState, Duelist } from '../types/duel'
import { createStandardTagDuelists } from '../types/duelFactory'

export interface TagHandMismatch {
  team: 0 | 1
  names: [string, string]
  counts: [number, number]
}

function seatsOfTeam(duelists: Duelist[], team: 0 | 1): [Duelist, Duelist] | null {
  const fallback = duelists.filter((duelist) => duelist.team === team)
  const first =
    duelists.find((duelist) => duelist.id === `duelist_${team}_0`) ?? fallback[0] ?? null
  const second =
    duelists.find((duelist) => duelist.id === `duelist_${team}_1`) ?? fallback[1] ?? null
  return first && second ? [first, second] : null
}

export function findTagHandMismatches(state: DuelPuzzleState): TagHandMismatch[] {
  const duelists =
    state.duelists && state.duelists.length === 4 ? state.duelists : createStandardTagDuelists()
  const countHand = (duelistId: string): number =>
    state.cards.filter(
      (card) => card.code > 0 && card.duelistId === duelistId && card.location === CardLocation.HAND
    ).length

  const mismatches: TagHandMismatch[] = []
  for (const team of [0, 1] as const) {
    const seats = seatsOfTeam(duelists, team)
    if (!seats) continue
    const counts: [number, number] = [countHand(seats[0].id), countHand(seats[1].id)]
    if (counts[0] !== counts[1]) {
      mismatches.push({ team, names: [seats[0].name, seats[1].name], counts })
    }
  }
  return mismatches
}

export function formatTagHandMismatches(): string {
  return '标准 2v2 要求同队两名决斗者手牌数相同\n\n请调整同队手牌，或改用「2 v 2 独立 LP」做近似校验'
}
