import { CardLocation, LightweightCardSnapshot } from '@shared/index'

const PILE_LOCATIONS = new Set<number>([
  CardLocation.HAND,
  CardLocation.GRAVE,
  CardLocation.DECK,
  CardLocation.EXTRA,
  CardLocation.REMOVED
])

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
  if (!PILE_LOCATIONS.has(card.location)) {
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
