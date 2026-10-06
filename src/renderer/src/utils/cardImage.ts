import localCover from '../assets/textures/cover.jpg'
import localCover2 from '../assets/textures/cover2.jpg'

export const CARD_BACK_IMAGE = localCover

export const CARD_BACK_OPPONENT_IMAGE = localCover2

export function getCardBack(controller: 0 | 1 = 0): string {
  return controller === 1 ? CARD_BACK_OPPONENT_IMAGE : CARD_BACK_IMAGE
}

export function getCardImageUrl(code: number | undefined, small = false): string {
  if (!code || code <= 0) {
    return CARD_BACK_IMAGE
  }
  return `ygopic://card/${code}.jpg${small ? '?small=1' : ''}`
}
