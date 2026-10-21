import { ATTRIBUTE_NAMES, CardAttribute, CardRace, CardType, RACE_NAMES } from './card'
import { CardPoolSchema } from './ipc/cardSearch'

export const NONE_LABEL = '（无）'

export interface FilterOption {
  label: string
  value: number
}

const NONE_OPTION: FilterOption = { label: NONE_LABEL, value: 0 }

function namedOptions(values: number[], names: Record<number, string>): FilterOption[] {
  return values.map((value) => ({ value, label: names[value] ?? String(value) }))
}

const STANDARD_MAIN_TYPES: FilterOption[] = [
  { label: '怪兽', value: CardType.MONSTER },
  { label: '魔法', value: CardType.SPELL },
  { label: '陷阱', value: CardType.TRAP }
]

const STANDARD_MONSTER_SUB_TYPES: FilterOption[] = [
  { label: '通常', value: CardType.MONSTER | CardType.NORMAL },
  { label: '效果', value: CardType.MONSTER | CardType.EFFECT },
  { label: '融合', value: CardType.MONSTER | CardType.FUSION },
  { label: '仪式', value: CardType.MONSTER | CardType.RITUAL },
  { label: '同调', value: CardType.MONSTER | CardType.SYNCHRO },
  { label: '超量', value: CardType.MONSTER | CardType.XYZ },
  { label: '灵摆', value: CardType.MONSTER | CardType.PENDULUM },
  { label: '连接', value: CardType.MONSTER | CardType.LINK },
  { label: '特殊召唤', value: CardType.MONSTER | CardType.SPECIAL_SUMMON },
  { label: '通常|调整', value: CardType.MONSTER | CardType.NORMAL | CardType.TUNER },
  { label: '通常|灵摆', value: CardType.MONSTER | CardType.NORMAL | CardType.PENDULUM },
  { label: '同调|调整', value: CardType.MONSTER | CardType.SYNCHRO | CardType.TUNER },
  { label: '调整', value: CardType.MONSTER | CardType.TUNER },
  { label: '二重', value: CardType.MONSTER | CardType.GEMINI },
  { label: '同盟', value: CardType.MONSTER | CardType.UNION },
  { label: '灵魂', value: CardType.MONSTER | CardType.SPIRIT },
  { label: '反转', value: CardType.MONSTER | CardType.FLIP },
  { label: '卡通', value: CardType.MONSTER | CardType.TOON }
]

const STANDARD_SPELL_SUB_TYPES: FilterOption[] = [
  { label: '通常魔法', value: CardType.SPELL },
  { label: '速攻魔法', value: CardType.SPELL | CardType.QUICKPLAY },
  { label: '永续魔法', value: CardType.SPELL | CardType.CONTINUOUS },
  { label: '仪式魔法', value: CardType.SPELL | CardType.RITUAL },
  { label: '装备魔法', value: CardType.SPELL | CardType.EQUIP },
  { label: '场地魔法', value: CardType.SPELL | CardType.FIELD }
]

const STANDARD_TRAP_SUB_TYPES: FilterOption[] = [
  { label: '通常陷阱', value: CardType.TRAP },
  { label: '永续陷阱', value: CardType.TRAP | CardType.CONTINUOUS },
  { label: '反击陷阱', value: CardType.TRAP | CardType.COUNTER }
]

const STANDARD_ATTRIBUTES: number[] = [
  CardAttribute.EARTH,
  CardAttribute.WATER,
  CardAttribute.FIRE,
  CardAttribute.WIND,
  CardAttribute.LIGHT,
  CardAttribute.DARK,
  CardAttribute.DIVINE
]

const STANDARD_RACES: number[] = [
  CardRace.WARRIOR,
  CardRace.SPELLCASTER,
  CardRace.FAIRY,
  CardRace.FIEND,
  CardRace.ZOMBIE,
  CardRace.MACHINE,
  CardRace.AQUA,
  CardRace.PYRO,
  CardRace.ROCK,
  CardRace.WINGED_BEAST,
  CardRace.PLANT,
  CardRace.INSECT,
  CardRace.THUNDER,
  CardRace.DRAGON,
  CardRace.BEAST,
  CardRace.BEAST_WARRIOR,
  CardRace.DINOSAUR,
  CardRace.FISH,
  CardRace.SEA_SERPENT,
  CardRace.REPTILE,
  CardRace.PSYCHIC,
  CardRace.DIVINE_BEAST,
  CardRace.CREATOR_GOD,
  CardRace.WYRM,
  CardRace.CYBERSE,
  CardRace.ILLUSION
]

const KCG_RACES: number[] = [
  ...STANDARD_RACES,
  CardRace.CYBORG,
  CardRace.MAGICAL_KNIGHT,
  CardRace.HIGH_DRAGON,
  CardRace.OMEGA_PSYCHIC,
  CardRace.CELESTIAL_WARRIOR,
  CardRace.GALAXY,
  CardRace.YOKAI
]

export interface FilterCatalog {
  mainTypes: FilterOption[]
  monsterSubTypes: FilterOption[]
  spellSubTypes: FilterOption[]
  trapSubTypes: FilterOption[]
  attributes: FilterOption[]
  races: FilterOption[]
}

export const FILTER_CATALOGS: Record<CardPoolSchema, FilterCatalog> = {
  classic: {
    mainTypes: [NONE_OPTION, ...STANDARD_MAIN_TYPES],
    monsterSubTypes: [NONE_OPTION, ...STANDARD_MONSTER_SUB_TYPES],
    spellSubTypes: [NONE_OPTION, ...STANDARD_SPELL_SUB_TYPES],
    trapSubTypes: [NONE_OPTION, ...STANDARD_TRAP_SUB_TYPES],
    attributes: [NONE_OPTION, ...namedOptions(STANDARD_ATTRIBUTES, ATTRIBUTE_NAMES)],
    races: [NONE_OPTION, ...namedOptions(STANDARD_RACES, RACE_NAMES)]
  },
  kcg: {
    mainTypes: [NONE_OPTION, ...STANDARD_MAIN_TYPES, { label: '技能卡', value: CardType.SKILL }],
    monsterSubTypes: [
      NONE_OPTION,
      ...STANDARD_MONSTER_SUB_TYPES,
      { label: '极限', value: CardType.MONSTER | CardType.MAXIMUM }
    ],
    spellSubTypes: [
      NONE_OPTION,
      ...STANDARD_SPELL_SUB_TYPES,
      { label: '连接魔法', value: CardType.SPELL | CardType.LINK }
    ],
    trapSubTypes: [NONE_OPTION, ...STANDARD_TRAP_SUB_TYPES],
    attributes: [
      NONE_OPTION,
      ...namedOptions([...STANDARD_ATTRIBUTES, CardAttribute.HADES], ATTRIBUTE_NAMES)
    ],
    races: [NONE_OPTION, ...namedOptions(KCG_RACES, RACE_NAMES)]
  }
}
