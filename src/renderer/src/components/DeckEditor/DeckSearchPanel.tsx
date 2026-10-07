import { Tooltip, TooltipTrigger, TooltipContent } from '../ui/tooltip'
import { ScrollArea } from '../ui/scroll-area'
import React, { useState, useEffect, useCallback } from 'react'
import { useDraggable, useDndContext, useDroppable } from '@dnd-kit/core'
import { canPlaceInSection, CdbCard, DeckSection } from '@shared/index'
import { useFavoritesStore } from '../../stores/useFavoritesStore'
import { countActiveFilters, useCardSearchStore } from '../../stores/useCardSearchStore'
import { getCardImageUrl, CARD_BACK_IMAGE } from '../../utils/cardImage'
import { Button } from '../ui/button'
import { Input } from '../ui/input'
import {
  Search,
  Star,
  Layers,
  Loader2,
  Minus,
  Plus,
  X,
  RotateCcw,
  SlidersHorizontal,
  ChevronLeft,
  ChevronRight
} from 'lucide-react'
import { CardPoolBadges } from '../CardSearch/CardPoolBadges'
import { FilterDrawer } from '../CardSearch/FilterDrawer'
import { cn } from '../../lib/utils'
import {
  DeckDragSourceData,
  DeckDropTargetData,
  DECK_SECTION_NAMES,
  deckDragGuard
} from './deckDnd'

interface DeckSearchPanelProps {
  onSelectCard: (card: CdbCard | null) => void
  onAddCard: (card: CdbCard, section?: DeckSection) => boolean
}

const ADD_SECTIONS: DeckSection[] = ['main', 'extra', 'side']

const SearchPanelDropZone: React.FC<{ className?: string; children: React.ReactNode }> = ({
  className,
  children
}) => {
  const { setNodeRef } = useDroppable({
    id: 'zone:search',
    data: { kind: 'search-panel' } as DeckDropTargetData
  })
  return (
    <div ref={setNodeRef} className={className}>
      {children}
    </div>
  )
}

const DeckRemoveFeedback: React.FC = () => {
  const { active, over } = useDndContext()
  const source = active?.data.current as DeckDragSourceData | undefined
  const target = over?.data.current as DeckDropTargetData | undefined
  if (!source || source.source !== 'deck' || target?.kind !== 'search-panel') return null

  return (
    <div className="absolute inset-0 z-40 flex items-center justify-center pointer-events-none">
      <div className="w-24 h-24 rounded-full bg-white shadow-2xl ring-1 ring-black/10 flex items-center justify-center">
        <Minus className="w-12 h-12 text-red-600" strokeWidth={3} />
      </div>
    </div>
  )
}

interface SearchCardItemProps {
  card: CdbCard
  fav: boolean
  onSelectCard: (card: CdbCard | null) => void
  onAddCard: (card: CdbCard, section?: DeckSection) => boolean
  onToggleFavorite: (code: number) => void
  onOpenMenu: (card: CdbCard, x: number, y: number) => void
}

