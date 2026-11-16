import { CardLocation } from '../constants/locations'
import { CardPosition } from '../constants/positions'
import { CardUtils } from '../types/card'

export function resolveCardPlacement<
  T extends { location: number; sequence: number; position?: number }
>(cardType: number | undefined, placement: T): T {
  if (placement.location !== CardLocation.DECK || !CardUtils.isExtraDeck(cardType ?? 0)) {
    return placement
  }
  return {
    ...placement,
    location: CardLocation.EXTRA,
    sequence: 0,
    position: CardPosition.FACEDOWN_DEFENSE
  }
}
