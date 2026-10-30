import { CardLocation, PILE_LOCATIONS, LightweightCardSnapshot } from '@shared/index'

function isInitialPile(location: number): boolean {
  return location === CardLocation.HAND || PILE_LOCATIONS.has(location)
}

function samePile(card: LightweightCardSnapshot, other: LightweightCardSnapshot): boolean {
  return (
    other.controller === card.controller &&
    other.location === card.location &&
    (other.duelistId ?? null) === (card.duelistId ?? null)
  )
}

export function insertCardIntoInitialBoard(
  snapshot: LightweightCardSnapshot[],
  card: LightweightCardSnapshot
): LightweightCardSnapshot[] {
  if (!isInitialPile(card.location)) {
    return [...snapshot, card]
  }

  const pile = snapshot
    .filter((other) => samePile(card, other))
    .sort((a, b) => a.sequence - b.sequence)
  const index = Math.min(Math.max(card.sequence, 0), pile.length)
  const shifted = new Set(pile.slice(index).map((other) => other.instanceId))

  return [
    ...snapshot.map((other) =>
      shifted.has(other.instanceId) ? { ...other, sequence: other.sequence + 1 } : other
    ),
    { ...card, sequence: index }
  ]
}
