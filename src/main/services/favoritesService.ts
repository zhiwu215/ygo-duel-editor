import { randomUUID } from 'crypto'
import type { FavoriteCategory, FavoritesState } from '@shared/index'
import { configService } from './configService'
import { broadcastToWindows } from './broadcast'

function normalizeCards(value: unknown): number[] {
  if (!Array.isArray(value)) return []
  const cards = value.filter(
    (code): code is number => Number.isInteger(code) && (code as number) > 0
  )
  return Array.from(new Set(cards))
}

function normalizeCategories(value: unknown): FavoriteCategory[] {
  if (!Array.isArray(value)) return []
  const seen = new Set<string>()
  const categories: FavoriteCategory[] = []
  for (const raw of value) {
    if (!raw || typeof raw !== 'object') continue
    const item = raw as Partial<FavoriteCategory>
    const name = typeof item.name === 'string' ? item.name.trim() : ''
    if (!name) continue
    const id = typeof item.id === 'string' && item.id.length > 0 ? item.id : randomUUID()
    if (seen.has(id)) continue
    seen.add(id)
    categories.push({ id, name, cards: normalizeCards(item.cards) })
  }
  return categories
}

class FavoritesService {
  public getState(): FavoritesState {
    const config = configService.get()
    const favorites = new Set(normalizeCards(config.favorites))
    const categories = normalizeCategories(config.favoriteCategories)
    for (const category of categories) {
      for (const code of category.cards) favorites.add(code)
    }
    return { favorites: Array.from(favorites), categories }
  }

  public getCodesFor(categoryId: string | undefined): number[] {
    const state = this.getState()
    if (categoryId) {
      return state.categories.find((category) => category.id === categoryId)?.cards ?? []
    }
    const categorized = new Set(state.categories.flatMap((category) => category.cards))
    return state.favorites.filter((code) => !categorized.has(code))
  }

  public toggle(code: number): FavoritesState {
    const state = this.getState()
    const favorites = new Set(state.favorites)
    const removing = favorites.has(code)
    if (removing) favorites.delete(code)
    else favorites.add(code)
    const categories = removing
      ? state.categories.map((category) =>
          category.cards.includes(code)
            ? { ...category, cards: category.cards.filter((item) => item !== code) }
            : category
        )
      : state.categories
    return this.persist({ favorites: Array.from(favorites), categories })
  }

  public setUngrouped(code: number): FavoritesState {
    const state = this.getState()
    const favorites = state.favorites.includes(code) ? state.favorites : [...state.favorites, code]
    const categories = state.categories.map((category) =>
      category.cards.includes(code)
        ? { ...category, cards: category.cards.filter((item) => item !== code) }
        : category
    )
    return this.persist({ favorites, categories })
  }

  public addCategory(name: string): FavoritesState & { id: string } {
    const state = this.getState()
    const category: FavoriteCategory = { id: randomUUID(), name, cards: [] }
    return {
      ...this.persist({ ...state, categories: [...state.categories, category] }),
      id: category.id
    }
  }

  public renameCategory(id: string, name: string): FavoritesState {
    const state = this.getState()
    const categories = state.categories.map((category) =>
      category.id === id ? { ...category, name } : category
    )
    return this.persist({ ...state, categories })
  }

  public deleteCategory(id: string): FavoritesState {
    const state = this.getState()
    const target = state.categories.find((category) => category.id === id)
    const categories = state.categories.filter((category) => category.id !== id)
    if (!target) return this.persist({ ...state, categories })
    const remaining = new Set(categories.flatMap((category) => category.cards))
    const favorites = state.favorites.filter(
      (code) => !target.cards.includes(code) || remaining.has(code)
    )
    return this.persist({ favorites, categories })
  }

  public setMembership(code: number, categoryId: string, member: boolean): FavoritesState {
    const state = this.getState()
    const categories = state.categories.map((category) => {
      if (category.id !== categoryId) return category
      const cards = new Set(category.cards)
      if (member) cards.add(code)
      else cards.delete(code)
      return { ...category, cards: Array.from(cards) }
    })
    const favorites =
      member && !state.favorites.includes(code) ? [...state.favorites, code] : state.favorites
    return this.persist({ favorites, categories })
  }

  private persist(state: FavoritesState): FavoritesState {
    configService.save({
      favorites: state.favorites,
      favoriteCategories: state.categories
    })
    broadcastToWindows('favorites:changed', state)
    return state
  }
}

export const favoritesService = new FavoritesService()
