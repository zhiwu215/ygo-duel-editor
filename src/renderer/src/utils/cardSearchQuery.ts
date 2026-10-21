import type { CardSearchParams } from '@shared/index'
import type { CardSearchFilters } from '../stores/useCardSearchStore'

export const PAGE_SIZE = 40

export function buildSearchParams(
  filters: CardSearchFilters,
  customParams: Partial<CardSearchParams> = {}
): CardSearchParams {
  return {
    keyword: customParams.keyword !== undefined ? customParams.keyword : filters.keyword,
    searchDesc:
      customParams.searchDesc !== undefined ? customParams.searchDesc : filters.searchDesc,
    showUnofficial:
      customParams.showUnofficial !== undefined
        ? customParams.showUnofficial
        : filters.showUnofficial,
    onlyFavorites:
      customParams.onlyFavorites !== undefined ? customParams.onlyFavorites : filters.onlyFavorites,
    type: customParams.type !== undefined ? customParams.type : filters.type,
    subType: customParams.subType !== undefined ? customParams.subType : filters.subType,
    attribute: customParams.attribute !== undefined ? customParams.attribute : filters.attribute,
    race: customParams.race !== undefined ? customParams.race : filters.race,
    level: customParams.level !== undefined ? customParams.level : filters.level,
    levelOp: customParams.levelOp !== undefined ? customParams.levelOp : filters.levelOp,
    scale: customParams.scale !== undefined ? customParams.scale : filters.scale,
    scaleOp: customParams.scaleOp !== undefined ? customParams.scaleOp : filters.scaleOp,
    effectCategoryMask:
      customParams.effectCategoryMask !== undefined
        ? customParams.effectCategoryMask
        : filters.effectCategoryMask,
    cardPool: customParams.cardPool !== undefined ? customParams.cardPool : filters.cardPool,
    markers: customParams.markers !== undefined ? customParams.markers : filters.markers,
    limitFilter:
      customParams.limitFilter !== undefined ? customParams.limitFilter : filters.limitFilter,
    atk: customParams.atk !== undefined ? customParams.atk : filters.atk,
    atkOp: customParams.atkOp !== undefined ? customParams.atkOp : filters.atkOp,
    def: customParams.def !== undefined ? customParams.def : filters.def,
    defOp: customParams.defOp !== undefined ? customParams.defOp : filters.defOp,
    sortField: customParams.sortField !== undefined ? customParams.sortField : filters.sortField,
    sortOrder: customParams.sortOrder !== undefined ? customParams.sortOrder : filters.sortOrder,
    limit: customParams.limit || PAGE_SIZE,
    offset: 0,
    ...customParams
  }
}
