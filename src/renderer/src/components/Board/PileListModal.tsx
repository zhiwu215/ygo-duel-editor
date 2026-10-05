import React, { useState, useEffect, useMemo, useRef } from 'react'
import { CardLocation, CardPosition, CdbCard, DeckData } from '@shared/index'
import { useDuelStore } from '../../stores/useDuelStore'
import { usePileListStore } from '../../stores/usePileListStore'
import { useContextMenuStore } from '../../stores/useContextMenuStore'
import { getCardImageUrl, CARD_BACK_IMAGE } from '../../utils/cardImage'
import { getDropPosOverride } from '../../utils/zoneDrop'
import {
  Layers,
  Ghost,
  Ban,
  X,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  Trash2,
  Search,
  GripVertical,
  MoreHorizontal,
  FolderOpen,
  Hand
} from 'lucide-react'
import { Button } from '../ui/button'
import { Input } from '../ui/input'
import { Badge } from '../ui/badge'
import { cn } from '../../lib/utils'

interface LocationMeta {
  name: string
  short: string
  icon: React.ComponentType<{ className?: string }>
}

const LOCATION_META: Record<number, LocationMeta> = {
  [CardLocation.EXTRA]: { name: '额外卡组', short: '额外', icon: Layers },
  [CardLocation.DECK]: { name: '主卡组', short: '主卡', icon: Layers },
  [CardLocation.GRAVE]: { name: '墓地', short: '墓地', icon: Ghost },
  [CardLocation.REMOVED]: { name: '除外区', short: '除外', icon: Ban }
}

/**
 * 堆叠区域（额外卡组 / 主卡组 / 墓地 / 除外区）的卡片列表查看与编排弹窗。
 * 还原并升级 YGOPro 实机的「查看列表」体验：
 * - 拖动卡片外框：在列表内左右推动实时调整叠放次序，目标落点单侧强光高亮；
 * - 拖动卡图：直接拖出弹窗放置到场上或手牌中做场；
 * - 外部拖入：支持从搜索栏拖入卡片直接添加/插入到本卡堆；
 * - 右键菜单 / 更多按钮：支持移至手牌、送去墓地、除外、回到卡组、删除及灵摆表侧切换。
 */
export const PileListModal: React.FC = () => {
  const { target } = usePileListStore()

  if (!target) return null

  return <PileListContent key={`${target.controller}_${target.location}`} />
}

