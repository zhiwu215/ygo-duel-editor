import type { Answer, RequestCard } from '@shared/engine/protocol'
import type { EngineBoardState } from '@shared/index'
import type { SessionState } from './session-state'

export interface CardPosition {
  controller: 0 | 1
  location: number
  sequence: number
}

type CardMatch = (card: RequestCard) => boolean

function forEachAnswerCard(answer: Answer, visit: (card: RequestCard) => void): void {
  switch (answer.kind) {
    case 'idle':
    case 'battle':
    case 'chain':
    case 'unselect':
      if (answer.card) visit(answer.card)
      return
    case 'card':
    case 'tribute':
    case 'sum':
    case 'sort':
      for (const card of answer.cards ?? []) visit(card)
      return
    case 'counter':
      for (const entry of answer.counters) visit(entry.card)
      return
    default:
      return
  }
}

function remapAnswer(answer: Answer, newCode: number, match: CardMatch): boolean {
  let changed = false
  forEachAnswerCard(answer, (card) => {
    if (!match(card)) return
    card.code = newCode
    changed = true
  })
  return changed
}

function cardAt(nodeBoard: EngineBoardState, position: CardPosition, code: number): boolean {
  return nodeBoard.allCards.some(
    (card) =>
      card.controller === position.controller &&
      card.location === position.location &&
      card.sequence === position.sequence &&
      card.code === code
  )
}

function remapSetAction(
  state: SessionState,
  oldCode: number,
  newCode: number,
  position: CardPosition
): void {
  const nodes = state.timeline
    .getAllNodes()
    .filter((node) => node.opIndex >= 0)
    .sort((a, b) => a.opIndex - b.opIndex)
  const first = nodes.find((node) => cardAt(node.boardState, position, oldCode))
  if (!first) return
  for (let index = first.opIndex; index >= 0; index--) {
    const op = state.ops[index]
    if (op?.type !== 'answer' || !op.answers) continue
    const match: CardMatch = (card) => card.code === oldCode
    let changed = false
    for (const recorded of op.answers) {
      if (remapAnswer(recorded.answer, newCode, match)) changed = true
    }
    if (changed) return
  }
}

export function attachAnswerInstanceIds(answer: Answer, board: EngineBoardState): void {
  forEachAnswerCard(answer, (card) => {
    const engineCard = board.allCards.find(
      (item) =>
        item.controller === card.controller &&
        item.location === card.location &&
        item.sequence === card.sequence &&
        item.code === card.code
    )
    if (engineCard) card.instanceId = engineCard.instanceId
  })
}

export function remapRecordedAnswers(
  state: SessionState,
  oldCode: number,
  newCode: number,
  positions: CardPosition[],
  instanceId?: string
): void {
  const current = positions[0]
  let instanceChanged = false
  for (const op of state.ops) {
    if (op.type === 'inject' || !op.answers) continue
    const instanceMatch: CardMatch = (card) =>
      card.code === oldCode && Boolean(instanceId) && card.instanceId === instanceId
    const positionMatch: CardMatch = (card) =>
      card.code === oldCode &&
      Boolean(current) &&
      card.controller === current.controller &&
      card.location === current.location &&
      card.sequence === current.sequence
    for (const recorded of op.answers) {
      if (remapAnswer(recorded.answer, newCode, instanceMatch)) instanceChanged = true
      remapAnswer(recorded.answer, newCode, positionMatch)
    }
  }
  if (current && !instanceChanged) {
    remapSetAction(state, oldCode, newCode, current)
  }
}
