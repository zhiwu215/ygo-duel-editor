import { useEffect, useRef, useState } from 'react'
import { CdbCard } from '@shared/index'
import { PAGE_SIZE } from '../utils/cardSearchQuery'

interface PickerSearchState {
  kw: string
  cards: CdbCard[]
  total: number
}

export function useCardPickerSearch(pageSize = PAGE_SIZE): {
  keyword: string
  setKeyword: (value: string) => void
  results: CdbCard[]
  searching: boolean
  loadingMore: boolean
  hasSearched: boolean
  loadMore: () => Promise<void>
} {
  const [keyword, setKeyword] = useState<string>('')
  const [state, setState] = useState<PickerSearchState>({ kw: '', cards: [], total: 0 })
  const [searching, setSearching] = useState<boolean>(false)
  const [loadingMore, setLoadingMore] = useState<boolean>(false)
  const [hasSearched, setHasSearched] = useState<boolean>(false)
  const requestRef = useRef<number>(0)

  useEffect(() => {
    const kw = keyword.trim()
    if (!kw) return
    let cancelled = false
    const timer = setTimeout(() => {
      const requestId = requestRef.current + 1
      requestRef.current = requestId
      setSearching(true)
      window.api
        .searchCards({ keyword: kw, limit: pageSize, offset: 0 })
        .then((res) => {
          if (cancelled || requestId !== requestRef.current) return
          setState({ kw, cards: res.cards || [], total: res.total || 0 })
          setHasSearched(true)
        })
        .catch((err) => {
          console.error('[useCardPickerSearch] search failed:', err)
          if (!cancelled && requestId === requestRef.current) {
            setState({ kw, cards: [], total: 0 })
            setHasSearched(true)
          }
        })
        .finally(() => {
          if (requestId === requestRef.current) setSearching(false)
        })
    }, 250)
    return () => {
      cancelled = true
      clearTimeout(timer)
    }
  }, [keyword, pageSize])

  const trimmed = keyword.trim()
  const results = state.kw === trimmed ? state.cards : []

  const loadMore = async (): Promise<void> => {
    if (!trimmed || searching || loadingMore || state.kw !== trimmed) return
    if (state.cards.length >= state.total) return
    setLoadingMore(true)
    try {
      const res = await window.api.searchCards({
        keyword: trimmed,
        limit: pageSize,
        offset: state.cards.length
      })
      setState((previous) => {
        if (previous.kw !== trimmed) return previous
        const ids = new Set(previous.cards.map((card) => card.id))
        const cards = [...previous.cards, ...(res.cards || []).filter((card) => !ids.has(card.id))]
        return { kw: trimmed, cards, total: res.total || previous.total }
      })
    } catch (err) {
      console.error('[useCardPickerSearch] loadMore failed:', err)
    } finally {
      setLoadingMore(false)
    }
  }

  return {
    keyword,
    setKeyword,
    results,
    searching,
    loadingMore,
    hasSearched,
    loadMore
  }
}
