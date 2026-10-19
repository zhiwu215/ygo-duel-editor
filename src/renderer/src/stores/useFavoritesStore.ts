import { create } from 'zustand'

interface FavoritesState {
  favorites: number[]
  favoritesSet: Set<number>
  loadFavorites: () => Promise<void>
  toggleFavorite: (code: number) => Promise<boolean>
  isFavorite: (code: number) => boolean
}

function applyFavorites(set: (partial: Partial<FavoritesState>) => void, favs: number[]): void {
  set({ favorites: favs, favoritesSet: new Set(favs) })
}

export const useFavoritesStore = create<FavoritesState>((set, get) => ({
  favorites: [],
  favoritesSet: new Set<number>(),

  loadFavorites: async (): Promise<void> => {
    try {
      const favs = await window.api.getFavorites()
      applyFavorites(set, favs)
    } catch (err) {
      console.error('[FavoritesStore] loadFavorites error:', err)
    }
  },

  toggleFavorite: async (code: number): Promise<boolean> => {
    try {
      const res = await window.api.toggleFavorite(code)
      applyFavorites(set, res.favorites)
      return res.isFavorite
    } catch (err) {
      console.error('[FavoritesStore] toggleFavorite error:', err)
      return false
    }
  },

  isFavorite: (code: number): boolean => {
    return get().favoritesSet.has(code)
  }
}))

if (typeof window !== 'undefined' && window.api?.onFavoritesChanged) {
  window.api.onFavoritesChanged((newFavs) => {
    applyFavorites(useFavoritesStore.setState, newFavs)
  })
}
