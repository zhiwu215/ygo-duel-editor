import { CardLocation } from '../constants/locations'
import { CardPosition } from '../constants/positions'
import type { FieldCard } from '../types/duel'

export function buildInitialOverlayPlacements(card: FieldCard): {
  code: number
  owner: number
  player: number
  location: number
  sequence: number
  position: number
}[] {
  if (card.location !== CardLocation.MZONE) return []
  return (card.overlayMaterials ?? [])
    .filter((code) => code > 0)
    .map((code) => ({
      code,
      owner: card.owner ?? card.controller,
      player: card.controller,
      location: CardLocation.MZONE,
      sequence: card.sequence,
      position: CardPosition.FACEUP_ATTACK
    }))
}
