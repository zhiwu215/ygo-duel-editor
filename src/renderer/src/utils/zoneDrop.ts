import { CardLocation, CardPosition } from '@shared/index'

export function getDropPosOverride(location: number, invert: boolean): number | undefined {
  if (location === CardLocation.GRAVE) return CardPosition.FACEUP
  if (!invert) return undefined
  if (location === CardLocation.SZONE) return CardPosition.FACEUP
  if (location === CardLocation.MZONE) return CardPosition.FACEDOWN_DEFENSE
  if (location === CardLocation.EXTRA) return CardPosition.FACEUP
  if (location === CardLocation.DECK) return CardPosition.FACEUP
  return undefined
}

export function canShowPositionHint(location: number, phase: string): boolean {
  if (location === CardLocation.MZONE && phase === 'BP') return false
  return true
}
