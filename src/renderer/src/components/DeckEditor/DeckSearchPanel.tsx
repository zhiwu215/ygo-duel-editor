import { ScrollArea } from '../ui/scroll-area'
import React, { useState, useEffect, useCallback, useRef } from 'react'
import { useDraggable, useDndContext, useDroppable } from '@dnd-kit/core'
import { canPlaceInSection, CdbCard, DeckSection } from '@shared/index'
import { useFavoritesStore } from '../../stores/useFavoritesStore'
import { useCardSearchStore } from '../../stores/useCardSearchStore'
import { Button } from '../ui/button'
import { Search, Star, Layers, Loader2, Minus, Plus } from 'lucide-react'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select'
import { CardRowItem } from '../CardSearch/CardRowItem'
import { SORT_OPTIONS } from '../CardSearch/sortOptions'
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
    <div
      ref={setNodeRef}
      {...attributes}
      {...listeners}
      onClick={handleClick}
      onContextMenu={handleContextMenu}
      className={cn(isDragging && 'opacity-40')}
    >
      <CardRowItem
        card={card}
        isFavorite={fav}
        onToggleFavorite={onToggleFavorite}
        onHover={onSelectCard}
      />
    </div>
  )
}

export const DeckSearchPanel: React.FC<DeckSearchPanelProps> = ({ onSelectCard, onAddCard }) => {
  const [activeTab, setActiveTab] = useState<'search' | 'favorites'>('search')
  const [cardMenu, setCardMenu] = useState<{ card: CdbCard; x: number; y: number } | null>(null)

  const {
    results,
    total,
    isLoading,
    isLoadingMore,
    hasMore,
    hasSearched,
    sortField,
    search,
    loadMore,
    setFilters
  } = useCardSearchStore()

  const { favorites, isFavorite, toggleFavorite, loadFavorites } = useFavoritesStore()
  const [favoriteCards, setFavoriteCards] = useState<CdbCard[]>([])
  const sortLabel = SORT_OPTIONS.find((o) => o.value === sortField)?.label ?? SORT_OPTIONS[0].label
  const sentinelRef = useRef<HTMLDivElement | null>(null)

  // 初始加载收藏夹
  useEffect(() => {
    void loadFavorites()
  }, [loadFavorites])

  // 卡组编辑器窗口持有独立的搜索 store，首次挂载时拉一页默认结果
  useEffect(() => {
    void search({ limit: 40 })
  }, [search])

  // 下滑到底自动续拉，对齐 YGOPro 没有「加载更多」按钮的结果列表
  useEffect(() => {
    if (activeTab !== 'search' || !hasMore) return
    const node = sentinelRef.current
    if (!node) return
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) void loadMore()
      },
      { rootMargin: '320px' }
    )
    observer.observe(node)
    return () => observer.disconnect()
  }, [activeTab, hasMore, loadMore, results.length])

  // 当切换到收藏夹或收藏列表变化时，拉取收藏卡的详细数据
  useEffect(() => {
    let canceled = false
    if (activeTab !== 'favorites' || favorites.length === 0) {
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

  const currentDisplayList = activeTab === 'search' ? results : favoriteCards
  const showEmptyState =
    activeTab === 'favorites' ? favorites.length === 0 : hasSearched && !isLoading

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

      {/* 2. 结果计数 + 排序（对应 YGOPro 悬浮在结果列表上方的 wSort） */}
      {activeTab === 'search' && (
        <div className="px-2.5 py-1 border-b border-border/40 bg-muted/20 flex items-center justify-between gap-2 text-[11px] shrink-0">
          <span className="text-muted-foreground shrink-0">
            共 <strong className="text-foreground font-semibold">{total}</strong> 张
          </span>
          <div className="flex items-center gap-1.5 shrink-0">
            <Select
              value={sortField}
              onValueChange={(val) => {
                const option = SORT_OPTIONS.find((o) => o.value === val) ?? SORT_OPTIONS[0]
                setFilters({ sortField: option.value, sortOrder: option.order })
              }}
            >
              <SelectTrigger
                size="sm"
                className="h-5.5 w-[92px] shrink-0 gap-0.5 px-1.5 text-[10px] [&_svg]:size-3"
              >
                <SelectValue>{sortLabel}</SelectValue>
              </SelectTrigger>
              <SelectContent>
                {SORT_OPTIONS.map((o) => (
                  <SelectItem key={o.value} value={o.value}>
                    {o.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      )}

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
              <div className="space-y-1">
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

              {activeTab === 'search' && <div ref={sentinelRef} className="h-px" />}

              {activeTab === 'search' && isLoadingMore && (
                <div className="h-6 flex items-center justify-center gap-1.5 text-[10px] text-muted-foreground/70">
                  <Loader2 className="w-3 h-3 animate-spin" />
                  <span>加载中...</span>
                </div>
              )}
            </>
          )}
        </div>
      </ScrollArea>

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
