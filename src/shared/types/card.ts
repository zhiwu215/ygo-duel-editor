/**
 * CDB 数据库卡片完整数据结构
 */
export interface CdbCard {
  id: number // 卡密 / 密码 (Primary Key)
  ot: number // 所属地区 (1: OCG, 2: TCG, 3: 全卡池)
  alias: number // 同名卡别名卡密 (若有)
  setcode: bigint | number // 系列字段代码
  type: number // 种类掩码 (Monster/Spell/Trap/Fusion/Link等)
  atk: number // 攻击力 (-2 代表 ?, 负数表示未知)
  def: number // 守备力 (Link怪兽无防，通常为 0 或 -2)
  level: number // 等级/阶级/连接值 (含左/右灵摆刻度掩码)
  race: number // 种族掩码 (战士/魔法师/龙族等)
  attribute: number // 属性掩码 (光/暗/地/水/炎/风/神)
  category: bigint | number // 效果分类
  name: string // 卡名
  desc: string // 效果说明文本
  strings?: string[] // str1 ~ str16 效果提示字符串
}

/**
 * 卡片种类标志位
 */
export const CardType = {
  MONSTER: 0x1,
  SPELL: 0x2,
  TRAP: 0x4,
  NORMAL: 0x10,
  EFFECT: 0x20,
  FUSION: 0x40,
  RITUAL: 0x80,
  TUNER: 0x1000,
  SYNCHRO: 0x2000,
  TOKEN: 0x4000,
  QUICKPLAY: 0x10000,
  CONTINUOUS: 0x20000,
  EQUIP: 0x40000,
  FIELD: 0x80000,
  COUNTER: 0x100000,
  FLIP: 0x200000,
  XYZ: 0x800000,
  PENDULUM: 0x1000000,
  LINK: 0x4000000
} as const

/**
 * 属性标志位
 */
export const CardAttribute = {
  EARTH: 0x01,
  WATER: 0x02,
  FIRE: 0x04,
  WIND: 0x08,
  LIGHT: 0x10,
  DARK: 0x20,
  DIVINE: 0x40
} as const

export const ATTRIBUTE_NAMES: Record<number, string> = {
  [CardAttribute.EARTH]: '地',
  [CardAttribute.WATER]: '水',
  [CardAttribute.FIRE]: '炎',
  [CardAttribute.WIND]: '风',
  [CardAttribute.LIGHT]: '光',
  [CardAttribute.DARK]: '暗',
  [CardAttribute.DIVINE]: '神'
}

/**
 * 卡片辅助解析方法
 */
export const CardUtils = {
  isMonster: (type: number) => (type & CardType.MONSTER) !== 0,
  isSpell: (type: number) => (type & CardType.SPELL) !== 0,
  isTrap: (type: number) => (type & CardType.TRAP) !== 0,
  isExtraDeck: (type: number) =>
    (type & (CardType.FUSION | CardType.SYNCHRO | CardType.XYZ | CardType.LINK)) !== 0,
  isXyz: (type: number) => (type & CardType.XYZ) !== 0,
  isLink: (type: number) => (type & CardType.LINK) !== 0,
  isPendulum: (type: number) => (type & CardType.PENDULUM) !== 0,
  isFusion: (type: number) => (type & CardType.FUSION) !== 0,
  isSynchro: (type: number) => (type & CardType.SYNCHRO) !== 0,

  // 获取星级 / Rank / Link 数量 (提取低 16 位)
  getStarLevel: (level: number, type: number) => {
    if (CardUtils.isLink(type)) {
      return level & 0xff // Link 值
    }
    return level & 0xff // Level / Rank
  },

  // 获取左右灵摆刻度
  getPendulumScales: (level: number) => {
    const lscale = (level >> 24) & 0xff
    const rscale = (level >> 16) & 0xff
    return { lscale, rscale }
  }
}
