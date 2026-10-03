import localCover from '../assets/textures/cover.jpg'
import localCover2 from '../assets/textures/cover2.jpg'

/**
 * 默认卡背图（己方卡背）
 */
export const CARD_BACK_IMAGE = localCover

/**
 * 对方卡背图
 */
export const CARD_BACK_OPPONENT_IMAGE = localCover2

/**
 * 获取对应控制者的卡背图片 (0: 己方, 1: 对方)
 */
export function getCardBack(controller: 0 | 1 = 0): string {
  return controller === 1 ? CARD_BACK_OPPONENT_IMAGE : CARD_BACK_IMAGE
}

/**
 * 获取卡片卡图 URL
 * @param code 8位卡片密码
 * @param small 是否为缩略图 (优先读取 pics/thumbnail/，若无则自动回退至 pics/)
 */
export function getCardImageUrl(code: number | undefined, small = false): string {
  if (!code || code <= 0) {
    return CARD_BACK_IMAGE
  }
  return `ygopic://card/${code}.jpg${small ? '?small=1' : ''}`
}
