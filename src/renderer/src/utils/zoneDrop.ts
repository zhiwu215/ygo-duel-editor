import { CardLocation, CardPosition } from '@shared/index'

/**
 * 按住 Ctrl 拖放时切换默认放置状态：
 * 魔陷直接发动 / 怪兽盖放守备 / 手牌公开 / 额外卡组表侧表示；松开 Ctrl 则沿用区域默认状态
 *
 * @param location 目标落子区域 (CardLocation)
 * @param invert 是否按住 Ctrl 键切换状态
 * @returns 覆盖后的表示形式 (CardPosition)，undefined 表示沿用默认
 */
export function getDropPosOverride(location: number, invert: boolean): number | undefined {
  if (!invert) return undefined
  if (location === CardLocation.SZONE) return CardPosition.FACEUP
  if (location === CardLocation.MZONE) return CardPosition.FACEDOWN_DEFENSE
  if (location === CardLocation.HAND) return CardPosition.FACEUP
  if (location === CardLocation.EXTRA) return CardPosition.FACEUP
  if (location === CardLocation.DECK) return CardPosition.FACEUP
  return undefined
}
