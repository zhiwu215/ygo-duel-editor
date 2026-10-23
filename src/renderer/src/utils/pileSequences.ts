import { CardLocation } from '@shared/index'

const REVERSED_PILE_LOCATIONS = new Set<number>([CardLocation.DECK, CardLocation.EXTRA])

interface PileSequenceCard {
  controller: 0 | 1
  location: number
  sequence: number
  duelistId?: string
}

export function reversePileSequences<T extends PileSequenceCard>(cards: T[]): T[] {
  const groups = new Map<string, T[]>()
  for (const card of cards) {
    if (!REVERSED_PILE_LOCATIONS.has(card.location)) continue
    const key = `${card.controller}:${card.location}:${card.duelistId ?? ''}`
    const group = groups.get(key) ?? []
    group.push(card)
    groups.set(key, group)
  }
  if (groups.size === 0) return cards

  const clones = new Map<T, T>()
  const next = cards.map((card) => {
    if (!REVERSED_PILE_LOCATIONS.has(card.location)) return card
    const clone = { ...card } as T
    clones.set(card, clone)
    return clone
  })

  for (const group of groups.values()) {
    const sequenceCards = group.map((card) => clones.get(card) as T)
    sequenceCards.sort((a, b) => a.sequence - b.sequence)
    sequenceCards.forEach((card, index) => {
      card.sequence = sequenceCards.length - 1 - index
    })
  }

  return next
}
