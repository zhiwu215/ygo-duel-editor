import { FieldCard } from '@shared/index'

export function getPileTopCard(
  cards: FieldCard[],
  controller: 0 | 1,
  location: number,
  ownerScope: string | null,
  isEngineActive: boolean
): FieldCard | undefined {
  const pile = cards.filter(
    (c) =>
      c.controller === controller &&
      c.location === location &&
      (ownerScope ? c.duelistId === ownerScope : true)
  )
  return pile.reduce<FieldCard | undefined>(
    (top, c) =>
      top === undefined ||
      (isEngineActive ? c.sequence > top.sequence : c.sequence < top.sequence)
        ? c
        : top,
    undefined
  )
}

export function getPileCount(
  cards: FieldCard[],
  controller: 0 | 1,
  location: number,
  ownerScope: string | null
): number {
  return cards.filter(
    (c) =>
      c.controller === controller &&
      c.location === location &&
      (ownerScope ? c.duelistId === ownerScope : true)
  ).length
}
