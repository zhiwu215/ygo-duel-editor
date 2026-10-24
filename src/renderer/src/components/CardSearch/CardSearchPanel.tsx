import React, { useCallback, useEffect, useState, useRef } from 'react'
import {
  Search,
  Loader2,
  SlidersHorizontal,
  ChevronLeft,
  ChevronRight,
  RotateCcw,
  Hand,
  ArrowUpToLine,
  ArrowDownToLine,
  Ghost,
  Ban,
  Layers,
  X,
  Plus,
  Swords
} from 'lucide-react'
import { countActiveFilters, useCardSearchStore } from '../../stores/useCardSearchStore'
import { useCustomCardStore } from '../../stores/useCustomCardStore'
import { useDuelStore } from '../../stores/useDuelStore'
import { useDuelEngineStore } from '../../stores/useDuelEngineStore'
import { useFavoritesStore } from '../../stores/useFavoritesStore'
import { InjectCommand, CdbCard, CardType, CardUtils } from '@shared/index'
import { setCardDragImage } from '../../utils/cardImage'
import { Input } from '../ui/input'
import { Button } from '../ui/button'
import { useDismissOnOutside } from '../../hooks/useDismissOnOutside'
import { useDelayedLoading } from '../../hooks/useDelayedLoading'
import { CardRowItem } from './CardRowItem'
import { FavoriteCategoryBar } from './FavoriteCategoryBar'
import { FavoriteCategoryPopover } from './FavoriteCategoryPopover'

type AddCardTarget = Extract<InjectCommand, { op: 'add-card' }>['to']

const INJECT_MENU_ITEMS: {
  label: string
  to: AddCardTarget
  icon: React.ComponentType<{ className?: string }>
}[] = [
  { label: '加入手牌', to: 'hand', icon: Hand },
  { label: '置于卡组顶', to: 'deck-top', icon: ArrowUpToLine },
  { label: '置于卡组底', to: 'deck-bottom', icon: ArrowDownToLine },
  { label: '置于墓地', to: 'grave-top', icon: Ghost },
  { label: '除外', to: 'removed', icon: Ban },
  { label: '加入额外卡组', to: 'extra', icon: Layers }
]

function fieldTargetFor(card: CdbCard): AddCardTarget | null {
  if (CardUtils.isMonster(card.type)) return 'mzone'
  if (CardUtils.isSpell(card.type) || CardUtils.isTrap(card.type)) {
    return card.type & CardType.FIELD ? 'fzone' : 'szone'
  }
  return null
}

function fieldTargetLabel(target: AddCardTarget): string {
  if (target === 'mzone') return '放置到场上'
  return target === 'fzone' ? '放置到场地魔法区' : '放置到魔陷区'
}

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
  const isEngineActive = useDuelEngineStore((s) => s.isInitialized)
  const showSearchProgress = useDelayedLoading(isLoading)
  const [localKw, setLocalKw] = useState(keyword)
  const [injectMenu, setInjectMenu] = useState<{ card: CdbCard; x: number; y: number } | null>(null)
  const [favoriteMenu, setFavoriteMenu] = useState<{
    card: CdbCard
    x: number
    y: number
  } | null>(null)
  const injectMenuRef = useRef<HTMLDivElement>(null)
  const scrollRef = useRef<HTMLDivElement>(null)
  const fieldTarget = injectMenu ? fieldTargetFor(injectMenu.card) : null

  const closeInjectMenu = (): void => setInjectMenu(null)

  useDismissOnOutside(injectMenuRef, injectMenu !== null, closeInjectMenu)

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
    setInjectMenu(null)
    const { scrollTop, scrollHeight, clientHeight } = e.currentTarget
    if (scrollHeight - scrollTop - clientHeight < 300) {
      loadMore()
    }
  }

  const handleDragStart = useCallback((e: React.DragEvent, card: CdbCard): void => {
    e.dataTransfer.setData('application/json', JSON.stringify(card))
    e.dataTransfer.effectAllowed = 'copy'
    setCardDragImage(e.dataTransfer, e.currentTarget)
  }, [])

  const handleRowContextMenu = useCallback(
    (e: React.MouseEvent, card: CdbCard): void => {
      if (!isEngineActive) return
      e.preventDefault()
      e.stopPropagation()
      setInjectMenu({ card, x: e.clientX, y: e.clientY })
    },
    [isEngineActive]
  )

  const injectCard = useCallback((card: CdbCard, to: AddCardTarget): void => {
    setInjectMenu(null)
    void useDuelEngineStore.getState().inject({ op: 'add-card', player: 0, code: card.id, to })
  }, [])

  const handleRowDoubleClick = useCallback(
    (card: CdbCard): void => injectCard(card, 'hand'),
    [injectCard]
  )

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
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="gap-1.5"
              onClick={() => openCreate(localKw.trim())}
            >
              <Plus className="h-3.5 w-3.5" />
              新建自定义卡片
            </Button>
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
                onDragStart={handleDragStart}
                onContextMenu={handleRowContextMenu}
                onRowDoubleClick={isEngineActive ? handleRowDoubleClick : undefined}
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

      {injectMenu && (
        <div
          ref={injectMenuRef}
          style={{
            left: Math.max(8, Math.min(injectMenu.x, window.innerWidth - 176)),
            top: Math.max(8, Math.min(injectMenu.y, window.innerHeight - 270))
          }}
          className="fixed z-[70] min-w-40 bg-popover/95 backdrop-blur-md text-popover-foreground border border-border rounded-lg shadow-2xl p-1.5 text-xs space-y-0.5 animate-in fade-in zoom-in-95 duration-75 select-none"
          onContextMenu={(e) => e.preventDefault()}
        >
          <div className="px-2 py-1 text-[10px] font-semibold text-muted-foreground border-b border-border/50 mb-1 truncate">
            剧情安排：{injectMenu.card.name}
          </div>
          {fieldTarget && (
            <button
              type="button"
              title="直接放到场上，不走召唤流程"
              onClick={() => injectCard(injectMenu.card, fieldTarget)}
              className="w-full flex items-center gap-2 h-7 px-2 rounded-md text-xs text-left text-primary hover:bg-primary/10 transition-colors cursor-pointer"
            >
              {fieldTarget === 'mzone' ? (
                <Swords className="w-3.5 h-3.5 shrink-0" />
              ) : (
                <Layers className="w-3.5 h-3.5 shrink-0" />
              )}
              <span>{fieldTargetLabel(fieldTarget)}</span>
            </button>
          )}
          {INJECT_MENU_ITEMS.map((item) => (
            <button
              key={item.to}
              type="button"
              onClick={() => injectCard(injectMenu.card, item.to)}
              className="w-full flex items-center gap-2 h-7 px-2 rounded-md text-xs text-left hover:bg-muted/60 transition-colors cursor-pointer"
            >
              <item.icon className="w-3.5 h-3.5 shrink-0 text-muted-foreground" />
              <span>{item.label}</span>
            </button>
          ))}
        </div>
      )}

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
