import { create } from 'zustand'
import type { FavoriteCategory, FavoritesState } from '@shared/index'

interface FavoritesStore {
  favorites: number[]
  categories: FavoriteCategory[]
  favoritesSet: Set<number>
  categorySets: Map<string, Set<number>>

  loadFavorites: () => Promise<void>
  toggleFavorite: (code: number) => Promise<void>
  isFavorite: (code: number) => boolean
  isUngrouped: (code: number) => boolean
  setCategoryMembership: (code: number, categoryId: string, member: boolean) => Promise<void>
  setUngrouped: (code: number) => Promise<void>
  addCategory: (name: string) => Promise<string | null>
  renameCategory: (id: string, name: string) => Promise<void>
  deleteCategory: (id: string) => Promise<void>
}

export function isInAnyCategory(categorySets: Map<string, Set<number>>, code: number): boolean {
  for (const cards of categorySets.values()) {
    if (cards.has(code)) return true
  }
  return false
}

function applyState(set: (partial: Partial<FavoritesStore>) => void, state: FavoritesState): void {
  const categorySets = new Map<string, Set<number>>()
  for (const category of state.categories) {
    categorySets.set(category.id, new Set(category.cards))
  }
  set({
    favorites: state.favorites,
    categories: state.categories,
    favoritesSet: new Set(state.favorites),
    categorySets
  })
}

export const useFavoritesStore = create<FavoritesStore>((set, get) => ({
  favorites: [],
  categories: [],
  favoritesSet: new Set<number>(),
  categorySets: new Map<string, Set<number>>(),

  loadFavorites: async (): Promise<void> => {
    try {
      applyState(set, await window.api.getFavorites())
    } catch (err) {
      console.error('[FavoritesStore] loadFavorites error:', err)
    }
  },

  toggleFavorite: async (code: number): Promise<void> => {
    try {
      applyState(set, await window.api.toggleFavorite(code))
    } catch (err) {
      console.error('[FavoritesStore] toggleFavorite error:', err)
    }
  },

  isFavorite: (code: number): boolean => get().favoritesSet.has(code),

  isUngrouped: (code: number): boolean =>
    get().favoritesSet.has(code) && !isInAnyCategory(get().categorySets, code),

  setCategoryMembership: async (code, categoryId, member): Promise<void> => {
    try {
      applyState(set, await window.api.setFavoriteCategory(code, categoryId, member))
    } catch (err) {
      console.error('[FavoritesStore] setCategoryMembership error:', err)
    }
  },

  setUngrouped: async (code): Promise<void> => {
    try {
      applyState(set, await window.api.setFavoriteUngrouped(code))
    } catch (err) {
      console.error('[FavoritesStore] setUngrouped error:', err)
    }
  },

  addCategory: async (name: string): Promise<string | null> => {
    try {
      const state = await window.api.addFavoriteCategory(name)
      applyState(set, state)
      return state.id
    } catch (err) {
      console.error('[FavoritesStore] addCategory error:', err)
      return null
    }
  },

  renameCategory: async (id: string, name: string): Promise<void> => {
    try {
      applyState(set, await window.api.renameFavoriteCategory(id, name))
    } catch (err) {
      console.error('[FavoritesStore] renameCategory error:', err)
    }
  },

  deleteCategory: async (id: string): Promise<void> => {
    try {
      applyState(set, await window.api.deleteFavoriteCategory(id))
    } catch (err) {
      console.error('[FavoritesStore] deleteCategory error:', err)
    }
  }
}))

if (typeof window !== 'undefined' && window.api?.onFavoritesChanged) {
  window.api.onFavoritesChanged((state) => {
    applyState(useFavoritesStore.setState, state)
  })
}

if (typeof window !== 'undefined' && window.api) {
  void useFavoritesStore.getState().loadFavorites()
}
