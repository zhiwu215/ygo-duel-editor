import { CardLocation, CardPosition } from '@shared/index'

export function getDropPosOverride(location: number, invert: boolean): number | undefined {
  if (!invert) return undefined
  if (location === CardLocation.SZONE) return CardPosition.FACEUP
  if (location === CardLocation.MZONE) return CardPosition.FACEDOWN_DEFENSE
  if (location === CardLocation.HAND) return CardPosition.FACEUP
  if (location === CardLocation.EXTRA) return CardPosition.FACEUP
  if (location === CardLocation.DECK) return CardPosition.FACEUP
  return undefined
}
