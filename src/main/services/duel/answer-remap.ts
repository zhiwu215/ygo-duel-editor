import type { Answer, RequestCard } from '@shared/engine/protocol'
import { CardLocation, type EngineBoardState } from '@shared/index'
import type { SessionState } from './session-state'
import { forEachAnswerCard } from './answer-cards'

export interface CardPosition {
  controller: 0 | 1
  location: number
  sequence: number
}

type CardMatch = (card: RequestCard) => boolean

const FIELD_LOCATIONS: ReadonlySet<number> = new Set<number>([
  CardLocation.MZONE,
  CardLocation.SZONE,
  CardLocation.FZONE,
  CardLocation.PZONE
])

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

function answerHasCode(answer: Answer, code: number): boolean {
  let found = false
  forEachAnswerCard(answer, (card) => {
    if (card.code === code) found = true
  })
  return found
}

function findEntryAnswer(state: SessionState, entryOpIndex: number, oldCode: number): number {
  for (let index = entryOpIndex; index >= 0; index--) {
    const op = state.ops[index]
    if (!op || op.type === 'inject') return -1
    if (op.type !== 'answer' || !op.answers) continue
    if (op.answers.some((recorded) => answerHasCode(recorded.answer, oldCode))) return index
  }
  return -1
}

function remapEnterFieldAction(
  state: SessionState,
  oldCode: number,
  newCode: number,
  position: CardPosition
): void {
  const path = state.timeline.getHistoryPath()
  const current = path[path.length - 1]
  if (!current || !cardAt(current.boardState, position, oldCode)) return
  let entry = current
  for (let index = path.length - 2; index >= 0; index--) {
    if (!cardAt(path[index].boardState, position, oldCode)) break
    entry = path[index]
  }
  if (entry.opIndex < 0) return

  const atPosition: CardMatch = (card) =>
    card.code === oldCode &&
    card.controller === position.controller &&
    card.location === position.location &&
    card.sequence === position.sequence
  for (let index = entry.opIndex + 1; index <= current.opIndex; index++) {
    const op = state.ops[index]
    if (!op || op.type === 'inject' || !op.answers) continue
    for (const recorded of op.answers) remapAnswer(recorded.answer, newCode, atPosition)
  }

  const answerIndex = findEntryAnswer(state, entry.opIndex, oldCode)
  if (answerIndex < 0) return
  const entryOp = state.ops[answerIndex]
  if (entryOp.type !== 'answer' || !entryOp.answers) return
  const enteringCard: CardMatch = (card) => card.code === oldCode
  for (const recorded of entryOp.answers) remapAnswer(recorded.answer, newCode, enteringCard)
}

export function remapRecordedAnswers(
  state: SessionState,
  oldCode: number,
  newCode: number,
  position: CardPosition
): void {
  if (!FIELD_LOCATIONS.has(position.location)) return
  remapEnterFieldAction(state, oldCode, newCode, position)
}
