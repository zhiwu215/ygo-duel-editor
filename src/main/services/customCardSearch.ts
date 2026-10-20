import { CardSearchParams, CardType, CustomCard, CdbCard, customCardToCdbCard } from '@shared/index'
import { parseSearchTokens } from '../db/searchTokens'
import { computeCustomCardKeys, type CardSortRow } from '../db/cardSort'
import { isCustomCdbLoaded } from './customCardLibrary'

export function matchNumeric(
  value: number,
  op: 'eq' | 'gt' | 'gte' | 'lt' | 'lte' | 'unknown' | undefined,
  target: number | undefined,
  allowUnknown = false
): boolean {
  const compare = op ?? 'eq'
  if (compare === 'unknown') return allowUnknown && value === -2
  if (target === undefined || target < 0) return true
  if (value < 0) return false
  switch (compare) {
    case 'eq':
      return value === target
    case 'gt':
      return value > target
    case 'gte':
      return value >= target
    case 'lt':
      return value < target
    case 'lte':
      return value <= target
    default:
      return true
  }
}

export function matchKeyword(card: CustomCard, params: CardSearchParams): boolean {
  const keyword = (params.keyword ?? '').trim()
  if (keyword.length === 0) return true
  if (/^\d+$/.test(keyword)) {
    return card.id === parseInt(keyword, 10) || card.name.includes(keyword)
  }
  for (const token of parseSearchTokens(keyword)) {
    const inName = card.name.includes(token.text)
    const inDesc = params.searchDesc !== false && card.desc.includes(token.text)
    const matched = token.mode === 'name' ? inName : token.mode === 'set' ? false : inName || inDesc
    if (token.excluded ? matched : !matched) return false
  }
  return true
}

export function matchFilters(
  card: CustomCard,
  params: CardSearchParams,
  favorites?: number[]
): boolean {
  if (params.onlyFavorites) {
    if (!favorites || !favorites.includes(card.id)) return false
  }
  if (params.type !== undefined && params.type !== 0 && (card.type & params.type) === 0) {
    return false
  }
  if (params.subType !== undefined && params.subType !== 0) {
    if (params.type === CardType.SPELL || params.type === CardType.TRAP) {
      if (card.type !== params.subType) return false
    } else if ((card.type & params.subType) !== params.subType) {
      return false
    }
  }
  if (params.attribute !== undefined && params.attribute !== 0) {
    if ((card.attribute & params.attribute) === 0) return false
  }
  if (params.race !== undefined && params.race !== 0) {
    if ((card.race & params.race) === 0) return false
  }
  if (params.level !== undefined && params.level > 0) {
    if (!matchNumeric(card.level & 255, params.levelOp, params.level)) return false
  }
  if (params.scale !== undefined) {
    if ((card.type & CardType.PENDULUM) === 0) return false
    if (!matchNumeric((card.level >>> 24) & 255, params.scaleOp, params.scale)) return false
  }
  if (
    !matchNumeric(card.atk, params.atkOp, params.atk, true) ||
    !matchNumeric(card.def, params.defOp, params.def, true)
  ) {
    return false
  }
  if (params.atk !== undefined && params.atk >= 0 && card.atk === -2) return false
  if ((params.def !== undefined && params.def >= 0) || params.defOp === 'unknown') {
    if ((card.type & CardType.LINK) !== 0) return false
    if (params.def !== undefined && params.def >= 0 && card.def === -2) return false
  }
  if (params.effectCategoryMask !== undefined && params.effectCategoryMask > 0) return false
  if (params.limitFilter) return false
  if (params.markers !== undefined && params.markers !== 0) {
    if ((card.type & CardType.LINK) === 0) return false
    if ((card.def & params.markers) !== params.markers) return false
  }
  if (params.cardPool !== undefined && params.cardPool !== 'any') return false
  return true
}

// 自建卡补上排序键后交由 cdbService 统一排序，保持与 SQL 结果同一套规则
export function searchCustomCardRows(
  cards: CustomCard[],
  params: CardSearchParams,
  fetchLimit: number,
  favorites?: number[]
): { rows: CardSortRow[]; total: number } {
  if (isCustomCdbLoaded()) return { rows: [], total: 0 }
  const keyword = (params.keyword ?? '').trim()
  const matched = cards
    .filter((card) => matchKeyword(card, params) && matchFilters(card, params, favorites))
    .map(customCardToCdbCard)
    .map((card) => computeCustomCardKeys(card, keyword))
  return { rows: matched.slice(0, fetchLimit), total: matched.length }
}

export function mergeCardsByIds(
  map: Record<number, CdbCard>,
  ids: number[],
  ensureCards: () => CustomCard[]
): Record<number, CdbCard> {
  if (isCustomCdbLoaded()) return map
  const cards = ensureCards()
  for (const id of ids) {
    if (map[id]) continue
    const card = cards.find((c) => c.id === id)
    if (card) map[id] = customCardToCdbCard(card)
  }
  return map
}
