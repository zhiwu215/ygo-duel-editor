import type { Answer, EngineRequest, RequestCard } from '@shared/engine/protocol'
import { mapAnswerCards } from './answer-cards'

function requestCardsOf(request: EngineRequest): RequestCard[] {
  const data = request.data
  switch (data.kind) {
    case 'idle':
      return [
        ...data.summonable,
        ...data.spSummonable,
        ...data.msetable,
        ...data.ssetable,
        ...data.reposable,
        ...data.activatable
      ]
    case 'battle':
      return [...data.attackable, ...data.activatable]
    case 'card':
    case 'tribute':
    case 'counter':
    case 'sort':
      return data.cards
    case 'chain':
      return data.chains
    case 'sum':
      return [...data.mustSelect, ...data.cards]
    case 'unselect':
      return [...data.selectable, ...data.unselectable]
    default:
      return []
  }
}

function samePosition(left: RequestCard, right: RequestCard): boolean {
  return (
    left.controller === right.controller &&
    left.location === right.location &&
    left.sequence === right.sequence &&
    (left.subsequence ?? 0) === (right.subsequence ?? 0) &&
    (!left.duelistId || !right.duelistId || left.duelistId === right.duelistId)
  )
}

export interface AnswerCodeRemap {
  oldCode: number
  newCode: number
}

export function alignAnswerToRequest(
  request: EngineRequest,
  answer: Answer,
  remap: AnswerCodeRemap
): Answer | null {
  if (remap.oldCode === remap.newCode) return null
  const candidates = requestCardsOf(request)
  if (candidates.length === 0) return null
  let changed = false
  const aligned = mapAnswerCards(answer, (card) => {
    if (card.code !== remap.oldCode) return card
    const match = candidates.find((item) => samePosition(item, card))
    if (!match || match.code !== remap.newCode) return card
    changed = true
    return { ...card, code: match.code, desc: match.desc }
  })
  return changed ? aligned : null
}
