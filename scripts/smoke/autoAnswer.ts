import type { Answer, EngineRequest } from '@shared/index'

export function autoAnswer(request: EngineRequest): Answer {
  const d = request.data
  switch (d.kind) {
    case 'rps':
      return { kind: 'rps', hand: 'paper' }
    case 'idle':
      return { kind: 'idle', cmd: d.canEp ? 'TO_EP' : d.canBp ? 'TO_BP' : 'TO_EP' }
    case 'battle':
      return { kind: 'battle', cmd: 'TO_EP' }
    case 'yesno':
      return { kind: 'yesno', yes: false }
    case 'chain':
      return { kind: 'chain', card: null }
    case 'card':
      return d.cancelable
        ? { kind: 'card', cards: null }
        : { kind: 'card', cards: d.cards.slice(0, Math.max(1, d.min)) }
    case 'tribute':
      return d.cancelable
        ? { kind: 'tribute', cards: null }
        : { kind: 'tribute', cards: d.cards.slice(0, Math.max(1, d.min)) }
    case 'place':
      return { kind: 'place', places: d.places.slice(0, Math.max(1, d.count)) }
    case 'disfield':
      return { kind: 'disfield', places: d.places.slice(0, Math.max(1, d.count)) }
    case 'position':
      return { kind: 'position', position: d.positions[0] }
    case 'option':
      return { kind: 'option', index: 0 }
    case 'sort':
      return { kind: 'sort', cards: null }
    case 'unselect':
      return d.finishable
        ? { kind: 'unselect', card: null }
        : d.selectable.length > 0
          ? { kind: 'unselect', card: d.selectable[0] }
          : { kind: 'unselect', card: null }
    case 'announce':
      return d.announceType === 'number'
        ? { kind: 'announce', value: d.numbers![0] }
        : d.announceType === 'card'
          ? { kind: 'announce', value: 89631139 }
          : { kind: 'announce', value: d.availableMask ? d.availableMask & -d.availableMask : 1 }
    case 'counter':
      return { kind: 'counter', counters: [] }
    case 'sum': {
      const picked = [...d.mustSelect]
      for (const card of d.cards) {
        if (picked.length >= d.count) break
        if (!picked.some((p) => p.code === card.code && p.sequence === card.sequence)) {
          picked.push(card)
        }
      }
      return { kind: 'sum', cards: picked }
    }
    default:
      throw new Error(`autoAnswer 未覆盖 kind=${request.kind}`)
  }
}
