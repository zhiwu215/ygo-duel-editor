import { CardType, CardPoolFilter, LimitFilter } from '@shared/index'

export const NONE_LABEL = '（无）'

export const MONSTER_SUB_TYPES = [
  { label: NONE_LABEL, value: 0 },
  { label: '通常怪兽', value: CardType.MONSTER | CardType.NORMAL },
  { label: '效果怪兽', value: CardType.MONSTER | CardType.EFFECT },
  { label: '融合怪兽', value: CardType.MONSTER | CardType.FUSION },
  { label: '仪式怪兽', value: CardType.MONSTER | CardType.RITUAL },
  { label: '同调怪兽', value: CardType.MONSTER | CardType.SYNCHRO },
  { label: '超量怪兽', value: CardType.MONSTER | CardType.XYZ },
  { label: '灵摆怪兽', value: CardType.MONSTER | CardType.PENDULUM },
  { label: '连接怪兽', value: CardType.MONSTER | CardType.LINK },
  { label: '特殊召唤怪兽', value: CardType.MONSTER | CardType.SPECIAL_SUMMON },
  { label: '调整', value: CardType.MONSTER | CardType.TUNER },
  { label: '通常调整', value: CardType.MONSTER | CardType.NORMAL | CardType.TUNER },
  { label: '通常灵摆', value: CardType.MONSTER | CardType.NORMAL | CardType.PENDULUM },
  { label: '同调调整', value: CardType.MONSTER | CardType.SYNCHRO | CardType.TUNER },
  { label: '灵摆调整', value: CardType.MONSTER | CardType.PENDULUM | CardType.TUNER },
  { label: '灵摆效果怪兽', value: CardType.MONSTER | CardType.PENDULUM | CardType.EFFECT },
  { label: '翻转怪兽', value: CardType.MONSTER | CardType.FLIP },
  { label: '灵摆翻转怪兽', value: CardType.MONSTER | CardType.PENDULUM | CardType.FLIP },
  { label: '灵魂怪兽', value: CardType.MONSTER | CardType.SPIRIT },
  { label: '同盟怪兽', value: CardType.MONSTER | CardType.UNION },
  { label: '二重怪兽', value: CardType.MONSTER | CardType.GEMINI },
  { label: '卡通怪兽', value: CardType.MONSTER | CardType.TOON },
  { label: '衍生物', value: CardType.MONSTER | CardType.TOKEN }
]

export const SPELL_SUB_TYPES = [
  { label: NONE_LABEL, value: 0 },
  { label: '通常魔法', value: CardType.SPELL },
  { label: '速攻魔法', value: CardType.SPELL | CardType.QUICKPLAY },
  { label: '永续魔法', value: CardType.SPELL | CardType.CONTINUOUS },
  { label: '装备魔法', value: CardType.SPELL | CardType.EQUIP },
  { label: '场地魔法', value: CardType.SPELL | CardType.FIELD },
  { label: '仪式魔法', value: CardType.SPELL | CardType.RITUAL }
]

export const TRAP_SUB_TYPES = [
  { label: NONE_LABEL, value: 0 },
  { label: '通常陷阱', value: CardType.TRAP },
  { label: '永续陷阱', value: CardType.TRAP | CardType.CONTINUOUS },
  { label: '反击陷阱', value: CardType.TRAP | CardType.COUNTER }
]

export const LIMIT_OPTIONS: Array<{ value: LimitFilter; label: string }> = [
  { value: 0, label: '不限' },
  { value: 1, label: '禁止' },
  { value: 2, label: '限制' },
  { value: 3, label: '准限制' }
]

interface CardPoolOptionItem {
  value: CardPoolFilter
  label: string
  tag?: string
}

export const CARD_POOL_OPTIONS: CardPoolOptionItem[] = [
  { value: 'any', label: '全部卡池' },
  { value: 'ocg', label: 'OCG' },
  { value: 'tcg', label: 'TCG' },
  { value: 'ocgOnly', label: 'OCG 独有' },
  { value: 'tcgOnly', label: 'TCG 独有' },
  { value: 'anime', label: '动漫/漫画', tag: 'anime' },
  { value: 'rush', label: '超速（Rush）', tag: 'rush' },
  { value: 'tf', label: '卡片力量（TF）', tag: 'tf' }
]
