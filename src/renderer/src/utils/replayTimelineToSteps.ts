import {
  CardLocation,
  CardPosition,
  DuelActionType,
  DuelStep,
  EngineBoardState,
  EngineTimelineNode
} from '@shared/index'
import { resolveCardName } from './cardNames'
import { mapPhaseToDuelPhase } from '../stores/duelEngine/boardReconcile'

interface ReplayCardMove {
  code: number
  fromLocation?: number
  fromSequence?: number
  toLocation: number
  toSequence: number
  position: number
}

const FIELD_ZONE_LOCATIONS: number[] = [
  CardLocation.MZONE,
  CardLocation.SZONE,
  CardLocation.FZONE,
  CardLocation.PZONE
]

function humanizeReplayTitle(title: string): string {
  return title.replace(/^Player 0[:：]?\s*/, '我方：').replace(/^Player 1[:：]?\s*/, '对方：')
}

function humanizeReplayLog(line: string): string {
  return line
    .replace(/^Player 0/, '我方')
    .replace(/^Player 1/, '对方')
    .replace(/^--- (.+) ---$/, '$1')
}

function isFacedown(position: number): boolean {
  return (position & CardPosition.FACEDOWN) !== 0
}

function moveTier(from: number | undefined, to: number): number {
  if (from !== to && FIELD_ZONE_LOCATIONS.includes(to)) return 0
  if (from !== undefined && from !== to) return 1
  return 2
}

function findReplayCardMove(
  prev: EngineBoardState | undefined,
  curr: EngineBoardState
): ReplayCardMove | undefined {
  if (!prev) return undefined
  const prevById = new Map(prev.allCards.map((card) => [card.instanceId, card]))
  let best: { move: ReplayCardMove; tier: number } | undefined
  for (const card of curr.allCards) {
    const before = prevById.get(card.instanceId)
    if (before && before.location === card.location && before.sequence === card.sequence) continue
    const move: ReplayCardMove = {
      code: card.code,
      fromLocation: before?.location,
      fromSequence: before?.sequence,
      toLocation: card.location,
      toSequence: card.sequence,
      position: card.position
    }
    const tier = moveTier(before?.location, card.location)
    if (!best || tier < best.tier) best = { move, tier }
  }
  return best?.move
}

function classifyReplayMove(move: ReplayCardMove): DuelActionType {
  if (move.toLocation === CardLocation.MZONE) {
    return isFacedown(move.position) ? 'SET_MONSTER' : 'SPECIAL_SUMMON'
  }
  if (move.toLocation === CardLocation.SZONE) {
    return isFacedown(move.position) ? 'SET_SPELL_TRAP' : 'ACTIVATE'
  }
  switch (move.toLocation) {
    case CardLocation.FZONE:
      return 'ACTIVATE_FIELD'
    case CardLocation.PZONE:
      return 'SET_PENDULUM'
    case CardLocation.GRAVE:
      return 'TO_GRAVE'
    case CardLocation.REMOVED:
      return 'BANISH'
    case CardLocation.HAND:
      return 'TO_HAND'
    case CardLocation.DECK:
    case CardLocation.EXTRA:
      return 'TO_DECK'
    default:
      return 'ACTIVATE'
  }
}

function classifyNonMoveAction(
  prev: EngineBoardState | undefined,
  curr: EngineBoardState
): DuelActionType {
  if (!prev) return 'EVENT'
  const [lp0, lp1] = [
    curr.players[0].lp - prev.players[0].lp,
    curr.players[1].lp - prev.players[1].lp
  ]
  if (lp0 < 0 || lp1 < 0) return 'DAMAGE'
  if (lp0 > 0 || lp1 > 0) return 'RECOVER'
  return 'EVENT'
}

function describeReplayStep(move: ReplayCardMove | undefined, node: EngineTimelineNode): string {
  if (move) return humanizeReplayTitle(node.title)
  if (node.logs.length > 0) {
    return node.logs.map(humanizeReplayLog).join('；')
  }
  return humanizeReplayTitle(node.title)
}

export function buildReplaySteps(timeline: EngineTimelineNode[]): DuelStep[] {
  return timeline.slice(1).map((node, index) => {
    const prev = timeline[index]
    const move = findReplayCardMove(prev?.boardState, node.boardState)
    return {
      id: `replay_${node.id}`,
      actId: node.id,
      turn: node.boardState.turn,
      turnPlayer: node.boardState.turnPlayer,
      phase: mapPhaseToDuelPhase(node.boardState.phase),
      actionPlayer: node.player,
      actionType: move
        ? classifyReplayMove(move)
        : classifyNonMoveAction(prev?.boardState, node.boardState),
      cardCode: move?.code,
      cardName: move ? resolveCardName(move.code) : undefined,
      fromLocation: move?.fromLocation,
      fromSequence: move?.fromSequence,
      toLocation: move?.toLocation,
      toSequence: move?.toSequence,
      description: describeReplayStep(move, node)
    }
  })
}
