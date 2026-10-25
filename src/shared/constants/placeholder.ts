import { CardAttribute, CardRace, CardType, type CdbCard } from '../types/card'

export const PLACEHOLDER_CARD_CODE = 99999999

export const PLACEHOLDER_MONSTER_CARD_CODE = 99999998

export const PLACEHOLDER_SPELL_TRAP_CARD_CODE = 99999997

export type PlaceholderKind = 'neutral' | 'monster' | 'spellTrap'

export const PLACEHOLDER_CARD_NAME = '占位'

export const PLACEHOLDER_CARD_LABEL = '占位'

export const PLACEHOLDER_NEUTRAL_DESC = '占位卡，可以是怪兽卡、魔法卡、陷阱卡'

export const PLACEHOLDER_MONSTER_DESC = '怪兽占位卡'

export const PLACEHOLDER_SPELL_TRAP_DESC = '占位卡，可以是魔法卡、陷阱卡'

const PLACEHOLDER_KIND_BY_CODE: Record<number, PlaceholderKind> = {
  [PLACEHOLDER_CARD_CODE]: 'neutral',
  [PLACEHOLDER_MONSTER_CARD_CODE]: 'monster',
  [PLACEHOLDER_SPELL_TRAP_CARD_CODE]: 'spellTrap'
}

export function placeholderKindOf(code: number | undefined): PlaceholderKind | null {
  if (code === undefined) return null
  return PLACEHOLDER_KIND_BY_CODE[code] ?? null
}

export function isPlaceholderCard(code: number | undefined): boolean {
  return placeholderKindOf(code) !== null
}

export function placeholderCardType(kind: PlaceholderKind): number {
  switch (kind) {
    case 'monster':
      return CardType.MONSTER | CardType.NORMAL
    case 'spellTrap':
      return CardType.SPELL
    default:
      return 0
  }
}

export function placeholderKindLabel(kind: PlaceholderKind): string {
  switch (kind) {
    case 'monster':
      return '怪兽'
    case 'spellTrap':
      return '魔陷'
    default:
      return '未定'
  }
}

export function placeholderCardData(code: number): CdbCard | null {
  const kind = placeholderKindOf(code)
  if (!kind) return null
  const isSpellTrap = kind === 'spellTrap'
  return {
    id: code,
    ot: 0,
    alias: 0,
    setcode: 0,
    type: isSpellTrap ? CardType.SPELL : CardType.MONSTER | CardType.NORMAL,
    atk: 0,
    def: 0,
    level: isSpellTrap ? 0 : 1,
    race: isSpellTrap ? 0 : CardRace.WARRIOR,
    attribute: isSpellTrap ? 0 : CardAttribute.EARTH,
    category: 0,
    name: PLACEHOLDER_CARD_NAME,
    desc: isSpellTrap
      ? PLACEHOLDER_SPELL_TRAP_DESC
      : kind === 'monster'
        ? PLACEHOLDER_MONSTER_DESC
        : PLACEHOLDER_NEUTRAL_DESC
  }
}
