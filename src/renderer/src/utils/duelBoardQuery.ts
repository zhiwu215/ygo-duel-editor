import { CardLocation, FieldCard } from '@shared/index'

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
  if (location === CardLocation.DECK) {
    return pile.reduce<FieldCard | undefined>(
      (top, c) =>
        top === undefined ||
        (isEngineActive ? c.sequence > top.sequence : c.sequence < top.sequence)
          ? c
          : top,
      undefined
    )
  }
  return pile[pile.length - 1]
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
