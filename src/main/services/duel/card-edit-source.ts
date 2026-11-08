import { isPileLocation, placeholderCardData } from '@shared/index'
import { cdbService } from '../../db/cdbService'
import type { SessionState } from './session-state'
import type { ProvenanceOrigin } from './provenance-tracker'

export type CardEditAction = { type: 'replace'; code: number } | { type: 'remove' }

export function applyCardEditSource(
  state: SessionState,
  origin: ProvenanceOrigin,
  action: CardEditAction
): boolean {
  if (origin.kind === 'inject') {
    const op = state.ops[origin.opIndex]
    if (op?.type !== 'inject' || op.command.op !== 'add-card') return false
    state.ops[origin.opIndex] =
      action.type === 'remove'
        ? { ...op, removed: true }
        : { ...op, command: { ...op.command, code: action.code } }
    return true
  }

  const puzzleState = state.initParams?.puzzleState
  if (!puzzleState) return false
  const target = puzzleState.cards.find((card) => card.instanceId === origin.puzzleCardId)
  if (!target || target.code !== origin.code) return false
  if (action.type === 'remove') {
    puzzleState.cards = puzzleState.cards.filter((card) => card.instanceId !== origin.puzzleCardId)
    if (puzzleState.initialBoardSnapshot) {
      puzzleState.initialBoardSnapshot = puzzleState.initialBoardSnapshot.filter(
        (snap) => snap.instanceId !== origin.puzzleCardId
      )
    }
    return true
  }

  target.code = action.code
  target.card =
    cdbService.getCardById(action.code) ?? placeholderCardData(action.code) ?? target.card
  if (puzzleState.initialBoardSnapshot) {
    for (const snap of puzzleState.initialBoardSnapshot) {
      if (snap.instanceId === origin.puzzleCardId) snap.code = action.code
    }
  }
  return true
}

export function cardEditOriginCandidates(
  state: SessionState,
  origin: ProvenanceOrigin
): ProvenanceOrigin[] {
  if (origin.kind !== 'initial') return [origin]
  const puzzleState = state.initParams?.puzzleState
  if (!puzzleState) return [origin]
  const source = puzzleState.cards.find((card) => card.instanceId === origin.puzzleCardId)
  if (!source) return [origin]

  const sameCode = puzzleState.cards
    .filter(
      (card) =>
        card.instanceId !== source.instanceId &&
        card.code === source.code &&
        card.controller === source.controller
    )
    .sort(
      (left, right) =>
        locationRank(left.location, source.location) -
          locationRank(right.location, source.location) || left.sequence - right.sequence
    )
    .map((card): ProvenanceOrigin => ({
      kind: 'initial',
      puzzleCardId: card.instanceId,
      code: card.code
    }))

  return [origin, ...sameCode]
}

function locationRank(location: number, sourceLocation: number): number {
  if (location === sourceLocation) return 0
  return isPileLocation(location) === isPileLocation(sourceLocation) ? 1 : 2
}
