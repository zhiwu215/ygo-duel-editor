import { create } from 'zustand'
import { CdbCard, CardSearchParams } from '@shared/index'

const PAGE_SIZE = 40

interface CardSearchStoreState {
  keyword: string
  typeFilter: number
  results: CdbCard[]
  isLoading: boolean
  isLoadingMore: boolean
  hasMore: boolean
  hasSearched: boolean

  setKeyword: (keyword: string) => void
  setTypeFilter: (type: number) => void
  search: (customParams?: Partial<CardSearchParams>) => Promise<void>
  loadMore: () => Promise<void>
  clear: () => void
}

export const useCardSearchStore = create<CardSearchStoreState>((set, get) => ({
  keyword: '',
  typeFilter: 0,
  results: [],
  isLoading: false,
  isLoadingMore: false,
  hasMore: true,
  hasSearched: false,

  setKeyword: (keyword) => set({ keyword }),
  setTypeFilter: (typeFilter) => {
    set({ typeFilter })
    get().search()
  },

  search: async (customParams = {}) => {
    const currentKeyword = customParams.keyword !== undefined ? customParams.keyword : get().keyword
    const currentType = customParams.type !== undefined ? customParams.type : get().typeFilter
    set({
      keyword: currentKeyword,
      typeFilter: currentType,
      isLoading: true,
      hasMore: true
    })
    try {
      const params: CardSearchParams = {
        keyword: currentKeyword,
        type: currentType,
        limit: customParams.limit || PAGE_SIZE,
        offset: 0,
        ...customParams
      }
      const cards = await window.api.searchCards(params)
      set({
        results: cards,
        isLoading: false,
        hasSearched: true,
        hasMore: cards.length >= (params.limit || PAGE_SIZE)
      })
    } catch (err) {
      console.error('[useCardSearchStore] search failed:', err)
      set({ results: [], isLoading: false, hasSearched: true, hasMore: false })
    }
  },

  loadMore: async () => {
    const { keyword, typeFilter, results, isLoading, isLoadingMore, hasMore } = get()
    if (isLoading || isLoadingMore || !hasMore) return

    set({ isLoadingMore: true })
    try {
      const params: CardSearchParams = {
        keyword,
        type: typeFilter,
        limit: PAGE_SIZE,
        offset: results.length
      }
      const newCards = await window.api.searchCards(params)
      if (newCards.length === 0) {
        set({ isLoadingMore: false, hasMore: false })
        return
      }

      const existingIds = new Set(results.map((c) => c.id))
      const uniqueNewCards = newCards.filter((c) => !existingIds.has(c.id))

      set({
        results: [...results, ...uniqueNewCards],
        isLoadingMore: false,
        hasMore: newCards.length >= PAGE_SIZE
      })
    } catch (err) {
      console.error('[useCardSearchStore] loadMore failed:', err)
      set({ isLoadingMore: false, hasMore: false })
    }
  },

  clear: () => set({ keyword: '', typeFilter: 0, results: [], hasSearched: false, hasMore: true })
}))
