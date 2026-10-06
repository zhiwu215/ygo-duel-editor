import React, { useState, useEffect, useCallback } from 'react'
import { CdbCard } from '@shared/index'
import { useFavoritesStore } from '../../stores/useFavoritesStore'
import { getCardImageUrl, CARD_BACK_IMAGE } from '../../utils/cardImage'
import { Button } from '../ui/button'
import { Input } from '../ui/input'
import { Search, Star, Layers, Loader2 } from 'lucide-react'
import { cn } from '../../lib/utils'

interface DeckSearchPanelProps {
  onSelectCard: (card: CdbCard | null) => void
  onAddCard: (card: CdbCard) => boolean
}

export const DeckSearchPanel: React.FC<DeckSearchPanelProps> = ({ onSelectCard, onAddCard }) => {
  const [activeTab, setActiveTab] = useState<'search' | 'favorites'>('search')
  const [keyword, setKeyword] = useState<string>('')
  const [cards, setCards] = useState<CdbCard[]>([])
  const [totalCount, setTotalCount] = useState<number>(0)
  const [loading, setLoading] = useState<boolean>(true)

  const { favorites, isFavorite, toggleFavorite, loadFavorites } = useFavoritesStore()
  const [favoriteCards, setFavoriteCards] = useState<CdbCard[]>([])

  // 初始加载收藏夹
  useEffect(() => {
    void loadFavorites()
  }, [loadFavorites])

  // 执行通用卡片搜索
  const handleSearch = useCallback(async (query: string): Promise<void> => {
    setLoading(true)
    try {
      const res = await window.api.searchCards({
        keyword: query.trim() || undefined,
        limit: 80
      })
      setCards(res.cards)
      setTotalCount(res.total)
    } catch (err) {
      console.error('[DeckSearchPanel] search error:', err)
    } finally {
      setLoading(false)
    }
  }, [])

  // 初始执行一次空搜索拉取卡片
  useEffect(() => {
    let canceled = false
    window.api
      ?.searchCards({ limit: 80 })
      .then((res) => {
        if (!canceled) {
          setCards(res.cards)
          setTotalCount(res.total)
        }
      })
      .catch((err) => {
        console.error('[DeckSearchPanel] init search error:', err)
      })
      .finally(() => {
        if (!canceled) setLoading(false)
      })
    return () => {
      canceled = true
    }
  }, [])

  // 卡库或卡图目录变更后重新拉取，保持与主窗口一致
  useEffect(() => {
    return window.api.onCdbUpdated(() => {
      void handleSearch(keyword)
      if (activeTab === 'favorites' && favorites.length > 0) {
        void window.api.getCardsByIds(favorites).then((map) => {
          setFavoriteCards(favorites.map((code) => map[code]).filter(Boolean) as CdbCard[])
        })
      }
    })
  }, [keyword, activeTab, favorites, handleSearch])

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

  const currentDisplayList =
    activeTab === 'search' ? cards : favorites.length === 0 ? [] : favoriteCards
  const isLoading = activeTab === 'search' && loading

  return (
    <div className="w-[310px] h-full flex flex-col bg-card border-l border-border select-none shrink-0">
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
          {activeTab === 'search' && totalCount > 0 && (
            <span className="text-[10px] text-muted-foreground font-mono">({totalCount})</span>
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

      {/* 2. 搜索输入条 (仅在卡片列表 Tab 显示) */}
      {activeTab === 'search' && (
        <div className="p-2 border-b border-border/60 flex items-center gap-1.5">
          <div className="relative flex-1">
            <Search className="w-3.5 h-3.5 absolute left-2 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
            <Input
              type="text"
              value={keyword}
              onChange={(e) => setKeyword(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  handleSearch(keyword)
                }
              }}
              placeholder="搜索卡名 / 效果 / 卡密..."
              className="h-7 pl-7 pr-2 text-xs bg-background"
            />
          </div>
          <Button
            variant="secondary"
            size="xs"
            onClick={() => handleSearch(keyword)}
            className="h-7 px-2.5 text-xs font-semibold shrink-0"
          >
            搜索
          </Button>
        </div>
      )}

      {/* 3. 卡片网格展示 (3 列卡图瀑布流) */}
      <div className="flex-1 overflow-y-auto p-2 min-h-0">
        {isLoading ? (
          <div className="h-40 flex items-center justify-center gap-2 text-xs text-muted-foreground">
            <Loader2 className="w-4 h-4 animate-spin text-primary" />
            <span>正在检索卡片...</span>
          </div>
        ) : currentDisplayList.length > 0 ? (
          <div className="grid grid-cols-3 gap-1.5">
            {currentDisplayList.map((card) => {
              const fav = isFavorite(card.id)
              return (
                <div
                  key={`search_card_${card.id}`}
                  onClick={() => onAddCard(card)}
                  onMouseEnter={() => onSelectCard(card)}
                  title={`${card.name} (左键加入卡组)`}
                  className="group relative aspect-[59/86] rounded overflow-hidden cursor-pointer border border-border/50 hover:border-primary hover:shadow-md transition-all duration-150 bg-background/50"
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

                  {/* 悬停快捷加入图标 */}
                  <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center pointer-events-none">
                    <span className="text-[10px] text-white font-bold bg-primary/80 px-1.5 py-0.5 rounded shadow-xs">
                      + 加入
                    </span>
                  </div>

                  {/* 右上角收藏星星按钮 */}
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation()
                      toggleFavorite(card.id)
                    }}
                    title={fav ? '取消收藏' : '加入收藏'}
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
                </div>
              )
            })}
          </div>
        ) : (
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
              </>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
