import { CardLocation, CardPosition, CardUtils, CdbCard, InjectCommand } from '@shared/index'

const FIELD_ZONE_SEQUENCE = 5

export interface InjectDropTarget {
  card: CdbCard
  controller: 0 | 1
  location: number
  sequence: number
  ctrlKey: boolean
  masterRule: number
}

export function buildInjectCommand(target: InjectDropTarget): InjectCommand | null {
  const { card, controller, location, sequence, ctrlKey, masterRule } = target
  const base = { op: 'add-card' as const, player: controller, code: card.id }

  switch (location) {
    case CardLocation.HAND:
      return { ...base, to: 'hand' }
    case CardLocation.DECK:
      return { ...base, to: 'deck-top' }
    case CardLocation.GRAVE:
      return { ...base, to: 'grave-top' }
    case CardLocation.REMOVED:
      return { ...base, to: 'removed' }
    case CardLocation.EXTRA:
      return { ...base, to: 'extra' }
    case CardLocation.FZONE:
      return { ...base, to: 'fzone' }
    case CardLocation.MZONE:
      return {
        ...base,
        to: 'mzone',
        sequence,
        position: ctrlKey ? CardPosition.FACEDOWN_DEFENSE : CardPosition.FACEUP_ATTACK
      }
    case CardLocation.SZONE: {
      if (sequence === FIELD_ZONE_SEQUENCE) return { ...base, to: 'fzone' }
      const pendulumSlot = CardUtils.isPendulum(card.type) && (sequence === 0 || sequence === 4)
      return {
        ...base,
        to: 'szone',
        sequence,
        position: ctrlKey || pendulumSlot ? CardPosition.FACEUP : CardPosition.FACEDOWN
      }
    }
    case CardLocation.PZONE: {
      const mapped = masterRule >= 4 ? (sequence === 0 ? 0 : 4) : sequence === 0 ? 6 : 7
      return { ...base, to: 'szone', sequence: mapped, position: CardPosition.FACEUP }
    }
    default:
      return null
  }
}
