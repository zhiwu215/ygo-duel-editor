import { CardLocation, FIELD_ZONE_SEQUENCE } from '../constants/locations'
import { getPzoneSzoneSequence } from '../types/rules'
import type { DuelPuzzleState, FieldCard } from '../types/duel'
import { orderPrivatePilePlacements } from './privatePilePlacements'

const FACE_UP = 0x5
const FACE_DOWN_DEFENSE = 0x8
const PENDULUM_SZONE_LIMIT = FIELD_ZONE_SEQUENCE

export interface PlacementTarget {
  location: number
  sequence: number
  position: number
}

export interface InitialPlacement {
  card: FieldCard
  placement: PlacementTarget
  identitySequence: number
}

export interface InitialPlacements {
  placements: InitialPlacement[]
  unsupportedPendulum: number
  unsupportedOverlay: number
}

function isPrivatePile(location: number): boolean {
  return (
    location === CardLocation.HAND ||
    location === CardLocation.DECK ||
    location === CardLocation.EXTRA
  )
}

export function initialStateOwnerOf(card: FieldCard, location: number): number {
  return isPrivatePile(location) ? card.controller : (card.owner ?? card.controller)
}

export function buildInitialPlacements(state: DuelPuzzleState): InitialPlacements {
  const fieldCards = state.cards.filter((card) => card.code > 0)
  const placements: InitialPlacement[] = []
  let unsupportedPendulum = 0
  let unsupportedOverlay = 0

  const pzoneSequences = getPzoneSzoneSequence(state.masterRule)
  const takenSzone = new Set<number>()
  for (const card of fieldCards) {
    if (card.location === CardLocation.SZONE) takenSzone.add(card.sequence)
    if (card.location === CardLocation.FZONE) takenSzone.add(FIELD_ZONE_SEQUENCE)
    if (card.location === CardLocation.MZONE && card.overlayMaterials?.length) {
      unsupportedOverlay += card.overlayMaterials.filter((code) => code > 0).length
    }
  }

  for (const card of fieldCards) {
    if (
      card.location === CardLocation.DECK ||
      card.location === CardLocation.EXTRA ||
      card.location === CardLocation.HAND ||
      card.location === CardLocation.GRAVE ||
      card.location === CardLocation.REMOVED
    ) {
      continue
    }
    if (card.location === CardLocation.OVERLAY) {
      unsupportedOverlay += 1
      continue
    }
    if (card.location === CardLocation.PZONE) {
      const sequence = pzoneSequences[card.sequence]
      if (sequence === undefined || sequence >= PENDULUM_SZONE_LIMIT || takenSzone.has(sequence)) {
        unsupportedPendulum += 1
        continue
      }
      takenSzone.add(sequence)
      placements.push({
        card,
        placement: { location: CardLocation.SZONE, sequence, position: FACE_UP },
        identitySequence: sequence
      })
      continue
    }
    const isFieldZone = card.location === CardLocation.FZONE
    const location = isFieldZone ? CardLocation.SZONE : card.location
    const sequence = isFieldZone ? FIELD_ZONE_SEQUENCE : card.sequence
    placements.push({
      card,
      placement: { location, sequence, position: card.position },
      identitySequence: sequence
    })
  }

  for (const location of [CardLocation.GRAVE, CardLocation.REMOVED]) {
    for (const controller of [0, 1] as const) {
      const pile = fieldCards
        .filter((card) => card.controller === controller && card.location === location)
        .sort((left, right) => left.sequence - right.sequence)
      pile.forEach((card, index) => {
        placements.push({
          card,
          placement: { location, sequence: card.sequence, position: card.position },
          identitySequence: index
        })
      })
    }
  }

  for (const controller of [0, 1] as const) {
    const hand = fieldCards.filter(
      (card) => card.controller === controller && card.location === CardLocation.HAND
    )
    for (const entry of orderPrivatePilePlacements(CardLocation.HAND, hand)) {
      placements.push({
        card: entry.card,
        placement: {
          location: CardLocation.HAND,
          sequence: entry.sequence,
          position: entry.card.position
        },
        identitySequence: entry.identitySequence
      })
    }
  }

  for (const location of [CardLocation.DECK, CardLocation.EXTRA]) {
    for (const controller of [0, 1] as const) {
      const pile = fieldCards.filter(
        (card) => card.controller === controller && card.location === location
      )
      for (const entry of orderPrivatePilePlacements(location, pile)) {
        placements.push({
          card: entry.card,
          placement: {
            location,
            sequence: location === CardLocation.EXTRA ? entry.card.sequence : entry.sequence,
            position: FACE_DOWN_DEFENSE
          },
          identitySequence: entry.identitySequence
        })
      }
    }
  }

  return { placements, unsupportedPendulum, unsupportedOverlay }
}
