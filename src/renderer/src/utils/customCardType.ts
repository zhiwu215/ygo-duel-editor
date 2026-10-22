import { CardType } from '@shared/index'

export type CardKind = 'monster' | 'spell' | 'trap'
export type MonsterSummon = 'none' | 'ritual' | 'fusion' | 'synchro' | 'xyz' | 'link'
export type MonsterForm = 'normal' | 'effect'

const MAIN_TYPE_MASK = CardType.MONSTER | CardType.SPELL | CardType.TRAP
const SUMMON_MASK =
  CardType.RITUAL | CardType.FUSION | CardType.SYNCHRO | CardType.XYZ | CardType.LINK
const MONSTER_SUBTYPE_MASK =
  CardType.NORMAL |
  CardType.EFFECT |
  CardType.FUSION |
  CardType.RITUAL |
  CardType.SPIRIT |
  CardType.UNION |
  CardType.GEMINI |
  CardType.TUNER |
  CardType.SYNCHRO |
  CardType.TOKEN |
  CardType.MAXIMUM |
  CardType.FLIP |
  CardType.TOON |
  CardType.XYZ |
  CardType.PENDULUM |
  CardType.SPECIAL_SUMMON |
  CardType.LINK
const SPELL_SUBTYPE_MASK =
  CardType.QUICKPLAY | CardType.CONTINUOUS | CardType.EQUIP | CardType.FIELD | CardType.RITUAL
const TRAP_SUBTYPE_MASK = CardType.CONTINUOUS | CardType.COUNTER

const SUMMON_BITS: Record<Exclude<MonsterSummon, 'none'>, number> = {
  ritual: CardType.RITUAL,
  fusion: CardType.FUSION,
  synchro: CardType.SYNCHRO,
  xyz: CardType.XYZ,
  link: CardType.LINK
}

const SUMMON_LABELS: Record<Exclude<MonsterSummon, 'none'>, string> = {
  ritual: '仪式',
  fusion: '融合',
  synchro: '同调',
  xyz: '超量',
  link: '连接'
}

export const KIND_OPTIONS: Array<{ value: CardKind; label: string }> = [
  { value: 'monster', label: '怪兽' },
  { value: 'spell', label: '魔法' },
  { value: 'trap', label: '陷阱' }
]

export const SUMMON_OPTIONS: Array<{ value: MonsterSummon; label: string }> = [
  { value: 'none', label: '无' },
  { value: 'ritual', label: '仪式' },
  { value: 'fusion', label: '融合' },
  { value: 'synchro', label: '同调' },
  { value: 'xyz', label: '超量' },
  { value: 'link', label: '连接' }
]

export const ABILITY_OPTIONS: Array<{ mask: number; label: string }> = [
  { mask: CardType.TUNER, label: '调整' },
  { mask: CardType.FLIP, label: '反转' },
  { mask: CardType.GEMINI, label: '二重' },
  { mask: CardType.UNION, label: '同盟' },
  { mask: CardType.SPIRIT, label: '灵魂' },
  { mask: CardType.TOON, label: '卡通' },
  { mask: CardType.SPECIAL_SUMMON, label: '特殊召唤' },
  { mask: CardType.TOKEN, label: '衍生物' }
]

export const SPELL_SUBTYPE_OPTIONS: Array<{ mask: number; label: string }> = [
  { mask: 0, label: '通常' },
  { mask: CardType.QUICKPLAY, label: '速攻' },
  { mask: CardType.CONTINUOUS, label: '永续' },
  { mask: CardType.EQUIP, label: '装备' },
  { mask: CardType.FIELD, label: '场地' },
  { mask: CardType.RITUAL, label: '仪式' }
]

export const TRAP_SUBTYPE_OPTIONS: Array<{ mask: number; label: string }> = [
  { mask: 0, label: '通常' },
  { mask: CardType.CONTINUOUS, label: '永续' },
  { mask: CardType.COUNTER, label: '反击' }
]

export function getCardKind(type: number): CardKind {
  if ((type & CardType.SPELL) !== 0) return 'spell'
  if ((type & CardType.TRAP) !== 0) return 'trap'
  return 'monster'
}

export function getMonsterSummon(type: number): MonsterSummon {
  if ((type & CardType.LINK) !== 0) return 'link'
  if ((type & CardType.XYZ) !== 0) return 'xyz'
  if ((type & CardType.SYNCHRO) !== 0) return 'synchro'
  if ((type & CardType.FUSION) !== 0) return 'fusion'
  if ((type & CardType.RITUAL) !== 0) return 'ritual'
  return 'none'
}

export function isMainDeckMonster(type: number): boolean {
  return (type & CardType.MONSTER) !== 0 && (type & SUMMON_MASK) === 0
}

export function hasPendulum(type: number): boolean {
  return (type & CardType.PENDULUM) !== 0
}

export function hasLink(type: number): boolean {
  return (type & CardType.LINK) !== 0
}

export function hasEffect(type: number): boolean {
  return (type & CardType.EFFECT) !== 0
}

export function hasNormal(type: number): boolean {
  return (type & CardType.NORMAL) !== 0
}

