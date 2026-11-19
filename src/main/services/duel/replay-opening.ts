import { CardLocation, CardPosition, orderPrivatePilePlacements } from '@shared/index'
import type { DuelPuzzleState, FieldCard } from '@shared/index'

export interface ReplayOpening {
  state: DuelPuzzleState
  hands: [FieldCard[], FieldCard[]]
}

export function buildReplayOpening(state: DuelPuzzleState): ReplayOpening {
  const cards = state.cards.filter((card) => card.code > 0)
  const pileOf = (player: 0 | 1, location: number): FieldCard[] =>
    orderPrivatePilePlacements(
      location,
      cards.filter((card) => card.controller === player && card.location === location)
    ).map(({ card }) => card)

  const hands: ReplayOpening['hands'] = [pileOf(0, CardLocation.HAND), pileOf(1, CardLocation.HAND)]
  const board = cards.filter(
    (card) => card.location !== CardLocation.DECK && card.location !== CardLocation.HAND
  )
  for (const player of [0, 1] as const) {
    const deck = [...hands[player], ...pileOf(player, CardLocation.DECK)]
    board.push(
      ...deck.map((card, sequence) => ({
        ...card,
        location: CardLocation.DECK,
        position: CardPosition.FACEDOWN_DEFENSE,
        sequence
      }))
    )
  }

  return {
    hands,
    state: {
      ...state,
      cards: board,
      players: [
        { ...state.players[0], startHand: hands[0].length },
        { ...state.players[1], startHand: hands[1].length }
      ]
    }
  }
}
