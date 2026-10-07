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
  setnames?: string[] // 系列字段名称列表 (如 ['朱罗纪'], ['禁忌的'])
  pools?: string[] // 所属卡池标记 (对应 CARD_POOLS 中的 id)，可命中多个
}

/**
 * 卡池类型：由用户在设置里为每个附加卡库路径显式指定，不依赖文件名
 * id 为 none 表示不标记
 */
export interface CardPoolOption {
  id: string
  label: string
}

export const CARD_POOLS: CardPoolOption[] = [
  { id: 'none', label: '无' },
  { id: 'anime', label: '动画/漫画' },
  { id: 'rush', label: '超速（Rush）' },
  { id: 'tf', label: '卡片力量（TF）' }
]

export function cardPoolLabel(id: string): string {
  return CARD_POOLS.find((p) => p.id === id)?.label ?? ''
}

/**
 * 卡片种类标志位
 */
export const CardType = {
  MONSTER: 0x1,
  /** 魔法卡 */
  SPELL: 0x2,
  TRAP: 0x4,
  NORMAL: 0x10,
  /** 陷阱怪兽附加类型位 */
  TRAP_MONSTER: 0x100,
  SPIRIT: 0x200,
  UNION: 0x400,
  GEMINI: 0x800,
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
  TOON: 0x400000,
  XYZ: 0x800000,
  PENDULUM: 0x1000000,
  SPECIAL_SUMMON: 0x2000000,
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
 * 种族标志位
 */
export const CardRace = {
  WARRIOR: 0x1,
  SPELLCASTER: 0x2,
  FAIRY: 0x4,
  FIEND: 0x8,
  ZOMBIE: 0x10,
  MACHINE: 0x20,
  AQUA: 0x40,
  PYRO: 0x80,
  ROCK: 0x100,
  WINGED_BEAST: 0x200,
  PLANT: 0x400,
  INSECT: 0x800,
  THUNDER: 0x1000,
  DRAGON: 0x2000,
  BEAST: 0x4000,
  BEAST_WARRIOR: 0x8000,
  DINOSAUR: 0x10000,
  FISH: 0x20000,
  SEA_SERPENT: 0x40000,
  REPTILE: 0x80000,
  PSYCHIC: 0x100000,
  DIVINE_BEAST: 0x200000,
  CREATOR_GOD: 0x400000,
  WYRM: 0x800000,
  CYBERSE: 0x1000000,
  ILLUSION: 0x2000000
} as const

export const RACE_NAMES: Record<number, string> = {
  [CardRace.WARRIOR]: '战士',
  [CardRace.SPELLCASTER]: '魔法师',
  [CardRace.FAIRY]: '天使',
  [CardRace.FIEND]: '恶魔',
  [CardRace.ZOMBIE]: '不死',
  [CardRace.MACHINE]: '机械',
  [CardRace.AQUA]: '水',
  [CardRace.PYRO]: '炎',
  [CardRace.ROCK]: '岩石',
  [CardRace.WINGED_BEAST]: '鸟兽',
  [CardRace.PLANT]: '植物',
  [CardRace.INSECT]: '昆虫',
  [CardRace.THUNDER]: '雷',
  [CardRace.DRAGON]: '龙',
  [CardRace.BEAST]: '兽',
  [CardRace.BEAST_WARRIOR]: '兽战士',
  [CardRace.DINOSAUR]: '恐龙',
  [CardRace.FISH]: '鱼',
  [CardRace.SEA_SERPENT]: '海龙',
  [CardRace.REPTILE]: '爬虫类',
  [CardRace.PSYCHIC]: '念动力',
  [CardRace.DIVINE_BEAST]: '幻神兽',
  [CardRace.CREATOR_GOD]: '创造神',
  [CardRace.WYRM]: '幻龙',
  [CardRace.CYBERSE]: '电子界',
  [CardRace.ILLUSION]: '幻想魔'
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
  },

  // 获取卡片简明分类标签
  getCardTypeLabel: (type: number): string => {
    if (CardUtils.isMonster(type)) {
      if (type & CardType.LINK) return '连接'
      if (type & CardType.XYZ) return '超量'
      if (type & CardType.SYNCHRO) return '同调'
      if (type & CardType.FUSION) return '融合'
      if (type & CardType.RITUAL) return '仪式'
      if (type & CardType.PENDULUM) return '灵摆'
      if (type & CardType.EFFECT) return '效果'
      if (type & CardType.NORMAL) return '通常'
      if (type & CardType.TOKEN) return '衍生物'
      return '怪兽'
    }
    if (CardUtils.isSpell(type)) {
      if (type & CardType.QUICKPLAY) return '速攻'
      if (type & CardType.CONTINUOUS) return '永续'
      if (type & CardType.EQUIP) return '装备'
      if (type & CardType.FIELD) return '场地'
      if (type & CardType.RITUAL) return '仪式'
      return '通常魔法'
    }
    if (CardUtils.isTrap(type)) {
      if (type & CardType.COUNTER) return '反击'
      if (type & CardType.CONTINUOUS) return '永续'
      return '通常陷阱'
    }
    return '未知'
  }
}
