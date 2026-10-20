import { create } from 'zustand'
import {
  CdbCard,
  CardPoolFilter,
  CardSearchParams,
  LimitFilter,
  NumericCompareOp
} from '@shared/index'
import { bumpCardImageVersion } from '../utils/cardImage'
import { PAGE_SIZE, buildSearchParams } from '../utils/cardSearchQuery'

export interface CardSearchFilters {
  keyword: string
  searchDesc: boolean
  onlyFavorites: boolean
  type: number
  subType: number
  attribute: number
  race: number
  level: number
  levelOp: NumericCompareOp
  scale: number | undefined
  scaleOp: NumericCompareOp
  effectCategoryMask: number
  cardPool: CardPoolFilter
  markers: number
  limitFilter: LimitFilter
  atk: number | undefined
  atkOp: NumericCompareOp
  def: number | undefined
  defOp: NumericCompareOp
  code: number | undefined
  sortField: 'atk' | 'def' | 'level' | 'name'
  sortOrder: 'ASC' | 'DESC'
}

export const DEFAULT_FILTERS: CardSearchFilters = {
  keyword: '',
  searchDesc: true,
  onlyFavorites: false,
  type: 0,
  subType: 0,
  attribute: 0,
  race: 0,
  level: 0,
  levelOp: 'eq',
  scale: undefined,
  scaleOp: 'eq',
  effectCategoryMask: 0,
  cardPool: 'any',
  markers: 0,
  limitFilter: 0,
  atk: undefined,
  atkOp: 'eq',
  def: undefined,
  defOp: 'eq',
  code: undefined,
  sortField: 'level',
  sortOrder: 'DESC'
}

export function countActiveFilters(filters: CardSearchFilters): number {
  let count = 0
  if (filters.type !== 0) count++
  if (filters.subType !== 0) count++
  if (filters.attribute !== 0) count++
  if (filters.race !== 0) count++
  if (filters.level !== 0) count++
  if (filters.scale !== undefined) count++
  if (filters.effectCategoryMask !== 0) count++
  if (filters.cardPool !== 'any') count++
  if (filters.markers !== 0) count++
  if (filters.limitFilter !== 0) count++
  if (filters.atk !== undefined || filters.atkOp === 'unknown') count++
  if (filters.def !== undefined || filters.defOp === 'unknown') count++
  if (filters.code !== undefined) count++
  if (!filters.searchDesc) count++
  if (filters.onlyFavorites) count++
  if (filters.sortField !== 'level') count++
  return count
}

export interface CardSearchStoreState extends CardSearchFilters {
  results: CdbCard[]
  total: number
  isLoading: boolean
  isLoadingMore: boolean
  hasMore: boolean
  hasSearched: boolean
  isFilterOpen: boolean

  toggleFilterOpen: () => void
  setKeyword: (keyword: string) => void
  setFilters: (partial: Partial<CardSearchFilters>) => void
  resetFilters: () => void
  search: (customParams?: Partial<CardSearchParams>) => Promise<void>
  loadMore: () => Promise<void>
}

export const useCardSearchStore = create<CardSearchStoreState>((set, get) => ({
  ...DEFAULT_FILTERS,
  results: [],
  total: 0,
  isLoading: false,
  isLoadingMore: false,
  hasMore: true,
  hasSearched: false,
  isFilterOpen: false,

  toggleFilterOpen: () => set((state) => ({ isFilterOpen: !state.isFilterOpen })),

  setKeyword: (keyword) => set({ keyword }),

  setFilters: (partial) => {
    set((state) => ({ ...state, ...partial }))
    get().search()
  },

  resetFilters: () => {
    set({
      ...DEFAULT_FILTERS,
      keyword: get().keyword
    })
    get().search()
  },

  search: async (customParams = {}) => {
    const state = get()
    const mergedParams: CardSearchParams = buildSearchParams(state, customParams)

    set({
      isLoading: true,
      hasMore: true
    })

    try {
      const res = await window.api.searchCards(mergedParams)
      set({
        results: res.cards,
        total: res.total,
        isLoading: false,
        hasSearched: true,
        hasMore: res.cards.length < res.total
      })
    } catch (err) {
      console.error('[useCardSearchStore] search failed:', err)
      set({ results: [], total: 0, isLoading: false, hasSearched: true, hasMore: false })
    }
  },

  loadMore: async () => {
    const state = get()
    if (state.isLoading || state.isLoadingMore || !state.hasMore) return

    set({ isLoadingMore: true })
    try {
      const params: CardSearchParams = buildSearchParams(state, {
        limit: PAGE_SIZE,
        offset: state.results.length
      })

      const res = await window.api.searchCards(params)
      if (res.cards.length === 0) {
        set({ isLoadingMore: false, hasMore: false })
        return
      }

      const existingIds = new Set(state.results.map((c) => c.id))
      const uniqueNewCards = res.cards.filter((c) => !existingIds.has(c.id))
      const results = [...state.results, ...uniqueNewCards]

      set({
        results,
        total: res.total,
        isLoadingMore: false,
        hasMore: results.length < res.total
      })
    } catch (err) {
      console.error('[useCardSearchStore] loadMore failed:', err)
      set({ isLoadingMore: false, hasMore: false })
    }
  }
}))

if (typeof window !== 'undefined' && window.api?.onCdbUpdated) {
  window.api.onCdbUpdated(() => {
    bumpCardImageVersion()
    const state = useCardSearchStore.getState()
    if (!state.hasSearched) return
    void state.search()
  })
}

if (typeof window !== 'undefined' && window.api?.onCustomCardsUpdated) {
  window.api.onCustomCardsUpdated(() => {
    bumpCardImageVersion()
    const state = useCardSearchStore.getState()
    if (!state.hasSearched) return
    void state.search()
  })
}

if (typeof window !== 'undefined' && window.api?.onFavoritesChanged) {
  window.api.onFavoritesChanged(() => {
    const state = useCardSearchStore.getState()
    if (!state.hasSearched || !state.onlyFavorites) return
    void state.search()
  })
}
