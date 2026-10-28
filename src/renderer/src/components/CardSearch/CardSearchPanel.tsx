import React, { useCallback, useEffect, useState, useRef } from 'react'
import {
  Search,
  Loader2,
  SlidersHorizontal,
  ChevronLeft,
  ChevronRight,
  RotateCcw,
  X,
  Plus
} from 'lucide-react'
import { countActiveFilters, useCardSearchStore } from '../../stores/useCardSearchStore'
import { useCustomCardStore } from '../../stores/useCustomCardStore'
import { useDuelStore } from '../../stores/useDuelStore'
import { useDuelEngineStore } from '../../stores/useDuelEngineStore'
import { useFavoritesStore } from '../../stores/useFavoritesStore'
import { CdbCard } from '@shared/index'
import { setCardDragImage } from '../../utils/cardImage'
import { CARD_SEARCH_DRAG_TYPE } from '../../utils/cardDrag'
import { Input } from '../ui/input'
import { Button } from '../ui/button'
import { useDelayedLoading } from '../../hooks/useDelayedLoading'
import { CardRowItem } from './CardRowItem'
import { FavoriteCategoryBar } from './FavoriteCategoryBar'
import { FavoriteCategoryPopover } from './FavoriteCategoryPopover'

export const CardSearchPanel: React.FC = () => {
  const {
    keyword,
    cardPool,
    filterOptions,
    results,
    total,
    isLoading,
    isLoadingMore,
    hasSearched,
    onlyFavorites,
    isFilterOpen,
    toggleFilterOpen,
    setKeyword,
    search,
    loadMore,
    loadFilterOptions,
    resetFilters
  } = useCardSearchStore()
  const activeFilterCount = useCardSearchStore(countActiveFilters)
  const openCreate = useCustomCardStore((state) => state.openCreate)

  const { setHoveredCard } = useDuelStore()
  const { isFavorite, toggleFavorite, loadFavorites } = useFavoritesStore()
  const isReplay = useDuelEngineStore((s) => s.replayInfo !== null)
  const showSearchProgress = useDelayedLoading(isLoading)
  const [localKw, setLocalKw] = useState(keyword)
  const [favoriteMenu, setFavoriteMenu] = useState<{
    card: CdbCard
    x: number
    y: number
  } | null>(null)
  const scrollRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    void loadFavorites()
  }, [loadFavorites])

  useEffect(() => {
    search({ limit: 40 })
  }, [search])

  useEffect(() => {
    void loadFilterOptions()
  }, [loadFilterOptions])

  useEffect(() => {
    if (isLoading) {
      scrollRef.current?.scrollTo({ top: 0 })
    }
  }, [isLoading])

  const handleSearchSubmit = (e: React.FormEvent): void => {
    e.preventDefault()
    setKeyword(localKw)
    search({ keyword: localKw })
  }

  const handleScroll = (e: React.UIEvent<HTMLDivElement>): void => {
    const { scrollTop, scrollHeight, clientHeight } = e.currentTarget
    if (scrollHeight - scrollTop - clientHeight < 300) {
      loadMore()
    }
  }

  const handleDragStart = useCallback((e: React.DragEvent, card: CdbCard): void => {
    e.dataTransfer.setData(CARD_SEARCH_DRAG_TYPE, '1')
    e.dataTransfer.setData('application/json', JSON.stringify(card))
    e.dataTransfer.effectAllowed = 'copy'
    setCardDragImage(e.dataTransfer, e.currentTarget)
  }, [])

  const handleFavoriteClick = useCallback(
    (code: number, anchor: DOMRect): void => {
      const card = results.find((item) => item.id === code)
      if (!card) return
      if (!isFavorite(code)) void toggleFavorite(code)
      setFavoriteMenu({ card, x: anchor.right, y: anchor.bottom + 4 })
    },
    [results, isFavorite, toggleFavorite]
  )

  return (
    <div className="w-full h-full flex flex-col shrink-0 select-none overflow-hidden">
      <form onSubmit={handleSearchSubmit} className="p-2.5 border-b border-border/60 bg-muted/10">
        <div className="flex items-center gap-1.5">
          <div className="relative flex-1 min-w-0 flex items-center">
            <Search className="w-4 h-4 text-muted-foreground absolute left-2.5 pointer-events-none" />
            <Input
              type="text"
              value={localKw}
              onChange={(e) => setLocalKw(e.target.value)}
              className={`pl-8 ${localKw ? 'pr-7' : 'pr-2.5'} bg-secondary/80 focus:bg-background h-8 text-xs font-medium`}
            />
            {localKw && (
              <button
                type="button"
                onClick={() => {
                  setLocalKw('')
                  setKeyword('')
                  search({ keyword: '' })
                }}
                className="absolute right-2 text-muted-foreground hover:text-foreground"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          <Button
            type="submit"
            size="sm"
            className="h-8 px-2.5 text-xs font-semibold shrink-0"
            aria-busy={isLoading}
          >
            <span>搜索</span>
          </Button>

          <Button
            type="button"
            variant="secondary"
            size="sm"
            onClick={toggleFilterOpen}
            className={`h-8 px-2 shrink-0 transition-all ${
              isFilterOpen || activeFilterCount > 0
                ? 'bg-amber-500 hover:bg-amber-400 text-neutral-950 font-bold'
                : ''
            }`}
          >
            <SlidersHorizontal className="w-3.5 h-3.5" />
            {isFilterOpen ? (
              <ChevronRight className="w-3.5 h-3.5 -ml-0.5" />
            ) : (
              <ChevronLeft className="w-3.5 h-3.5 -ml-0.5" />
            )}
          </Button>
        </div>
        <p className="mt-1.5 px-0.5 text-[10px] leading-tight text-muted-foreground/75">
          空格同时匹配、引号短语、-排除、$仅卡名、@系列
        </p>
      </form>

      <div className="px-3 py-1.5 border-b border-border/40 bg-muted/20 flex items-center justify-between text-[11px] shrink-0">
        <div className="flex items-center gap-1.5 text-muted-foreground">
          <span>
            搜索结果: <strong className="text-foreground font-semibold">{total}</strong> 张
          </span>
          {showSearchProgress && (
            <Loader2 className="w-3 h-3 animate-spin text-primary" aria-hidden="true" />
          )}
        </div>

        {activeFilterCount > 0 && (
          <Button
            variant="ghost"
            size="xs"
            onClick={resetFilters}
            className="h-5 text-[10px] text-muted-foreground hover:text-amber-400 px-1 gap-1"
          >
            <RotateCcw className="w-2.5 h-2.5" />
            <span>清空筛选</span>
          </Button>
        )}
      </div>

      {onlyFavorites && <FavoriteCategoryBar />}

      <div ref={scrollRef} onScroll={handleScroll} className="flex-1 min-h-0 overflow-y-auto p-2">
        {results.length === 0 && !isLoading && hasSearched ? (
          <div className="h-48 flex flex-col items-center justify-center gap-3 text-muted-foreground text-xs p-4 text-center">
            {onlyFavorites ? <p>未找到收藏的卡片</p> : <p>未找到符合条件的卡片</p>}
            {!onlyFavorites && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="gap-1.5"
                onClick={() => openCreate(localKw.trim())}
              >
                <Plus className="h-3.5 w-3.5" />
                <span>新建自定义卡片</span>
              </Button>
            )}
          </div>
        ) : (
          <div className="space-y-1.5">
            {results.map((card) => (
              <CardRowItem
                key={card.id}
                card={card}
                cardPool={cardPool}
                poolSchema={filterOptions.poolSchema}
                isFavorite={isFavorite(card.id)}
                onToggleFavorite={handleFavoriteClick}
                onHover={setHoveredCard}
                onDragStart={isReplay ? undefined : handleDragStart}
              />
            ))}

            {isLoadingMore && (
              <div className="py-2 text-center text-xs text-muted-foreground flex items-center justify-center gap-1">
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                <span>加载更多卡片...</span>
              </div>
            )}
          </div>
        )}
      </div>

      {favoriteMenu && (
        <FavoriteCategoryPopover
          card={favoriteMenu.card}
          anchor={{ x: favoriteMenu.x, y: favoriteMenu.y }}
          onClose={() => setFavoriteMenu(null)}
        />
      )}
    </div>
  )
}
