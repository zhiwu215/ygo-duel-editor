import { CardType } from '@shared/index'

export const MONSTER_SUBTYPES: Array<{ mask: number; label: string; mutual?: number[] }> = [
  { mask: CardType.NORMAL, label: '通常', mutual: [CardType.EFFECT] },
  { mask: CardType.EFFECT, label: '效果', mutual: [CardType.NORMAL] },
  { mask: CardType.FUSION, label: '融合' },
  { mask: CardType.SYNCHRO, label: '同调' },
  { mask: CardType.XYZ, label: '超量' },
  { mask: CardType.LINK, label: '连接' },
  { mask: CardType.RITUAL, label: '仪式' },
  { mask: CardType.PENDULUM, label: '灵摆' },
  { mask: CardType.TUNER, label: '调整' },
  { mask: CardType.FLIP, label: '反转' }
]

export const SPELL_SUBTYPES: Array<{ mask: number; label: string }> = [
  { mask: CardType.QUICKPLAY, label: '速攻' },
  { mask: CardType.CONTINUOUS, label: '永续' },
  { mask: CardType.EQUIP, label: '装备' },
  { mask: CardType.FIELD, label: '场地' },
  { mask: CardType.RITUAL, label: '仪式' }
]

export const TRAP_SUBTYPES: Array<{ mask: number; label: string }> = [
  { mask: CardType.CONTINUOUS, label: '永续' },
  { mask: CardType.COUNTER, label: '反击' }
]

export function resolveKindType(prevType: number, kindId: number): number {
  let type = kindId
  if (kindId !== CardType.MONSTER) {
    if (kindId === CardType.SPELL) type = CardType.SPELL
    else type = CardType.TRAP
  } else if ((prevType & CardType.MONSTER) !== 0) {
    let kept = CardType.MONSTER
    for (const sub of MONSTER_SUBTYPES) {
      if ((prevType & sub.mask) !== 0) kept |= sub.mask
    }
    type = kept
  } else {
    type = CardType.MONSTER | CardType.EFFECT
  }
  return type
}

export function resolveToggledType(prevType: number, mask: number, mutual?: number[]): number {
  let type = prevType
  if ((type & mask) !== 0) {
    type &= ~mask
  } else {
    for (const m of mutual ?? []) type &= ~m
    type |= mask
  }
  return type
}

export function resolveSpellSubType(value: string): number {
  return value === 'none' ? CardType.SPELL : CardType.SPELL | Number(value)
}

export function resolveTrapSubType(value: string): number {
  return value === 'none' ? CardType.TRAP : CardType.TRAP | Number(value)
}

export function resolveToggledMarkers(prevMarkers: number, mask: number): number {
  return (prevMarkers & mask) !== 0 ? prevMarkers & ~mask : prevMarkers | mask
}
