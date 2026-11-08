import type { Answer, RequestCard } from '@shared/engine/protocol'

export function forEachAnswerCard(answer: Answer, visit: (card: RequestCard) => void): void {
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

export function mapAnswerCards(answer: Answer, map: (card: RequestCard) => RequestCard): Answer {
  switch (answer.kind) {
    case 'idle':
    case 'battle':
    case 'chain':
    case 'unselect':
      return answer.card ? { ...answer, card: map(answer.card) } : answer
    case 'card':
    case 'tribute':
    case 'sum':
    case 'sort':
      return answer.cards ? { ...answer, cards: answer.cards.map(map) } : answer
    case 'counter':
      return {
        ...answer,
        counters: answer.counters.map((entry) => ({ ...entry, card: map(entry.card) }))
      }
    default:
      return answer
  }
}
