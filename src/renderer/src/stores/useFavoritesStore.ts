import { create } from 'zustand'

interface FavoritesState {
  favorites: number[]
  favoritesSet: Set<number>
  loaded: boolean
  loadFavorites: () => Promise<void>
  toggleFavorite: (code: number) => Promise<boolean>
  isFavorite: (code: number) => boolean
}

export const useFavoritesStore = create<FavoritesState>((set, get) => ({
  favorites: [],
  favoritesSet: new Set<number>(),
  loaded: false,

  loadFavorites: async (): Promise<void> => {
    try {
      const favs = await window.api.getFavorites()
      set({
        favorites: favs,
        favoritesSet: new Set(favs),
        loaded: true
      })
    } catch (err) {
      console.error('[FavoritesStore] loadFavorites error:', err)
    }
  },

  toggleFavorite: async (code: number): Promise<boolean> => {
    try {
      const res = await window.api.toggleFavorite(code)
      set({
        favorites: res.favorites,
        favoritesSet: new Set(res.favorites)
      })
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

// 全局监听跨窗口收藏状态广播
if (typeof window !== 'undefined' && window.api?.onFavoritesChanged) {
  window.api.onFavoritesChanged((newFavs) => {
    useFavoritesStore.setState({
      favorites: newFavs,
      favoritesSet: new Set(newFavs),
      loaded: true
    })
  })
}
