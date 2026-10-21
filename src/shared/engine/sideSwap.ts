import { DuelPuzzleState, FieldCard, Duelist } from '../types/duel'
import { LightweightCardSnapshot } from '../types/story'

const flipSide = (side: 0 | 1): 0 | 1 => (side === 0 ? 1 : 0)

const SEAT_NAME = /^(我方|对方)(.*)$/

const seatNameOf = (duelist: Duelist): string => {
  const matched = SEAT_NAME.exec(duelist.name)
  if (!matched) return duelist.name
  return `${duelist.team === 0 ? '我方' : '对方'}${matched[2]}`
}

const flipSnapshot = (card: LightweightCardSnapshot): LightweightCardSnapshot => ({
  ...card,
  controller: flipSide(card.controller),
  owner: card.owner === undefined ? undefined : flipSide(card.owner)
})

export function swapDuelSides(state: DuelPuzzleState): DuelPuzzleState {
  return {
    ...state,
    cards: state.cards.map((card): FieldCard => ({
      ...card,
      controller: flipSide(card.controller),
      owner: flipSide(card.owner)
    })),
    duelists: state.duelists?.map((duelist): Duelist => {
      const flipped = { ...duelist, team: flipSide(duelist.team) }
      return { ...flipped, name: seatNameOf(flipped) }
    }),
    players: [state.players[1], state.players[0]],
    turnPlayer: flipSide(state.turnPlayer),
    matchConfig: state.matchConfig
      ? {
          ...state.matchConfig,
          team0Count: state.matchConfig.team1Count,
          team1Count: state.matchConfig.team0Count
        }
      : state.matchConfig,
    initialBoardSnapshot: state.initialBoardSnapshot?.map(flipSnapshot),
    initialLp: state.initialLp ? [state.initialLp[1], state.initialLp[0]] : state.initialLp
  }
}
