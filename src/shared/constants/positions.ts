export const CardPosition = {
  FACEUP_ATTACK: 0x1,
  FACEDOWN_ATTACK: 0x2,
  FACEUP_DEFENSE: 0x4,
  FACEDOWN_DEFENSE: 0x8,
  FACEUP: 0x5,
  FACEDOWN: 0xa
} as const

export const POSITION_NAMES: Record<number, string> = {
  [CardPosition.FACEUP_ATTACK]: '攻击表示',
  [CardPosition.FACEDOWN_ATTACK]: '盖放攻击',
  [CardPosition.FACEUP_DEFENSE]: '守备表示',
  [CardPosition.FACEDOWN_DEFENSE]: '盖放守备',
  [CardPosition.FACEUP]: '表侧表示',
  [CardPosition.FACEDOWN]: '盖放'
}
