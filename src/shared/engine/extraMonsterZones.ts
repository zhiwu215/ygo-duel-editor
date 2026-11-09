import { CardLocation, EXTRA_MONSTER_ZONE_SEQUENCES } from '../constants/locations'
import type { RequestPlace } from './protocol'

export interface ExtraMonsterZonePlaces {
  left: [RequestPlace, RequestPlace]
  right: [RequestPlace, RequestPlace]
}

export function extraMonsterZonePlaces(bottomSeat: 0 | 1): ExtraMonsterZonePlaces {
  const topSeat = bottomSeat === 0 ? 1 : 0
  const [leftSequence, rightSequence] = EXTRA_MONSTER_ZONE_SEQUENCES
  const place = (controller: 0 | 1, sequence: number): RequestPlace => ({
    controller,
    location: CardLocation.MZONE,
    sequence
  })
  return {
    left: [place(bottomSeat, leftSequence), place(topSeat, rightSequence)],
    right: [place(bottomSeat, rightSequence), place(topSeat, leftSequence)]
  }
}
