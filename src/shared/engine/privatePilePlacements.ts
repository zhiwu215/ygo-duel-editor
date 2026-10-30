import { CardLocation } from '../constants/locations'

export interface PrivatePilePlacement<T> {
  card: T
  sequence: number
  identitySequence: number
}

const REVERSED_PLACEMENT_LOCATIONS: ReadonlySet<number> = new Set<number>([CardLocation.EXTRA])

export function orderPrivatePilePlacements<T extends { sequence: number }>(
  location: number,
  cards: readonly T[]
): PrivatePilePlacement<T>[] {
  const sorted = [...cards].sort((left, right) => left.sequence - right.sequence)
  if (REVERSED_PLACEMENT_LOCATIONS.has(location)) {
    sorted.reverse()
    return sorted.map((card, index) => ({ card, sequence: 0, identitySequence: index }))
  }
  return sorted.map((card, index) => ({
    card,
    sequence: index,
    identitySequence: location === CardLocation.DECK ? sorted.length - 1 - index : index
  }))
}
