import { CardLocation, getPzoneSzoneSequence } from '@shared/index'

export interface ZonePosition {
  location: number
  sequence: number
}

export function isSameZoneSlot(
  masterRule: number,
  left: ZonePosition,
  right: ZonePosition
): boolean {
  const a = normalizeEngineCardPosition(masterRule, left.location, left.sequence)
  const b = normalizeEngineCardPosition(masterRule, right.location, right.sequence)
  return a.location === b.location && a.sequence === b.sequence
}

export function normalizeEngineCardPosition(
  masterRule: number,
  location: number,
  sequence: number
): { location: number; sequence: number } {
  if (location === CardLocation.FZONE) {
    return { location: CardLocation.SZONE, sequence: 5 }
  }
  if (location === CardLocation.PZONE) {
    if (masterRule >= 4) {
      const [left, right] = getPzoneSzoneSequence(masterRule)
      return { location: CardLocation.SZONE, sequence: sequence === 0 ? left : right }
    }
    return { location, sequence }
  }
  if (masterRule <= 3 && location === CardLocation.SZONE && (sequence === 6 || sequence === 7)) {
    return { location: CardLocation.PZONE, sequence: sequence - 6 }
  }
  return { location, sequence }
}
