import type { DuelPuzzleState, Duelist, FieldCard } from '../types/duel'
import type { DuelLogCardRef, DuelLogEvent } from '../types/duelLog'
import type { DuelStep, LightweightCardSnapshot, ManualOp } from '../types/story'
import { flipViewTopSeat } from '../types/duelView'

const flipSide = (side: 0 | 1): 0 | 1 => (side === 0 ? 1 : 0)

const flipOptionalSide = (side: 0 | 1 | undefined): 0 | 1 | undefined =>
  side === undefined ? undefined : flipSide(side)

const flipCard = (card: DuelLogCardRef): DuelLogCardRef => ({
  ...card,
  controller: flipSide(card.controller)
})

const flipOptionalCard = (card: DuelLogCardRef | undefined): DuelLogCardRef | undefined =>
  card ? flipCard(card) : undefined

const flipLogEvent = (event: DuelLogEvent): DuelLogEvent => {
  switch (event.kind) {
    case 'turn-start':
      return { ...event, player: flipSide(event.player) }
    case 'summon':
    case 'set':
    case 'activate':
      return { ...event, card: flipCard(event.card), from: flipOptionalCard(event.from) }
    case 'chain-solving':
    case 'chain-negated':
    case 'attack-disabled':
      return { ...event, card: flipOptionalCard(event.card) }
    case 'move':
      return {
        ...event,
        move: {
          ...event.move,
          card: flipCard(event.move.card),
          from: flipOptionalCard(event.move.from),
          to: flipCard(event.move.to)
        }
      }
    case 'target':
    case 'reveal':
      return { ...event, cards: event.cards.map(flipCard) }
    case 'attack':
      return {
        ...event,
        attacker: flipCard(event.attacker),
        defender: flipOptionalCard(event.defender)
      }
    case 'draw':
    case 'damage':
    case 'recover':
    case 'lp-update':
      return { ...event, player: flipSide(event.player) }
    case 'position':
    case 'counter':
      return { ...event, card: flipCard(event.card) }
    case 'swap':
      return { ...event, from: flipCard(event.from), to: flipCard(event.to) }
    default:
      return event
  }
}

const flipSnapshot = (card: LightweightCardSnapshot): LightweightCardSnapshot => ({
  ...card,
  controller: flipSide(card.controller),
  owner: flipOptionalSide(card.owner)
})

const flipManualOp = (op: ManualOp): ManualOp => {
  switch (op.type) {
    case 'move':
      return op.toController === undefined ? op : { ...op, toController: flipSide(op.toController) }
    case 'add':
      return { ...op, controller: flipSide(op.controller) }
    case 'lp':
      return { ...op, player: flipSide(op.player) }
    default:
      return op
  }
}

const flipStep = (step: DuelStep): DuelStep => ({
  ...step,
  turnPlayer: flipSide(step.turnPlayer),
  actionPlayer: flipSide(step.actionPlayer),
  fromController: flipOptionalSide(step.fromController),
  toController: flipOptionalSide(step.toController),
  targetPlayer: flipOptionalSide(step.targetPlayer),
  lpChange: step.lpChange
    ? { ...step.lpChange, player: flipSide(step.lpChange.player) }
    : undefined,
  boardAfter: step.boardAfter?.map(flipSnapshot),
  manualOps: step.manualOps?.map(flipManualOp),
  logEvents: step.logEvents?.map(flipLogEvent)
})

export function mirrorDuelSeats(state: DuelPuzzleState): DuelPuzzleState {
  return {
    ...state,
    cards: state.cards.map((card): FieldCard => ({
      ...card,
      controller: flipSide(card.controller),
      owner: flipSide(card.owner)
    })),
    duelists: state.duelists?.map((duelist): Duelist => ({
      ...duelist,
      team: flipSide(duelist.team)
    })),
    players: [state.players[1], state.players[0]],
    turnPlayer: flipSide(state.turnPlayer),
    viewTopSeat: flipViewTopSeat(state),
    matchConfig: state.matchConfig
      ? {
          ...state.matchConfig,
          team0Count: state.matchConfig.team1Count,
          team1Count: state.matchConfig.team0Count
        }
      : state.matchConfig,
    initialBoardSnapshot: state.initialBoardSnapshot?.map(flipSnapshot),
    initialLp: state.initialLp ? [state.initialLp[1], state.initialLp[0]] : state.initialLp,
    steps: state.steps?.map(flipStep)
  }
}
