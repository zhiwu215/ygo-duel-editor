/**
 * 游戏王 ocgcore 表示形式代号 (POS_*)
 */
export const CardPosition = {
  FACEUP_ATTACK: 0x1, // 表侧攻击 (POS_FACEUP_ATTACK)
  FACEDOWN_ATTACK: 0x2, // 里侧攻击 (POS_FACEDOWN_ATTACK, 暗黑同调/特殊卡片)
  FACEUP_DEFENSE: 0x4, // 表侧守备 (POS_FACEUP_DEFENSE)
  FACEDOWN_DEFENSE: 0x8, // 里侧守备 (POS_FACEDOWN_DEFENSE)
  FACEUP: 0x5, // 表侧表示 (POS_FACEUP = 0x1 | 0x4)
  FACEDOWN: 0xa // 里侧表示 (POS_FACEDOWN = 0x2 | 0x8)
} as const

export type CardPositionType = (typeof CardPosition)[keyof typeof CardPosition]

export interface PositionInfo {
  code: number
  name: string
  isDefense: boolean
  isFacedown: boolean
  rotationDeg: number // 前端渲染旋转角度：0度表示攻击，90度表示守备
}

export const POSITION_INFOS: Record<number, PositionInfo> = {
  [CardPosition.FACEUP_ATTACK]: {
    code: CardPosition.FACEUP_ATTACK,
    name: '表侧攻击',
    isDefense: false,
    isFacedown: false,
    rotationDeg: 0
  },
  [CardPosition.FACEUP_DEFENSE]: {
    code: CardPosition.FACEUP_DEFENSE,
    name: '表侧守备',
    isDefense: true,
    isFacedown: false,
    rotationDeg: 90
  },
  [CardPosition.FACEDOWN_DEFENSE]: {
    code: CardPosition.FACEDOWN_DEFENSE,
    name: '里侧守备',
    isDefense: true,
    isFacedown: true,
    rotationDeg: 90
  },
  [CardPosition.FACEDOWN]: {
    code: CardPosition.FACEDOWN,
    name: '里侧盖放',
    isDefense: false,
    isFacedown: true,
    rotationDeg: 0
  },
  [CardPosition.FACEUP]: {
    code: CardPosition.FACEUP,
    name: '表侧放置',
    isDefense: false,
    isFacedown: false,
    rotationDeg: 0
  }
}
