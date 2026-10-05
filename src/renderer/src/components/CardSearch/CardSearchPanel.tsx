import React, { useEffect, useState, useRef } from 'react'
import {
  Search,
  Loader2,
  SlidersHorizontal,
  ChevronLeft,
  ChevronRight,
  RotateCcw,
  Sparkles,
  Star,
  X
} from 'lucide-react'
import { useCardSearchStore } from '../../stores/useCardSearchStore'
import { useDuelStore } from '../../stores/useDuelStore'
import { useFavoritesStore } from '../../stores/useFavoritesStore'
import { CdbCard } from '@shared/index'
import { getCardImageUrl, CARD_BACK_IMAGE } from '../../utils/cardImage'
import { formatSearchItemLine2, formatSearchItemLine3 } from '../../utils/cardFormat'
import { Input } from '../ui/input'
import { Button } from '../ui/button'
import { Badge } from '../ui/badge'

export const CardSearchPanel: React.FC = () => {
  const {
    keyword,
    type,
    subType,
    attribute,
    race,
    level,
    scale,
    effectCategoryMask,
    cardPool,
    atk,
    atkOp,
    def,
    defOp,
    code,
    searchDesc,
    sortField,
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

  const { setHoveredCard } = useDuelStore()
  const { isFavorite, toggleFavorite } = useFavoritesStore()
  const [localKw, setLocalKw] = useState(keyword)
  const scrollRef = useRef<HTMLDivElement>(null)

  // 初始加载一次默认卡片
  useEffect(() => {
    search({ limit: 40 })
  }, [search])

  // 当进行全新检索时，重置滚动条位置到顶部
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

  // 计算当前激活的高级筛选条件数量
  const activeFilterCount = React.useMemo(() => {
    let count = 0
    if (type !== 0) count++
    if (subType !== 0) count++
    if (attribute !== 0) count++
    if (race !== 0) count++
    if (level !== 0) count++
    if (scale !== undefined) count++
    if (effectCategoryMask !== 0) count++
    if (cardPool !== 'any') count++
    if (atk !== undefined || atkOp === 'unknown') count++
    if (def !== undefined || defOp === 'unknown') count++
    if (code !== undefined) count++
    if (!searchDesc) count++
    if (sortField !== 'id') count++
    return count
  }, [
    type,
    subType,
    attribute,
    race,
    level,
    scale,
    effectCategoryMask,
    cardPool,
    atk,
    atkOp,
    def,
    defOp,
    code,
    searchDesc,
    sortField
  ])

  // 滚动到底部附近自动触发无限下滑加载更多卡片
  const handleScroll = (e: React.UIEvent<HTMLDivElement>): void => {
    const { scrollTop, scrollHeight, clientHeight } = e.currentTarget
    if (scrollHeight - scrollTop - clientHeight < 300) {
      loadMore()
    }
  }

  // HTML5 Drag Start
  const handleDragStart = (e: React.DragEvent, card: CdbCard): void => {
    e.dataTransfer.setData('application/json', JSON.stringify(card))
    e.dataTransfer.effectAllowed = 'copy'
  }

  return (
    <div className="w-full h-full flex flex-col shrink-0 select-none overflow-hidden">
      {/* 顶部搜索输入与控制栏 */}
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
            disabled={isLoading}
          >
            {isLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : '搜索'}
          </Button>

          {/* 高级筛选折叠/展开按钮 */}
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
            title={isFilterOpen ? '收起高级筛选' : '展开多维度高级筛选'}
          >
            <SlidersHorizontal className="w-3.5 h-3.5" />
            {isFilterOpen ? (
              <ChevronRight className="w-3.5 h-3.5 -ml-0.5" />
            ) : (
              <ChevronLeft className="w-3.5 h-3.5 -ml-0.5" />
            )}

            {/* 激活筛选数量徽标 */}
            {activeFilterCount > 0 && !isFilterOpen && (
              <span className="absolute -top-1 -right-1 bg-amber-500 text-neutral-950 font-bold text-[9px] w-4 h-4 rounded-full flex items-center justify-center shadow">
                {activeFilterCount}
              </span>
            )}
          </Button>
        </div>
        <p className="mt-1.5 px-0.5 text-[10px] leading-tight text-muted-foreground/75">
          支持空格同时匹配、引号短语、-排除、$仅卡名、@系列
        </p>
      </form>

      {/* 结果统计与快捷筛选提示栏 */}
      <div className="px-3 py-1.5 border-b border-border/40 bg-muted/20 flex items-center justify-between text-[11px] shrink-0">
        <div className="flex items-center gap-1.5 text-muted-foreground">
          <span>
            搜索结果: <strong className="text-foreground font-semibold">{total}</strong> 张
          </span>
          {activeFilterCount > 0 && (
            <Badge
              variant="outline"
              className="text-[10px] px-1 py-0 h-4 text-amber-400 border-amber-400/40"
            >
              筛选已生效 ({activeFilterCount})
            </Badge>
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

      {/* 结果列表 (带平滑暗色滚动与无限滚动) */}
      <div ref={scrollRef} onScroll={handleScroll} className="flex-1 min-h-0 overflow-y-auto p-2">
        {results.length === 0 && !isLoading && hasSearched ? (
          <div className="h-48 flex flex-col items-center justify-center text-muted-foreground text-xs p-4 text-center">
            <Sparkles className="w-8 h-8 opacity-20 mb-2" />
            <p>未找到符合条件的卡片</p>
            <p className="text-[11px] opacity-60 mt-1">请尝试放宽检索关键词或重置筛选条件</p>
          </div>
        ) : (
          <div className="space-y-1.5">
            {results.map((card) => {
              const line2 = formatSearchItemLine2(card)
              const line3 = formatSearchItemLine3(card)

              return (
                <div
                  key={card.id}
                  draggable
                  onDragStart={(e) => handleDragStart(e, card)}
                  onMouseEnter={() => setHoveredCard(card)}
                  onClick={() => setHoveredCard(card)}
                  className="flex items-center gap-2 px-2 py-1.5 rounded-md bg-card/60 hover:bg-muted/70 border border-border/40 hover:border-amber-400/40 cursor-grab active:cursor-grabbing transition-all group shadow-2xs h-[64px]"
                >
                  {/* 卡图缩略图 (标准 59:86 比例) */}
                  <img
                    src={getCardImageUrl(card.id, true)}
                    alt={card.name}
                    loading="lazy"
                    className="w-[36px] h-[52px] object-cover rounded shrink-0 border border-border/60 group-hover:scale-102 transition-transform bg-black/40"
                    onError={(e) => {
                      const target = e.currentTarget
                      if (target.src !== CARD_BACK_IMAGE) {
                        target.src = CARD_BACK_IMAGE
                      }
                    }}
                  />

                  {/* 卡片核心情报 (精准对标 YGOPro 经典列表排版) */}
                  <div className="flex-1 min-w-0 flex flex-col justify-center gap-0.5 select-none py-0.5">
                    {/* 第 1 行：卡名 */}
                    <span className="text-xs font-semibold truncate text-foreground group-hover:text-primary transition-colors leading-tight">
                      {card.name}
                    </span>

                    {/* 第 2 行：类型 / 属性 / 种族 / 等级 (怪兽) 或 魔法/陷阱类别 */}
                    <div className="text-[11px] text-foreground/80 leading-tight truncate">
                      {line2}
                    </div>

                    {/* 第 3 行：攻防数值 / 刻度 (仅怪兽) */}
                    {line3 && (
                      <div className="text-[11px] font-mono text-foreground/75 leading-tight truncate">
                        {line3}
                      </div>
                    )}
                  </div>

                  {/* 收藏按钮 */}
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation()
                      toggleFavorite(card.id)
                    }}
                    title={isFavorite(card.id) ? '取消收藏' : '收藏此卡'}
                    className="p-1 rounded text-muted-foreground hover:text-amber-400 shrink-0 transition-opacity"
                  >
                    <Star
                      className={`w-3.5 h-3.5 transition-all ${
                        isFavorite(card.id)
                          ? 'fill-amber-400 text-amber-400 opacity-100'
                          : 'opacity-0 group-hover:opacity-100 hover:text-foreground'
                      }`}
                    />
                  </button>
                </div>
              )
            })}

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
