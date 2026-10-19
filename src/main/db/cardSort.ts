import { CdbCard, CardSearchParams, CardType, NumericCompareOp } from '@shared/index'

export const COMPARATOR: Record<Exclude<NumericCompareOp, 'unknown'>, string> = {
  eq: '=',
  gt: '>',
  gte: '>=',
  lt: '<',
  lte: '<='
}

function subtypeOrder(type: number): number {
  return type & 0x48020c0 ? type & 0x48020c1 : type & 0x31
}

type MonsterSortStep = 'sub' | 'level' | 'atk' | 'def'

function deckSortComparator(
  params: CardSearchParams,
  monsterSteps: MonsterSortStep[]
): (a: CdbCard, b: CdbCard) => number {
  const keyDir = params.sortOrder === 'ASC' ? 1 : -1
  const groupDir = -keyDir
  const stepValue = (card: CdbCard, step: MonsterSortStep): number => {
    if (step === 'sub') return subtypeOrder(card.type)
    if (step === 'level') return (card.level ?? 0) & 255
    if (step === 'atk') return card.atk ?? 0
    return card.def ?? 0
  }
  return (a, b) => {
    const at = a.type & 0x7
    const bt = b.type & 0x7
    if (at !== bt) return (at - bt) * groupDir
    if (at !== CardType.MONSTER) {
      const ar = a.type & ~0x7
      const br = b.type & ~0x7
      if (ar !== br) return (ar - br) * groupDir
      return (a.id ?? 0) - (b.id ?? 0)
    }
    for (const step of monsterSteps) {
      const av = stepValue(a, step)
      const bv = stepValue(b, step)
      if (av !== bv) return (av - bv) * keyDir
    }
    return (a.id ?? 0) - (b.id ?? 0)
  }
}

export function compareCards(params: CardSearchParams): (a: CdbCard, b: CdbCard) => number {
  const dir = params.sortOrder === 'ASC' ? 1 : -1
  switch (params.sortField) {
    case 'atk':
      return deckSortComparator(params, ['atk', 'def', 'level', 'sub'])
    case 'def':
      return deckSortComparator(params, ['def', 'atk', 'level', 'sub'])
    case 'name':
      return (a, b) => {
        const res = String(a.name ?? '').localeCompare(String(b.name ?? ''))
        if (res !== 0) return res * dir
        return (a.id ?? 0) - (b.id ?? 0)
      }
    default:
      return deckSortComparator(params, ['sub', 'level', 'atk', 'def'])
  }
}

export function sortExactFirst(cards: CdbCard[], params: CardSearchParams): CdbCard[] {
  const keyword = (params.keyword ?? '').trim()
  if (keyword.length === 0) return [...cards].sort(compareCards(params))
  const exact: CdbCard[] = []
  const rest: CdbCard[] = []
  for (const card of cards) {
    if (card.name === keyword) exact.push(card)
    else rest.push(card)
  }
  exact.sort((a, b) => (a.id ?? 0) - (b.id ?? 0))
  rest.sort(compareCards(params))
  return [...exact, ...rest]
}
