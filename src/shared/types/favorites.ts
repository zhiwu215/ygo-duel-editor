export interface FavoriteCategory {
  id: string
  name: string
  cards: number[]
}

export interface FavoritesState {
  favorites: number[]
  categories: FavoriteCategory[]
}
