/**
 * 游戏王 ocgcore 标准区域代号 (LOCATION_*)
 */
export const CardLocation = {
  DECK: 0x01, // 主卡组 (LOCATION_DECK)
  HAND: 0x02, // 手牌 (LOCATION_HAND)
  MZONE: 0x04, // 怪兽区 (LOCATION_MZONE) - 0~4 主怪兽区, 5~6 额外怪兽区
  SZONE: 0x08, // 魔陷区 (LOCATION_SZONE) - 0~4 魔陷区, 5 场地魔法区 (MR1-3)
  GRAVE: 0x10, // 墓地 (LOCATION_GRAVE)
  REMOVED: 0x20, // 除外区 (LOCATION_REMOVED)
  EXTRA: 0x40, // 额外卡组 (LOCATION_EXTRA)
  OVERLAY: 0x80, // 超量素材 (LOCATION_OVERLAY)
  FZONE: 0x100, // 场地魔法专属区 (LOCATION_FZONE)
  PZONE: 0x200 // 独立灵摆区 (LOCATION_PZONE, MR3 使用)
} as const

export type CardLocationType = (typeof CardLocation)[keyof typeof CardLocation]

export const LOCATION_NAMES: Record<number, string> = {
  [CardLocation.DECK]: '主卡组',
  [CardLocation.HAND]: '手牌',
  [CardLocation.MZONE]: '怪兽区',
  [CardLocation.SZONE]: '魔陷区',
  [CardLocation.GRAVE]: '墓地',
  [CardLocation.REMOVED]: '除外区',
  [CardLocation.EXTRA]: '额外卡组',
  [CardLocation.OVERLAY]: '超量素材',
  [CardLocation.FZONE]: '场地魔法区',
  [CardLocation.PZONE]: '灵摆区'
}