const SearchCardItem: React.FC<SearchCardItemProps> = ({
  card,
  fav,
  onSelectCard,
  onAddCard,
  onToggleFavorite,
  onOpenMenu
}) => {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: `search:${card.id}`,
    data: { source: 'search', card } as DeckDragSourceData
  })

  const handleClick = (): void => {
    if (Date.now() - deckDragGuard.lastDragEndAt < 250) return
    onAddCard(card)
  }

  const handleContextMenu = (e: React.MouseEvent): void => {
    e.preventDefault()
    onOpenMenu(card, e.clientX, e.clientY)
  }

  return (
    <Tooltip>
      <TooltipTrigger
        render={
          <div
            ref={setNodeRef}
            {...attributes}
            {...listeners}
            onClick={handleClick}
            onMouseEnter={() => onSelectCard(card)}
            onContextMenu={handleContextMenu}

            className={cn(
              'group relative aspect-[59/86] rounded overflow-hidden cursor-grab active:cursor-grabbing border border-border/50 hover:border-primary hover:shadow-md transition-all duration-150 bg-background/50',
              isDragging && 'opacity-40'
            )}
          >
            <img
              src={getCardImageUrl(card.id, true)}
              alt={card.name}
              loading="lazy"
              draggable={false}
              className="w-full h-full object-cover pointer-events-none group-hover:scale-105 transition-transform duration-150"
              onError={(e) => {
                ;(e.currentTarget as HTMLImageElement).src = CARD_BACK_IMAGE
              }}
            />

            <CardPoolBadges pools={card.pools} width={34} />

            {/* 悬停快捷加入图标 */}
            <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center pointer-events-none">
              <span className="text-[10px] text-white font-bold bg-primary/80 px-1.5 py-0.5 rounded shadow-xs">
                + 加入
              </span>
            </div>

            {/* 右上角收藏星星按钮 */}
            <Tooltip>
              <TooltipTrigger
                render={
                  <button
                    type="button"
                    onPointerDown={(e) => e.stopPropagation()}
                    onClick={(e) => {
                      e.stopPropagation()
                      onToggleFavorite(card.id)
                    }}

                    className={cn(
                      'absolute top-1 right-1 p-1 rounded bg-black/70 hover:bg-black/90 transition-all',
                      fav
                        ? 'text-amber-400 opacity-100'
                        : 'text-white/60 hover:text-white opacity-0 group-hover:opacity-100'
                    )}
                  >
                    <Star
                      className={cn(
                        'w-3 h-3',
                        fav ? 'fill-amber-400 text-amber-400' : 'text-white'
                      )}
                    />
                  </button>
                }
              />
              <TooltipContent>{fav ? '取消收藏' : '加入收藏'}</TooltipContent>
            </Tooltip>
          </div>
        }
      />
      <TooltipContent>{`${card.name}（左键加入 / 拖入卡组 / 右键选择区域）`}</TooltipContent>
    </Tooltip>
  )
}