export function getLevelLabel(type: number): string {
  if (hasLink(type)) return '连接值'
  if ((type & CardType.XYZ) !== 0) return '阶级'
  return '等级'
}

export function getSpellSubtype(type: number): number {
  return (
    SPELL_SUBTYPE_OPTIONS.find((option) => option.mask !== 0 && (type & option.mask) !== 0)?.mask ??
    0
  )
}

export function getTrapSubtype(type: number): number {
  return (
    TRAP_SUBTYPE_OPTIONS.find((option) => option.mask !== 0 && (type & option.mask) !== 0)?.mask ??
    0
  )
}

export function getCardTypeSummary(type: number): string {
  const kind = getCardKind(type)
  if (kind === 'spell') {
    const label = SPELL_SUBTYPE_OPTIONS.find(
      (option) => option.mask === getSpellSubtype(type)
    )?.label
    return `${label ?? '通常'}魔法`
  }
  if (kind === 'trap') {
    const label = TRAP_SUBTYPE_OPTIONS.find((option) => option.mask === getTrapSubtype(type))?.label
    return `${label ?? '通常'}陷阱`
  }
  const summon = getMonsterSummon(type)
  const parts: string[] = []
  if (summon === 'none') parts.push(hasNormal(type) ? '通常' : '效果')
  else {
    parts.push(SUMMON_LABELS[summon])
    if (hasEffect(type)) parts.push('效果')
  }
  if (hasPendulum(type)) parts.push('灵摆')
  if ((type & CardType.TUNER) !== 0) parts.push('调整')
  return `${parts.join('/')}怪兽`
}

export function setCardKind(type: number, kind: CardKind): number {
  const base =
    type & ~(MAIN_TYPE_MASK | MONSTER_SUBTYPE_MASK | SPELL_SUBTYPE_MASK | TRAP_SUBTYPE_MASK)
  if (kind === 'spell') return base | CardType.SPELL
  if (kind === 'trap') return base | CardType.TRAP
  return base | CardType.MONSTER | CardType.EFFECT
}

export function setMonsterSummon(type: number, summon: MonsterSummon): number {
  let next = type & ~SUMMON_MASK
  if (summon === 'none') {
    if ((next & (CardType.NORMAL | CardType.EFFECT)) === 0) next |= CardType.EFFECT
    return next
  }
  next |= SUMMON_BITS[summon]
  next &= ~CardType.NORMAL
  if (summon === 'link') next &= ~CardType.PENDULUM
  return next
}

export function setMonsterForm(type: number, form: MonsterForm): number {
  if (form === 'normal') return (type & ~CardType.EFFECT) | CardType.NORMAL
  return (type & ~CardType.NORMAL) | CardType.EFFECT
}

export function setMonsterEffect(type: number, effect: boolean): number {
  return effect ? type | CardType.EFFECT : type & ~CardType.EFFECT
}

export function togglePendulum(type: number): number {
  if (hasPendulum(type)) return type & ~CardType.PENDULUM
  return (type & ~CardType.LINK) | CardType.PENDULUM
}

export function toggleAbility(type: number, mask: number): number {
  return (type & mask) !== 0 ? type & ~mask : type | mask
}

export function setSpellSubtype(type: number, mask: number): number {
  const base = (type & ~SPELL_SUBTYPE_MASK) | CardType.SPELL
  return mask === 0 ? base : base | mask
}

export function setTrapSubtype(type: number, mask: number): number {
  const base = (type & ~TRAP_SUBTYPE_MASK) | CardType.TRAP
  return mask === 0 ? base : base | mask
}

export function normalizeCardType(type: number): number {
  const kind = getCardKind(type)
  if (kind === 'spell') {
    const base =
      type & ~(CardType.MONSTER | CardType.TRAP | MONSTER_SUBTYPE_MASK | TRAP_SUBTYPE_MASK)
    const subtype = getSpellSubtype(type)
    return (base & ~SPELL_SUBTYPE_MASK) | CardType.SPELL | subtype
  }
  if (kind === 'trap') {
    const base =
      type & ~(CardType.MONSTER | CardType.SPELL | MONSTER_SUBTYPE_MASK | SPELL_SUBTYPE_MASK)
    const subtype = getTrapSubtype(type)
    return (base & ~TRAP_SUBTYPE_MASK) | CardType.TRAP | subtype
  }

  const summon = getMonsterSummon(type)
  let next = type & ~(CardType.SPELL | CardType.TRAP | SPELL_SUBTYPE_MASK | TRAP_SUBTYPE_MASK)
  next &= ~SUMMON_MASK
  if (summon !== 'none') next |= SUMMON_BITS[summon]
  if (summon === 'link') {
    next &= ~(CardType.PENDULUM | CardType.NORMAL)
  } else if (summon !== 'none') {
    next &= ~CardType.NORMAL
  } else if ((next & (CardType.NORMAL | CardType.EFFECT)) === 0) {
    next |= CardType.EFFECT
  }
  if ((next & CardType.NORMAL) !== 0 && (next & CardType.EFFECT) !== 0) {
    next &= ~CardType.NORMAL
  }
  return next | CardType.MONSTER
}
