import { CdbCard, CardSearchParams, NumericCompareOp } from '@shared/index'

export const COMPARATOR: Record<Exclude<NumericCompareOp, 'unknown'>, string> = {
  eq: '=',
  gt: '>',
  gte: '>=',
  lt: '<',
  lte: '<='
}

// SQL (cdbSearchSql) 在 SELECT 中输出的排序键：跨库合并排序的唯一事实来源，
// JS 侧只读键值，不重复实现任何排序公式
export interface CardSortRow extends CdbCard {
  relKey: number
  typeKey: number
  subKey: number
  levelKey: number
  atkKey: number
  defKey: number
}

type SortKeyField = Exclude<keyof CardSortRow, keyof CdbCard>

const STEPS_BY_SORT_FIELD: Record<'atk' | 'def' | 'name' | 'level', Array<[SortKeyField, 'key' | 'group']>> = {
  atk: [
    ['atkKey', 'key'],
    ['defKey', 'key'],
    ['levelKey', 'key'],
    ['subKey', 'group']
  ],
  def: [
    ['defKey', 'key'],
    ['atkKey', 'key'],
    ['levelKey', 'key'],
    ['subKey', 'group']
  ],
  name: [],
  level: [
    ['subKey', 'group'],
    ['levelKey', 'key'],
    ['atkKey', 'key'],
    ['defKey', 'key']
  ]
}

export function sortCards(rows: CardSortRow[], params: CardSearchParams): CdbCard[] {
  const dir = params.sortOrder === 'ASC' ? 1 : -1
  const groupDir = -dir
  const steps = STEPS_BY_SORT_FIELD[params.sortField ?? 'level']
  return [...rows].sort((a, b) => {
    if (a.relKey !== b.relKey) return a.relKey - b.relKey
    if (params.sortField === 'name') {
      const cmp = Buffer.compare(Buffer.from(a.name ?? '', 'utf8'), Buffer.from(b.name ?? '', 'utf8'))
      if (cmp !== 0) return cmp * dir
      return (a.id ?? 0) - (b.id ?? 0)
    }
    const at = a.typeKey
    const bt = b.typeKey
    if (at !== bt) return (at - bt) * groupDir
    if (at !== 1) {
      if (a.subKey !== b.subKey) return (a.subKey - b.subKey) * groupDir
      return ((a.id ?? 0) - (b.id ?? 0)) * groupDir
    }
    for (const [field, mode] of steps) {
      const av = a[field]
      const bv = b[field]
      if (av !== bv) return (av - bv) * (mode === 'key' ? dir : groupDir)
    }
    return ((a.id ?? 0) - (b.id ?? 0)) * groupDir
  })
}

const SORT_KEY_FIELDS: SortKeyField[] = ['relKey', 'typeKey', 'subKey', 'levelKey', 'atkKey', 'defKey']

export function stripSortKeys(card: CdbCard): void {
  for (const field of SORT_KEY_FIELDS) delete (card as CardSortRow)[field]
}

// 自定义卡不经 SQL、无排序键，此公式为 cdbSearchSql 键表达式的 JS 镜像；
// relKey 同 SortList 规则：仅卡名与搜索词完全相等置顶
export function computeCustomCardKeys(card: CdbCard, keyword: string): CardSortRow {
  const isMonster = (card.type & 7) === 1
  return {
    ...card,
    relKey: keyword.length > 0 && card.name === keyword ? 0 : 1,
    typeKey: card.type & 7,
    subKey: isMonster
      ? (card.type & 0x48020c0) !== 0
        ? card.type & 0x48020c1
        : card.type & 0x31
      : card.type & 4294967288,
    levelKey: isMonster ? card.level & 255 : 0,
    atkKey: isMonster ? card.atk : 0,
    defKey: isMonster ? card.def : 0
  }
}