export const DeckSearchPanel: React.FC<DeckSearchPanelProps> = ({ onSelectCard, onAddCard }) => {
  const [activeTab, setActiveTab] = useState<'search' | 'favorites'>('search')
  const [cardMenu, setCardMenu] = useState<{ card: CdbCard; x: number; y: number } | null>(null)

  const {
    keyword,
    results,
    total,
    isLoading,
    isLoadingMore,
    hasMore,
    hasSearched,
    isFilterOpen,
    setIsFilterOpen,
    toggleFilterOpen,
    setKeyword,
    search,
    loadMore,
    resetFilters
  } = useCardSearchStore()
  const activeFilterCount = useCardSearchStore(countActiveFilters)

  const [localKw, setLocalKw] = useState<string>(keyword)

  const { favorites, isFavorite, toggleFavorite, loadFavorites } = useFavoritesStore()
  const [favoriteCards, setFavoriteCards] = useState<CdbCard[]>([])

  // 初始加载收藏夹
  useEffect(() => {
    void loadFavorites()
  }, [loadFavorites])

  // 卡组编辑器窗口持有独立的搜索 store，首次挂载时拉一页默认结果
  useEffect(() => {
    void search({ limit: 40 })
  }, [search])

  // 当切换到收藏夹或收藏列表变化时，拉取收藏卡的详细数据
  useEffect(() => {
    if (activeTab !== 'favorites' || favorites.length === 0) {
      return
    }
    let canceled = false
    window.api
      ?.getCardsByIds(favorites)
      .then((map) => {
        if (!canceled) {
          const list = favorites.map((code) => map[code]).filter(Boolean) as CdbCard[]
          setFavoriteCards(list)
        }
      })
      .catch((err) => console.error('[DeckSearchPanel] load favorites details error:', err))
    return () => {
      canceled = true
    }
  }, [activeTab, favorites])

  // 卡库变更后刷新收藏卡详情；搜索结果由 useCardSearchStore 自行重查
  useEffect(() => {
    return window.api.onCdbUpdated(() => {
      if (activeTab !== 'favorites' || favorites.length === 0) return
      void window.api
        .getCardsByIds(favorites)
        .then((map) => {
          setFavoriteCards(favorites.map((code) => map[code]).filter(Boolean) as CdbCard[])
        })
        .catch((err) => console.error('[DeckSearchPanel] refresh favorites error:', err))
    })
  }, [activeTab, favorites])

  // 右键菜单：点空白处 / 改窗口尺寸 / Esc 关闭
  useEffect(() => {
    if (!cardMenu) return
    const close = (): void => setCardMenu(null)
    const onKeyDown = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') setCardMenu(null)
    }
    window.addEventListener('mousedown', close)
    window.addEventListener('resize', close)
    window.addEventListener('keydown', onKeyDown)
    return () => {
      window.removeEventListener('mousedown', close)
      window.removeEventListener('resize', close)
      window.removeEventListener('keydown', onKeyDown)
    }
  }, [cardMenu])

  const handleOpenMenu = useCallback((card: CdbCard, x: number, y: number): void => {
    setCardMenu({ card, x, y })
  }, [])

  const runSearch = useCallback(
    (value: string): void => {
      const trimmed = value.trim()
      setKeyword(trimmed)
      void search({ keyword: trimmed })
    },
    [setKeyword, search]
  )

  const currentDisplayList = activeTab === 'search' ? results : favoriteCards
  const showEmptyState = activeTab === 'favorites' ? favorites.length === 0 : hasSearched && !isLoading
  const showFilter = activeTab === 'search' && isFilterOpen

  return (
    <SearchPanelDropZone className="relative w-[270px] lg:w-[320px] xl:w-[400px] h-full flex flex-col bg-card border-l border-border select-none shrink-0">
      {/* 1. 顶部 Tab 切换 */}
      <div className="flex items-center border-b border-border/80 p-1.5 gap-1 bg-muted/40">
        <button
          type="button"
          onClick={() => setActiveTab('search')}
          className={cn(
            'flex-1 py-1 text-xs font-semibold rounded flex items-center justify-center gap-1.5 transition-colors',
            activeTab === 'search'
              ? 'bg-background text-foreground shadow-xs'
              : 'text-muted-foreground hover:text-foreground'
          )}
        >
          <Search className="w-3.5 h-3.5" />
          <span>卡片列表</span>
          {activeTab === 'search' && total > 0 && (
            <span className="text-[10px] text-muted-foreground font-mono">({total})</span>
          )}
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('favorites')}
          className={cn(
            'flex-1 py-1 text-xs font-semibold rounded flex items-center justify-center gap-1.5 transition-colors',
            activeTab === 'favorites'
              ? 'bg-background text-foreground shadow-xs'
              : 'text-muted-foreground hover:text-foreground'
          )}
        >
          <Star className="w-3.5 h-3.5 text-amber-500 fill-amber-500/20" />
          <span>我的收藏</span>
          <span className="text-[10px] text-muted-foreground font-mono">({favorites.length})</span>
        </button>
      </div>

      {/* 2. 搜索输入条 + 高级筛选入口 (仅在卡片列表 Tab 显示) */}
      {activeTab === 'search' && (
        <div className="p-2 border-b border-border/60 flex items-center gap-1.5">
          <div className="relative flex-1 min-w-0">
            <Search className="w-3.5 h-3.5 absolute left-2 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
            <Input
              type="text"
              value={localKw}
              onChange={(e) => setLocalKw(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') runSearch(localKw)
              }}
              placeholder="搜索卡名 / 效果 / 卡密..."
              className="h-7 pl-7 pr-7 text-xs bg-background"
            />
            {localKw && (
              <button
                type="button"
                onClick={() => {
                  setLocalKw('')
                  runSearch('')
                }}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          <Button
            variant="secondary"
            size="xs"
            onClick={() => runSearch(localKw)}
            aria-busy={isLoading}
            className="h-7 px-2.5 text-xs font-semibold shrink-0"
          >
            <span>搜索</span>
            <Loader2
              className={cn(
                'w-3 h-3 transition-opacity',
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
                  size="xs"
                  onClick={toggleFilterOpen}
                  className={cn(
                    'h-7 px-1.5 shrink-0 relative transition-all',
                    isFilterOpen
                      ? 'bg-amber-500 hover:bg-amber-400 text-neutral-950 font-bold'
                      : activeFilterCount > 0
                        ? 'border-amber-400/50 text-amber-400'
                        : ''
                  )}
                >
                  <SlidersHorizontal className="w-3.5 h-3.5" />
                  {isFilterOpen ? (
                    <ChevronRight className="w-3 h-3 -ml-0.5" />
                  ) : (
                    <ChevronLeft className="w-3 h-3 -ml-0.5" />
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
      )}

      {/* 3. 结果计数 + 清空筛选 */}
      {activeTab === 'search' && (
        <div className="px-2.5 py-1 border-b border-border/40 bg-muted/20 flex items-center justify-between text-[11px] shrink-0">
          <span className="text-muted-foreground">
            共 <strong className="text-foreground font-semibold">{total}</strong> 张
          </span>
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
      )}

      {/* 4. 筛选面板与卡片网格共用主体区域：面板窄，展开时直接顶替结果区 */}
      {showFilter ? (
        <FilterDrawer
          className="flex-1 min-h-0 w-full border-b border-border/60"
          onClose={() => setIsFilterOpen(false)}
        />
      ) : (
        <ScrollArea className="flex-1 min-h-0">
          <div className="p-2">
            {activeTab === 'search' && isLoading && results.length === 0 ? (
              <div className="h-40 flex items-center justify-center gap-2 text-xs text-muted-foreground">
                <Loader2 className="w-4 h-4 animate-spin text-primary" />
                <span>正在检索卡片...</span>
              </div>
            ) : showEmptyState && currentDisplayList.length === 0 ? (
              <div className="h-40 flex flex-col items-center justify-center gap-1.5 text-xs text-muted-foreground">
                {activeTab === 'favorites' ? (
                  <>
                    <Star className="w-6 h-6 text-muted-foreground/40 stroke-1" />
                    <span>暂无收藏卡片</span>
                    <span className="text-[11px] text-muted-foreground/60">
                      点击卡片右上角星星即可加入收藏
                    </span>
                  </>
                ) : (
                  <>
                    <Layers className="w-6 h-6 text-muted-foreground/40 stroke-1" />
                    <span>未找到符合条件的卡片</span>
                    <span className="text-[11px] text-muted-foreground/60">
                      可尝试放宽关键词或清空筛选条件
                    </span>
                  </>
                )}
              </div>
            ) : (
              <>
                <div className="grid grid-cols-3 gap-2.5">
                  {currentDisplayList.map((card) => (
                    <SearchCardItem
                      key={`search_card_${card.id}`}
                      card={card}
                      fav={isFavorite(card.id)}
                      onSelectCard={onSelectCard}
                      onAddCard={onAddCard}
                      onToggleFavorite={toggleFavorite}
                      onOpenMenu={handleOpenMenu}
                    />
                  ))}
                </div>

                {activeTab === 'search' && hasMore && (
                  <Button
                    variant="secondary"
                    size="xs"
                    onClick={() => void loadMore()}
                    aria-busy={isLoadingMore}
                    className="w-full mt-2.5 h-7 text-[11px] font-semibold"
                  >
                    <span>加载更多</span>
                    <Loader2
                      className={cn(
                        'w-3 h-3 transition-opacity',
                        isLoadingMore ? 'animate-spin opacity-100' : 'opacity-0'
                      )}
                    />
                  </Button>
                )}

                {activeTab === 'search' && total > 0 && (
                  <div className="mt-1.5 text-center text-[10px] text-muted-foreground/70 tabular-nums">
                    已显示 {results.length} / {total}
                  </div>
                )}
              </>
            )}
          </div>
        </ScrollArea>
      )}

      <DeckRemoveFeedback />

      {cardMenu && (
        <div
          style={{
            left: Math.min(cardMenu.x, window.innerWidth - 190),
            top: Math.min(cardMenu.y, window.innerHeight - 150)
          }}
          className="fixed z-[60] min-w-44 bg-popover/95 backdrop-blur-md text-popover-foreground border border-border rounded-lg shadow-2xl p-1 text-xs space-y-0.5 animate-in fade-in zoom-in-95 duration-75 select-none"
          onMouseDown={(e) => e.stopPropagation()}
          onClick={(e) => e.stopPropagation()}
        >
          <div className="px-2 py-1 text-[10px] font-semibold text-muted-foreground border-b border-border/50 mb-1 truncate max-w-44">
            {cardMenu.card.name}
          </div>

          {ADD_SECTIONS.map((section) => {
            const disabled = !canPlaceInSection(cardMenu.card.type, section)
            return (
              <Button
                key={section}
                variant="ghost"
                size="sm"
                disabled={disabled}
                onClick={() => {
                  onAddCard(cardMenu.card, section)
                  setCardMenu(null)
                }}
                className="w-full justify-start gap-2 h-7 px-2 text-xs font-normal cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5 text-muted-foreground" />
                <span>加入{DECK_SECTION_NAMES[section]}</span>
              </Button>
            )
          })}
        </div>
      )}
    </SearchPanelDropZone>
  )
}
