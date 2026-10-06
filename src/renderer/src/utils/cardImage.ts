import localCover from '../assets/textures/cover.jpg'
import localCover2 from '../assets/textures/cover2.jpg'

export const CARD_BACK_IMAGE = localCover

export const CARD_BACK_OPPONENT_IMAGE = localCover2

let imageVersion = 0

/**
 * 卡库或卡图目录变更后递增，强制浏览器重新拉取图片 (否则改路径前的 404 会被缓存)
 */
export function bumpCardImageVersion(): void {
  imageVersion += 1
}

export function getCardBack(controller: 0 | 1 = 0): string {
  return controller === 1 ? CARD_BACK_OPPONENT_IMAGE : CARD_BACK_IMAGE
}

export function getCardImageUrl(code: number | undefined, small = false): string {
  if (!code || code <= 0) {
    return CARD_BACK_IMAGE
  }
  const query = small ? `small=1&v=${imageVersion}` : `v=${imageVersion}`
  return `ygopic://card/${code}.jpg?${query}`
}