const PileListContent: React.FC = () => {
  const { target, closePile } = usePileListStore()
  const openContextMenu = useContextMenuStore((s) => s.openMenu)
  const {
    state,
    setHoveredCard,
    setHoveredInstanceId,
    setSelectedCardId,
    removeCard,
    reorderPileCards,
    updateCardPosition,
    addCardToZone,
    moveCard,
    applyDeckToPlayer,
    executeDrawCard
  } = useDuelStore()

  const [searchQuery, setSearchQuery] = useState<string>('')
  const [draggingIndex, setDraggingIndex] = useState<number | null>(null)
  const [dragOverInfo, setDragOverInfo] = useState<{
    index: number
    side: 'before' | 'after'
  } | null>(null)
  const scrollContainerRef = useRef<HTMLDivElement>(null)

  // —— 主卡组专属：从卡组库载入 ——
  // 空卡组时直接展开卡组库：此时用户点开面板的唯一意图就是「挑一副卡组载入」，
  // 少点一次。已有卡组则默认收起，让卡片列表占满空间。
  const [showDeckLibrary, setShowDeckLibrary] = useState<boolean>(() => {
    if (!target || target.location !== CardLocation.DECK) return false
    return !state.cards.some(
      (c) => c.controller === target.controller && c.location === CardLocation.DECK
    )
  })
  const [deckLibrary, setDeckLibrary] = useState<DeckData[]>([])
  const [deckLibQuery, setDeckLibQuery] = useState<string>('')
  // 初值 true：挂载即取一次卡组库，取回前展开都显示加载中（由 promise 收尾置 false）
  const [isLoadingDecks, setIsLoadingDecks] = useState<boolean>(true)
  // 载入卡组时是否顺带模拟起手抽牌。默认全留：切换卡组属于剧情中途行为，
  // 不应再自动抽 5 张（起手抽 5 只在「配置开局」那一次使用）。
  const [loadDrawCount, setLoadDrawCount] = useState<0 | 5>(0)

  // 监听 Esc 键关闭弹窗
  useEffect(() => {
    if (!target) return
    const handleKeyDown = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') {
        closePile()
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => {
      window.removeEventListener('keydown', handleKeyDown)
      setHoveredInstanceId(null)
    }
  }, [target, closePile, setHoveredInstanceId])

  // 兜底：拖拽在窗口外结束时浏览器可能不派发 dragend 到元素上，
  // 统一用 capture 阶段的原生 dragend 清理，避免插入点高亮卡死。
  useEffect(() => {
    if (!target) return
    const handleDragEnd = (): void => {
      setDraggingIndex(null)
      setDragOverInfo(null)
    }
    window.addEventListener('dragend', handleDragEnd, true)
    return () => window.removeEventListener('dragend', handleDragEnd, true)
  }, [target])

  // 当前区域的卡片列表（按 sequence 升序排序）
  const pileCards = useMemo(() => {
    if (!target) return []
    return state.cards
      .filter((c) => c.controller === target.controller && c.location === target.location)
      .sort((a, b) => a.sequence - b.sequence)
  }, [state.cards, target])

  // 搜索过滤后的卡片
  const filteredCards = useMemo(() => {
    const query = searchQuery.trim().toLowerCase()
    if (!query) return pileCards
    return pileCards.filter((c) => {
      const name = c.card?.name?.toLowerCase() || ''
      const code = String(c.code)
      return name.includes(query) || code.includes(query)
    })
  }, [pileCards, searchQuery])

  // 卡组库搜索过滤
  const filteredDeckLibrary = useMemo(() => {
    const query = deckLibQuery.trim().toLowerCase()
    if (!query) return deckLibrary
    return deckLibrary.filter((d) => {
      const haystack = [d.name, d.group, ...(d.tags || [])].filter(Boolean).join(' ').toLowerCase()
      return haystack.includes(query)
    })
  }, [deckLibrary, deckLibQuery])

  // 主卡组面板挂载时先取一次卡组库（供「空卡组自动展开」直接显示）。
  // 注意：不在 effect 体内同步 setState，loading 初值已由 useState 给出。
  useEffect(() => {
    if (target?.location !== CardLocation.DECK) return
    let cancelled = false
    window.api
      .getDeckList()
      .then((list) => {
        if (!cancelled) setDeckLibrary(list)
      })
      .catch(() => {
        if (!cancelled) setDeckLibrary([])
      })
      .finally(() => {
        if (!cancelled) setIsLoadingDecks(false)
      })
    return () => {
      cancelled = true
    }
  }, [target?.location])

  if (!target) return null

  const meta = LOCATION_META[target.location] || {
    name: '卡片堆',
    short: '卡堆',
    icon: Layers
  }
  const IconComponent = meta.icon
  const ctrlLabel = target.controller === 0 ? '我方' : '对方'
  const title = `${ctrlLabel}${meta.name}`

  const handleScrollLeft = (): void => {
    if (scrollContainerRef.current) {
      scrollContainerRef.current.scrollBy({ left: -320, behavior: 'smooth' })
    }
  }

  const handleScrollRight = (): void => {
    if (scrollContainerRef.current) {
      scrollContainerRef.current.scrollBy({ left: 320, behavior: 'smooth' })
    }
  }

  /** 重新读取卡组库（每次展开都刷新，保证卡组编辑器里刚保存的卡组能立刻出现） */
  const reloadDeckLibrary = (): void => {
    setIsLoadingDecks(true)
    window.api
      .getDeckList()
      .then((list) => setDeckLibrary(list))
      .catch(() => setDeckLibrary([]))
      .finally(() => setIsLoadingDecks(false))
  }

  /** 展开 / 收起卡组库 */
  const handleToggleDeckLibrary = (): void => {
    const next = !showDeckLibrary
    setShowDeckLibrary(next)
    if (!next) return
    setDeckLibQuery('')
    reloadDeckLibrary()
  }

  /** 把卡组库里的某一副卡组整体载入到本面板对应的控制者（清空该方主卡组与额外卡组后重建） */
  const handleLoadDeck = (deck: DeckData): void => {
    if (!target) return
    applyDeckToPlayer(target.controller, deck, loadDrawCount)
    setShowDeckLibrary(false)
    setDeckLibQuery('')
  }

  // 处理外部卡片拖入（从检索区新增，或从场上/手牌移动入卡堆）
  const handleExternalCardDrop = (e: React.DragEvent, insertIndex: number): void => {
    e.preventDefault()
    e.stopPropagation()
    if (!target) return
    const posOverride = getDropPosOverride(target.location, e.ctrlKey)
    try {
      const movedInstanceId = e.dataTransfer.getData('text/instanceId')
      if (movedInstanceId) {
        moveCard(movedInstanceId, target.location, insertIndex, target.controller, posOverride)
      } else {
        const dataStr = e.dataTransfer.getData('application/json')
        if (!dataStr) return
        const droppedCard = JSON.parse(dataStr) as CdbCard
        addCardToZone(droppedCard, target.controller, target.location, insertIndex, posOverride)
      }
    } catch (err) {
      console.error('[PileListModal] External drop failed:', err)
    }
  }

  return (
    <div
      className="absolute inset-0 z-40 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 select-none animate-in fade-in"
      onClick={closePile}
    >
      <div
        className="bg-popover text-popover-foreground border border-border rounded-lg shadow-2xl w-full max-w-4xl max-h-[92%] flex flex-col overflow-hidden animate-in zoom-in-95 duration-100"
        onClick={(e) => e.stopPropagation()}
      >
        {/* 顶部标题栏 */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-border bg-muted/30 shrink-0">
          <div className="flex items-center gap-2">
            <IconComponent className="w-4 h-4 text-blue-500" />
            <h2 className="font-bold text-sm tracking-tight flex items-center gap-1.5">
              <span>{title}</span>
              <Badge variant="secondary" className="font-mono text-xs px-1.5 py-0 h-5">
                {pileCards.length}
              </Badge>
            </h2>
          </div>

          <div className="flex items-center gap-3">
            {pileCards.length > 3 && (
              <div className="relative w-44">
                <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
                <Input
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="搜索卡名或卡密..."
                  className="h-7 text-xs pl-8 pr-2"
                />
              </div>
            )}

            <button
              type="button"
              onClick={closePile}
              className="text-muted-foreground hover:text-foreground p-1 rounded-md hover:bg-muted transition-colors cursor-pointer"
              title="关闭 (Esc)"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* 主卡组专属工具条：从卡组库载入 / 切换卡组 + 单张抽卡 */}
        {target.location === CardLocation.DECK && (
          <div className="flex items-center gap-2 px-4 py-2 border-b border-border bg-muted/20 shrink-0">
            <Button
              variant={showDeckLibrary ? 'default' : 'outline'}
              size="sm"
              onClick={handleToggleDeckLibrary}
              className="h-7 text-xs gap-1.5 cursor-pointer"
            >
              <FolderOpen className="w-3.5 h-3.5" />
              <span>从卡组库载入</span>
              <ChevronDown
                className={cn('w-3.5 h-3.5 transition-transform', showDeckLibrary && 'rotate-180')}
              />
            </Button>

            <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
              <span>载入时手牌</span>
              <div className="flex items-center rounded-md border border-border overflow-hidden">
                {([0, 5] as const).map((n) => (
                  <button
                    key={n}
                    type="button"
                    onClick={() => setLoadDrawCount(n)}
                    className={cn(
                      'px-2 py-0.5 text-[11px] transition-colors cursor-pointer',
                      loadDrawCount === n
                        ? 'bg-primary/15 text-primary font-bold'
                        : 'text-muted-foreground hover:bg-muted'
                    )}
                  >
                    {n === 0 ? '全留' : '抽 5'}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex-1" />

            <Button
              variant="outline"
              size="sm"
              onClick={() => executeDrawCard(target.controller)}
              disabled={pileCards.length === 0}
              className="h-7 text-xs gap-1.5 cursor-pointer"
              title="把卡组顶（列表最左）那张抽到手牌，可连点"
            >
              <Hand className="w-3.5 h-3.5" />
              <span>抽 1 张</span>
            </Button>
          </div>
        )}

        {/* 卡组库列表（展开时） */}
        {target.location === CardLocation.DECK && showDeckLibrary && (
          <div className="shrink-0 border-b border-border bg-background/70 flex flex-col max-h-[36%]">
            <div className="flex items-center gap-3 px-4 pt-2.5 pb-1.5">
              <div className="relative w-52">
                <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
                <Input
                  value={deckLibQuery}
                  onChange={(e) => setDeckLibQuery(e.target.value)}
                  placeholder="搜索卡组名 / 分组 / 标签..."
                  className="h-7 text-xs pl-8 pr-2"
                />
              </div>
              <span className="text-[11px] text-muted-foreground">
                选中后立即替换{target.controller === 0 ? '我方' : '对方'}的主卡组与额外卡组
              </span>
            </div>

            <div className="flex-1 overflow-y-auto px-4 pb-3">
              {isLoadingDecks ? (
                <p className="text-xs text-muted-foreground py-8 text-center">正在读取卡组库...</p>
              ) : filteredDeckLibrary.length === 0 ? (
                <p className="text-xs text-muted-foreground py-8 text-center">
                  {deckLibrary.length === 0
                    ? '卡组库还是空的 —— 先在「卡组」窗口里创建并保存一副卡组吧'
                    : '没有匹配的卡组'}
                </p>
              ) : (
                <div className="grid grid-cols-2 xl:grid-cols-3 gap-2">
                  {filteredDeckLibrary.map((deck) => {
                    const cover = deck.coverCard || deck.extra[0] || deck.main[0]
                    return (
                      <button
                        key={deck.id || deck.name}
                        type="button"
                        onClick={() => handleLoadDeck(deck)}
                        className="flex items-center gap-2.5 p-2 rounded-lg border border-border/70 hover:border-blue-500/70 hover:bg-blue-500/[0.06] text-left transition-colors cursor-pointer"
                      >
                        <img
                          src={getCardImageUrl(cover, true)}
                          alt={deck.name}
                          className="w-8 h-[46px] object-cover rounded shrink-0 border border-border/60"
                          onError={(e) => {
                            const el = e.currentTarget
                            if (el.src !== CARD_BACK_IMAGE) el.src = CARD_BACK_IMAGE
                          }}
                        />
                        <div className="min-w-0 flex-1">
                          <p className="text-xs font-semibold truncate" title={deck.name}>
                            {deck.name}
                          </p>
                          <p className="text-[10px] text-muted-foreground font-mono mt-0.5">
                            主 {deck.main.length} / 额外 {deck.extra.length}
                          </p>
                          {(deck.group || (deck.tags && deck.tags.length > 0)) && (
                            <p className="text-[10px] text-muted-foreground/80 truncate mt-0.5">
                              {[deck.group, ...(deck.tags || [])].filter(Boolean).join(' · ')}
                            </p>
                          )}
                        </div>
                      </button>
                    )
                  })}
                </div>
              )}
            </div>
          </div>
        )}

        {/* 卡片横向滚动视窗 */}
        <div
          onDragOver={(e) => {
            const isExternal =
              e.dataTransfer.types.includes('application/json') ||
              e.dataTransfer.types.includes('text/instanceid')
            if (isExternal) {
              e.preventDefault()
              e.dataTransfer.dropEffect = 'copy'
            }
          }}
          onDrop={(e) => {
            const isExternal =
              e.dataTransfer.types.includes('application/json') ||
              e.dataTransfer.types.includes('text/instanceid')
            if (isExternal) {
              e.preventDefault()
              handleExternalCardDrop(e, pileCards.length)
              setDragOverInfo(null)
            }
          }}
          className={cn(
            'relative flex-1 max-h-[60vh] flex items-center overflow-hidden p-4 bg-muted/10',
            // 展开卡组库时压低卡片列表的最小高度，避免弹窗总高超出上限被裁切
            showDeckLibrary ? 'min-h-[180px]' : 'min-h-[360px]'
          )}
        >
          {filteredCards.length === 0 ? (
            <div
              onDragOver={(e) => {
                const isExternal =
                  e.dataTransfer.types.includes('application/json') ||
                  e.dataTransfer.types.includes('text/instanceid')
                if (isExternal) {
                  e.preventDefault()
                  e.dataTransfer.dropEffect = 'copy'
                }
              }}
              onDrop={(e) => {
                const isExternal =
                  e.dataTransfer.types.includes('application/json') ||
                  e.dataTransfer.types.includes('text/instanceid')
                if (isExternal) {
                  e.preventDefault()
                  handleExternalCardDrop(e, 0)
                  setDragOverInfo(null)
                }
              }}
              className="w-full flex flex-col items-center justify-center text-muted-foreground py-16 text-xs gap-2 border-2 border-dashed border-border/40 rounded-lg"
            >
              <IconComponent className="w-10 h-10 opacity-30 stroke-[1.5]" />
              <p>
                {searchQuery
                  ? '未找到符合条件的卡片'
                  : target.location === CardLocation.DECK
                    ? showDeckLibrary
                      ? '还没有载入卡组 —— 在上方卡组库里挑一副吧'
                      : '还没有载入卡组 —— 点上方「从卡组库载入」挑一副吧'
                    : '该区域目前没有任何卡片（可直接从右侧搜索栏拖入卡片）'}
              </p>
            </div>
          ) : (
            <>
              {/* 左侧快速翻动按钮 */}
              {filteredCards.length > 5 && (
                <button
                  type="button"
                  onClick={handleScrollLeft}
                  className="absolute left-2 z-20 w-8 h-8 rounded-full bg-background/80 hover:bg-background border border-border shadow-md flex items-center justify-center text-foreground/80 hover:text-foreground transition-all cursor-pointer"
                  title="向左滚动"
                >
                  <ChevronLeft className="w-5 h-5" />
                </button>
              )}

              {/* 卡片水平滑动条容器：支持滚轮横向滚动 */}
              <div
                ref={scrollContainerRef}
                onWheel={(e) => {
                  if (scrollContainerRef.current && e.deltaY !== 0) {
                    scrollContainerRef.current.scrollLeft += e.deltaY
                  }
                }}
                onDragOver={(e) => {
                  const isExternal =
                    e.dataTransfer.types.includes('application/json') ||
                    e.dataTransfer.types.includes('text/instanceid')
                  if (isExternal) {
                    e.preventDefault()
                    e.dataTransfer.dropEffect = 'copy'
                  }
                }}
                onDrop={(e) => {
                  const isExternal =
                    e.dataTransfer.types.includes('application/json') ||
                    e.dataTransfer.types.includes('text/instanceid')
                  if (isExternal) {
                    e.preventDefault()
                    handleExternalCardDrop(e, pileCards.length)
                    setDragOverInfo(null)
                  }
                }}
                className="w-full h-full flex items-center gap-3 overflow-x-auto overflow-y-hidden px-4 py-2 scroll-smooth"
              >
                {filteredCards.map((card) => {
                  const originalIndex = pileCards.findIndex((c) => c.instanceId === card.instanceId)
                  const tagText = `${meta.short}[${originalIndex + 1}]`
                  const isDragging = draggingIndex === originalIndex
                  const isDragOver =
                    dragOverInfo?.index === originalIndex && draggingIndex !== originalIndex
                  const dropSide = isDragOver ? dragOverInfo.side : null

                  return (
                    <div
                      key={card.instanceId}
                      draggable
                      onDragStart={(e) => {
                        e.dataTransfer.setData('text/pile-reorder-id', card.instanceId)
                        e.dataTransfer.setData('text/pile-reorder-index', String(originalIndex))
                        e.dataTransfer.effectAllowed = 'move'
                        setDraggingIndex(originalIndex)
                      }}
                      onDragOver={(e) => {
                        const isReorder = e.dataTransfer.types.includes('text/pile-reorder-id')
                        const isExternal =
                          e.dataTransfer.types.includes('application/json') ||
                          e.dataTransfer.types.includes('text/instanceid')
                        if (isReorder || isExternal) {
                          e.preventDefault()
                          e.stopPropagation()
                          e.dataTransfer.dropEffect = isReorder ? 'move' : 'copy'
                          const rect = e.currentTarget.getBoundingClientRect()
                          const mouseX = e.clientX - rect.left
                          const side = mouseX < rect.width / 2 ? 'before' : 'after'
                          if (
                            !dragOverInfo ||
                            dragOverInfo.index !== originalIndex ||
                            dragOverInfo.side !== side
                          ) {
                            setDragOverInfo({ index: originalIndex, side })
                          }
                        }
                      }}
                      onDragLeave={(e) => {
                        if (e.currentTarget.contains(e.relatedTarget as Node)) return
                        if (dragOverInfo?.index === originalIndex) {
                          setDragOverInfo(null)
                        }
                      }}
                      onDrop={(e) => {
                        e.preventDefault()
                        e.stopPropagation()
                        const isReorder = e.dataTransfer.types.includes('text/pile-reorder-id')
                        if (isReorder) {
                          const fromStr = e.dataTransfer.getData('text/pile-reorder-index')
                          const fromIndex = fromStr ? parseInt(fromStr, 10) : draggingIndex
                          const side = dragOverInfo?.side || 'before'

                          if (fromIndex !== null && fromIndex !== undefined && !isNaN(fromIndex)) {
                            let finalIndex = originalIndex
                            if (side === 'before') {
                              finalIndex =
                                fromIndex < originalIndex ? originalIndex - 1 : originalIndex
                            } else {
                              finalIndex =
                                fromIndex < originalIndex ? originalIndex : originalIndex + 1
                            }

                            if (finalIndex !== fromIndex) {
                              reorderPileCards(
                                target.controller,
                                target.location,
                                fromIndex,
                                finalIndex
                              )
                            }
                          }
                        } else {
                          const side = dragOverInfo?.side || 'after'
                          const insertIndex = side === 'before' ? originalIndex : originalIndex + 1
                          handleExternalCardDrop(e, insertIndex)
                        }
                        setDraggingIndex(null)
                        setDragOverInfo(null)
                      }}
                      onDragEnd={() => {
                        setDraggingIndex(null)
                        setDragOverInfo(null)
                      }}
                      onContextMenu={(e) => {
                        e.preventDefault()
                        e.stopPropagation()
                        openContextMenu(card, e.clientX, e.clientY)
                      }}
                      className={cn(
                        'group relative flex flex-col items-center shrink-0 w-36 bg-card border rounded-md p-2 shadow-sm transition-all select-none cursor-grab active:cursor-grabbing',
                        isDragging
                          ? 'opacity-30 scale-95 border-dashed border-blue-400 bg-blue-500/5'
                          : isDragOver
                            ? dropSide === 'before'
                              ? 'border-blue-500/60 border-l-blue-500 border-l-[3px] bg-gradient-to-r from-blue-500/25 via-blue-500/5 to-transparent scale-[1.02] shadow-[-4px_0_16px_rgba(59,130,246,0.35)]'
                              : 'border-blue-500/60 border-r-blue-500 border-r-[3px] bg-gradient-to-l from-blue-500/25 via-blue-500/5 to-transparent scale-[1.02] shadow-[4px_0_16px_rgba(59,130,246,0.35)]'
                            : 'border-border/80 hover:border-blue-500/70 hover:shadow-md'
                      )}
                      onMouseEnter={() => {
                        setHoveredInstanceId(card.instanceId)
                      }}
                      onMouseLeave={() => {
                        if (useDuelStore.getState().hoveredInstanceId === card.instanceId) {
                          setHoveredInstanceId(null)
                        }
                      }}
                      onClick={() => {
                        setSelectedCardId(card.instanceId)
                        if (card.card) setHoveredCard(card.card)
                      }}
                    >
                      {/* 前方 (左侧) 插入点高亮光柱 */}
                      {isDragOver && dropSide === 'before' && (
                        <div className="absolute -left-1.5 top-0 bottom-0 w-1.5 rounded-full bg-blue-500 shadow-[0_0_14px_3px_rgba(59,130,246,1)] z-30 pointer-events-none animate-pulse" />
                      )}
                      {/* 后方 (右侧) 插入点高亮光柱 */}
                      {isDragOver && dropSide === 'after' && (
                        <div className="absolute -right-1.5 top-0 bottom-0 w-1.5 rounded-full bg-blue-500 shadow-[0_0_14px_3px_rgba(59,130,246,1)] z-30 pointer-events-none animate-pulse" />
                      )}

                      {/* 序号标签 (还原 YGOPro 额外[1] 风格) 与表示形式切换 */}
                      <div className="w-full flex items-center justify-between text-[11px] font-mono text-muted-foreground mb-1.5 px-0.5">
                        <span className="font-semibold text-blue-600 dark:text-blue-400 flex items-center gap-1">
                          <GripVertical className="w-3 h-3 opacity-40 group-hover:opacity-80 transition-opacity" />
                          {tagText}
                          {target.location === CardLocation.DECK && originalIndex === 0 && (
                            <span className="ml-0.5 px-1 py-0.5 rounded border border-amber-500/40 bg-amber-500/15 text-amber-600 dark:text-amber-400 font-sans text-[9px] font-bold leading-none">
                              下一抽
                            </span>
                          )}
                        </span>
                        {target.location === CardLocation.EXTRA && (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation()
                              updateCardPosition(
                                card.instanceId,
                                card.position === CardPosition.FACEUP
                                  ? CardPosition.FACEDOWN
                                  : CardPosition.FACEUP
                              )
                            }}
                            className={cn(
                              'text-[9px] px-1 py-0.5 rounded font-sans transition-colors cursor-pointer border leading-none',
                              card.position === CardPosition.FACEUP
                                ? 'bg-cyan-500/15 text-cyan-600 dark:text-cyan-400 border-cyan-500/40 font-semibold'
                                : 'bg-muted/80 text-muted-foreground border-border hover:text-foreground'
                            )}
                            title="点击切换 表侧 / 里侧 表示形式"
                          >
                            {card.position === CardPosition.FACEUP ? '表侧' : '里侧'}
                          </button>
                        )}
                      </div>

                      {/* 卡片封面（支持直接拖出弹窗放置到场上或手牌） */}
                      <div
                        draggable
                        onDragStart={(e) => {
                          e.stopPropagation() // 阻止触发外层卡框的列表排序拖拽
                          if (card.card) {
                            e.dataTransfer.setData('application/json', JSON.stringify(card.card))
                            e.dataTransfer.setData('text/instanceId', card.instanceId)
                            e.dataTransfer.effectAllowed = 'copyMove'
                            // 拖拽启动后微延迟关闭弹窗，使做场者能直观看到下方的决斗盘格子
                            setTimeout(() => {
                              setDraggingIndex(null)
                              setDragOverInfo(null)
                              closePile()
                            }, 60)
                          }
                        }}
                        onDragEnd={() => {
                          setDraggingIndex(null)
                          setDragOverInfo(null)
                        }}
                        className="relative w-32 h-[186px] rounded overflow-hidden shadow border border-border/80 bg-black/30 cursor-grab active:cursor-grabbing hover:scale-[1.02] transition-transform duration-150"
                      >
                        <img
                          src={getCardImageUrl(card.code, true)}
                          alt={card.card?.name || String(card.code)}
                          className="w-full h-full object-cover pointer-events-none"
                          onError={(e) => {
                            const targetEl = e.currentTarget
                            if (targetEl.src !== CARD_BACK_IMAGE) {
                              targetEl.src = CARD_BACK_IMAGE
                            }
                          }}
                        />
                      </div>

                      {/* 卡名 */}
                      <div className="w-full mt-2 text-center">
                        <p
                          className="text-xs font-medium text-foreground truncate px-1"
                          title={card.card?.name || String(card.code)}
                        >
                          {card.card?.name || `卡密: ${card.code}`}
                        </p>
                      </div>

                      {/* 操作工具条 (序号 + 更多操作 + 移除) */}
                      <div className="w-full flex items-center justify-between mt-2 pt-1.5 border-t border-border/50 text-muted-foreground">
                        <span className="text-[10px] font-mono text-muted-foreground/60 px-0.5">
                          #{originalIndex + 1}
                        </span>

                        <div className="flex items-center gap-1">
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation()
                              const rect = e.currentTarget.getBoundingClientRect()
                              openContextMenu(card, rect.left, rect.bottom + 4)
                            }}
                            className="p-1 rounded hover:bg-muted hover:text-foreground text-muted-foreground transition-colors cursor-pointer"
                            title="更多操作 (手牌/墓地/除外/回卡组，也可右键卡片)"
                          >
                            <MoreHorizontal className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation()
                              removeCard(card.instanceId)
                            }}
                            className="p-1 rounded hover:bg-rose-500/10 hover:text-rose-500 text-muted-foreground transition-colors cursor-pointer"
                            title="从决斗中移除"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>

              {/* 右侧快速翻动按钮 */}
              {filteredCards.length > 5 && (
                <button
                  type="button"
                  onClick={handleScrollRight}
                  className="absolute right-2 z-20 w-8 h-8 rounded-full bg-background/80 hover:bg-background border border-border shadow-md flex items-center justify-center text-foreground/80 hover:text-foreground transition-all cursor-pointer"
                  title="向右滚动"
                >
                  <ChevronRight className="w-5 h-5" />
                </button>
              )}
            </>
          )}
        </div>

        {/* 底部操作与说明栏 */}
        <div className="flex items-center justify-between px-4 py-2.5 border-t border-border bg-muted/20 shrink-0">
          <p className="text-[11px] text-muted-foreground leading-none">
            {target.location === CardLocation.DECK
              ? '提示：列表最左一张是卡组顶（下一抽），点「抽 1 张」即抽走它；左右拖动白色卡框可调整抽卡顺序；拖动卡图可直接移至场上。'
              : '提示：左右拖动白色卡框可换位（目标侧强光指示落点）；拖动卡图可直接移至场上；右键或点击「···」可移至手牌/送墓/除外/回卡组。'}
          </p>
          <Button size="sm" onClick={closePile} className="px-5 h-7 text-xs">
            确定
          </Button>
        </div>
      </div>
    </div>
  )
}
