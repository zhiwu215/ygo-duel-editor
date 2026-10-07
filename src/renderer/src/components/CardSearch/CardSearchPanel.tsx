import { Tooltip, TooltipTrigger, TooltipContent } from '../ui/tooltip'
import React, { useEffect, useState, useRef } from 'react'
import {
  Search,
  Loader2,
  SlidersHorizontal,
  ChevronLeft,
  ChevronRight,
  RotateCcw,
  Sparkles,
  X
} from 'lucide-react'
import { countActiveFilters, useCardSearchStore } from '../../stores/useCardSearchStore'
import { useDuelStore } from '../../stores/useDuelStore'
import { useFavoritesStore } from '../../stores/useFavoritesStore'
import { CdbCard } from '@shared/index'
import { setCardDragImage } from '../../utils/cardImage'
import { Input } from '../ui/input'
import { Button } from '../ui/button'
import { cn } from '../../lib/utils'
import { CardRowItem } from './CardRowItem'

export const CardSearchPanel: React.FC = () => {
  const {
    keyword,
    cardPool,
    results,
    total,
    isLoading,
    isLoadingMore,
    hasSearched,
    isFilterOpen,
    toggleFilterOpen,
    setKeyword,
    search,
    loadMore,
    resetFilters
  } = useCardSearchStore()
  const activeFilterCount = useCardSearchStore(countActiveFilters)

  const { setHoveredCard } = useDuelStore()
  const { isFavorite, toggleFavorite } = useFavoritesStore()
  const [localKw, setLocalKw] = useState(keyword)
  const scrollRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    search({ limit: 40 })
  }, [search])

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

  const handleDragStart = (e: React.DragEvent, card: CdbCard): void => {
    e.dataTransfer.setData('application/json', JSON.stringify(card))
    e.dataTransfer.effectAllowed = 'copy'
    setCardDragImage(e.dataTransfer, e.currentTarget)
  }

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
              placeholder="搜索卡名、卡密或效果"
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
            <Loader2
              className={cn(
                'w-3.5 h-3.5 transition-opacity',
                isLoading ? 'animate-spin opacity-100' : 'opacity-0'
              )}
            />
          </Button>

          <Tooltip>
            <TooltipTrigger
              render={
                <Button
                  type="button"
                  variant={isFilterOpen || activeFilterCount > 0 ? 'default' : 'secondary'}
                  size="sm"
                  onClick={toggleFilterOpen}
                  className={`h-8 px-2 shrink-0 relative transition-all ${
                    isFilterOpen
                      ? 'bg-amber-500 hover:bg-amber-400 text-neutral-950 font-bold'
                      : activeFilterCount > 0
                        ? 'border-amber-400/50 text-amber-400'
                        : ''
                  }`}
                >
                  <SlidersHorizontal className="w-3.5 h-3.5" />
                  {isFilterOpen ? (
                    <ChevronRight className="w-3.5 h-3.5 -ml-0.5" />
                  ) : (
                    <ChevronLeft className="w-3.5 h-3.5 -ml-0.5" />
                  )}

                  {activeFilterCount > 0 && !isFilterOpen && (
                    <span className="absolute -top-1 -right-1 bg-amber-500 text-neutral-950 font-bold text-[9px] w-4 h-4 rounded-full flex items-center justify-center shadow">
                      {activeFilterCount}
                    </span>
                  )}
                </Button>
              }
            />
            <TooltipContent>{isFilterOpen ? '收起高级筛选' : '展开多维度高级筛选'}</TooltipContent>
          </Tooltip>
        </div>
        <p className="mt-1.5 px-0.5 text-[10px] leading-tight text-muted-foreground/75">
          支持空格同时匹配、引号短语、-排除、$仅卡名、@系列
        </p>
      </form>

      <div className="px-3 py-1.5 border-b border-border/40 bg-muted/20 flex items-center justify-between text-[11px] shrink-0">
        <div className="flex items-center gap-1.5 text-muted-foreground">
          <span>
            搜索结果: <strong className="text-foreground font-semibold">{total}</strong> 张
          </span>
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

      <div ref={scrollRef} onScroll={handleScroll} className="flex-1 min-h-0 overflow-y-auto p-2">
        {results.length === 0 && !isLoading && hasSearched ? (
          <div className="h-48 flex flex-col items-center justify-center text-muted-foreground text-xs p-4 text-center">
            <Sparkles className="w-8 h-8 opacity-20 mb-2" />
            <p>未找到符合条件的卡片</p>
            <p className="text-[11px] opacity-60 mt-1">请尝试放宽检索关键词或重置筛选条件</p>
          </div>
        ) : (
          <div className="space-y-1.5">
            {results.map((card) => (
              <CardRowItem
                key={card.id}
                card={card}
                cardPool={cardPool}
                isFavorite={isFavorite(card.id)}
                onToggleFavorite={toggleFavorite}
                onHover={setHoveredCard}
                onDragStart={handleDragStart}
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
    </div>
  )
}
