import React, { useEffect, useState, useRef } from 'react'
import { Search, Loader2, Sparkles } from 'lucide-react'
import { useCardSearchStore } from '../../stores/useCardSearchStore'
import { useDuelStore } from '../../stores/useDuelStore'
import { CardType, CardUtils, CdbCard } from '@shared/index'
import { getCardImageUrl, CARD_BACK_IMAGE } from '../../utils/cardImage'
import { Input } from '../ui/input'
import { Button } from '../ui/button'
import { Badge } from '../ui/badge'
import { cn } from '../../lib/utils'

const CATEGORY_TABS = [
  { label: '全部', type: 0 },
  { label: '怪兽', type: CardType.MONSTER },
  { label: '魔法', type: CardType.SPELL },
  { label: '陷阱', type: CardType.TRAP },
  { label: '额外', type: CardType.FUSION | CardType.SYNCHRO | CardType.XYZ | CardType.LINK }
]

export const CardSearchPanel: React.FC = () => {
  const {
    keyword,
    typeFilter,
    results,
    isLoading,
    isLoadingMore,
    hasMore,
    hasSearched,
    setKeyword,
    setTypeFilter,
    search,
    loadMore
  } = useCardSearchStore()
  const { setHoveredCard } = useDuelStore()
  const [localKw, setLocalKw] = useState(keyword)
  const scrollRef = useRef<HTMLDivElement>(null)

  // 初始加载一次默认卡片 (热门/常见卡)
  useEffect(() => {
    search({ limit: 40 })
  }, [])

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
    <aside className="w-80 h-full border-r border-border bg-card/40 flex flex-col shrink-0 select-none overflow-hidden">
      {/* 搜索框 */}
      <form onSubmit={handleSearchSubmit} className="p-3 border-b border-border/60">
        <div className="relative flex items-center">
          <Search className="w-4 h-4 text-muted-foreground absolute left-3 pointer-events-none" />
          <Input
            type="text"
            value={localKw}
            onChange={(e) => setLocalKw(e.target.value)}
            placeholder="搜索卡名、密码或效果..."
            className="pl-9 pr-8 bg-secondary/80 focus:bg-background h-9 text-sm"
          />
          {isLoading && (
            <Loader2 className="w-4 h-4 text-primary animate-spin absolute right-3 pointer-events-none" />
          )}
        </div>

        {/* 分类过滤按钮组 */}
        <div className="flex items-center gap-1 mt-2.5 overflow-x-auto no-scrollbar">
          {CATEGORY_TABS.map((tab) => {
            const active = typeFilter === tab.type
            return (
              <Button
                key={tab.label}
                type="button"
                size="xs"
                variant={active ? 'default' : 'secondary'}
                onClick={() => setTypeFilter(tab.type)}
                className="font-medium"
              >
                {tab.label}
              </Button>
            )
          })}
        </div>
      </form>

      {/* 结果列表 - 严格限制 flex-1 min-h-0 并启用流畅暗色定制滚动条，支持无限下拉加载 */}
      <div ref={scrollRef} onScroll={handleScroll} className="flex-1 min-h-0 overflow-y-auto p-2">
        <div className="space-y-1.5 pr-1">
          {results.map((card) => {
            const isMonster = CardUtils.isMonster(card.type)
            const isSpell = CardUtils.isSpell(card.type)
            const isTrap = CardUtils.isTrap(card.type)

            let typeColor = 'text-amber-400 bg-amber-400/10 border-amber-400/20'
            let typeText = '怪兽'
            if (isSpell) {
              typeColor = 'text-emerald-400 bg-emerald-400/10 border-emerald-400/20'
              typeText = '魔法'
            } else if (isTrap) {
              typeColor = 'text-rose-400 bg-rose-400/10 border-rose-400/20'
              typeText = '陷阱'
            }

            return (
              <div
                key={card.id}
                draggable
                onDragStart={(e) => handleDragStart(e, card)}
                onMouseEnter={() => setHoveredCard(card)}
                className="flex items-center gap-2.5 p-2 rounded-lg bg-card/60 hover:bg-muted/80 border border-border/40 hover:border-border cursor-grab active:cursor-grabbing transition-all group"
              >
                {/* 卡图缩略图 (优先加载 small 缩略图，秒开直连) */}
                <img
                  src={getCardImageUrl(card.id, true)}
                  alt={card.name}
                  loading="lazy"
                  className="w-9 h-13 object-cover rounded shadow-sm shrink-0 border border-border/40 group-hover:scale-105 transition-transform bg-black/40"
                  onError={(e) => {
                    const target = e.currentTarget
                    if (target.src !== CARD_BACK_IMAGE) {
                      target.src = CARD_BACK_IMAGE
                    }
                  }}
                />

                {/* 卡片简明信息 */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-1 mb-1">
                    <span className="text-xs font-semibold truncate text-foreground group-hover:text-primary transition-colors">
                      {card.name}
                    </span>
                    <Badge
                      variant="outline"
                      className={cn('text-[10px] px-1.5 py-0 font-mono', typeColor)}
                    >
                      {typeText}
                    </Badge>
                  </div>

                  <div className="flex items-center justify-between text-[11px] text-muted-foreground font-mono">
                    {isMonster ? (
                      <span>
                        {card.atk >= 0 ? card.atk : '?'}/{card.def >= 0 ? card.def : '?'}
                      </span>
                    ) : (
                      <span className="text-[10px]">密码: {card.id}</span>
                    )}

                    {isMonster && (
                      <span className="text-amber-400/80 text-[10px]">
                        ★{CardUtils.getStarLevel(card.level, card.type)}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            )
          })}

          {/* 正在加载更多卡片指示器 */}
          {isLoadingMore && (
            <div className="py-2.5 flex items-center justify-center gap-2 text-xs text-muted-foreground/80">
              <Loader2 className="w-3.5 h-3.5 animate-spin text-primary" />
              <span>正在加载更多卡片...</span>
            </div>
          )}

          {/* 全部加载完成提示 */}
          {!hasMore && results.length > 0 && (
            <div className="py-3 text-center text-[11px] text-muted-foreground/50">
              已加载全部 {results.length} 张卡片
            </div>
          )}

          {results.length === 0 && !isLoading && (
            <div className="h-64 flex flex-col items-center justify-center text-center p-4 text-muted-foreground text-xs">
              <Sparkles className="w-8 h-8 text-muted-foreground/30 mb-2" />
              <p>{hasSearched ? '未检索到相关卡片' : '尚未加载卡库或搜索为空'}</p>
              <p className="text-[11px] text-muted-foreground/60 mt-1">
                可在顶部点击「加载卡库」指定游戏 cards.cdb
              </p>
            </div>
          )}
        </div>
      </div>
    </aside>
  )
}
