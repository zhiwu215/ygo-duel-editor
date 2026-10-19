import { useEffect, useState } from 'react'
import { CdbCard } from '@shared/index'

export function useFavoriteCards(active: boolean, favorites: number[]): CdbCard[] {
  const [favoriteCards, setFavoriteCards] = useState<CdbCard[]>([])

  useEffect(() => {
    let canceled = false
    if (!active || favorites.length === 0) {
      Promise.resolve().then(() => {
        if (!canceled) setFavoriteCards([])
      })
      return () => {
        canceled = true
      }
    }
    window.api
      ?.getCardsByIds(favorites)
      .then((map) => {
        if (canceled) return
        const list = favorites.map((code) => map[code]).filter(Boolean) as CdbCard[]
        setFavoriteCards(list)
      })
      .catch((err) => console.error('[DeckSearchPanel] load favorites details error:', err))
    return () => {
      canceled = true
    }
  }, [active, favorites])

  useEffect(() => {
    return window.api.onCdbUpdated(() => {
      if (!active || favorites.length === 0) return
      void window.api
        .getCardsByIds(favorites)
        .then((map) => {
          setFavoriteCards(favorites.map((code) => map[code]).filter(Boolean) as CdbCard[])
        })
        .catch((err) => console.error('[DeckSearchPanel] refresh favorites error:', err))
    })
  }, [active, favorites])

  return favoriteCards
}
