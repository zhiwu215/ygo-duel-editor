import localCardBack from '../assets/textures/cover.jpg'

/**
 * 卡背图 (里侧表示 / 未检索到卡图时占位，本地 textures 极速离线呈现)
 */
export const CARD_BACK_IMAGE = localCardBack

/**
 * 获取卡片卡图 URL
 * 完全基于本地游戏客户端目录 (通过自定义 ygopic:// 协议直接从本地 pics 读取，零网络、零 CDN)
 * @param code 8位卡片密码
 * @param small 是否为缩略图 (优先读取 pics/thumbnail/，若无则自动回退至 pics/)
 */
export function getCardImageUrl(code: number | undefined, small = false): string {
  if (!code || code <= 0) {
    return CARD_BACK_IMAGE
  }
  return `ygopic://card/${code}.jpg${small ? '?small=1' : ''}`
}
