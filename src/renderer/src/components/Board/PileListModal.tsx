import React, { useState, useEffect, useMemo, useRef } from 'react'
import { CardLocation, CardPosition, CdbCard } from '@shared/index'
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
  Trash2,
  Search,
  GripVertical,
  MoreHorizontal
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
 * - 拖动卡片任意位置：在列表内左右推动实时调整叠放次序，目标位置留出空位；
 * - 拖出列表框：把指针移出列表即切到做场意图，自动关窗并允许放置到场上或手牌；
 * - 外部拖入：支持从搜索栏拖入卡片直接添加/插入到本卡堆；
 * - 右键菜单 / 更多按钮：支持移至手牌、送去墓地、除外、回到卡组、删除及灵摆表侧切换。
 */
export const PileListModal: React.FC = () => {
  const { target, openSeq } = usePileListStore()

  if (!target) return null

  // key 里带上 openSeq：仅用 controller_location 时，反复打开同一区域会命中同一个
  // key，React 不重挂载组件，内部状态（如拖拽留下的 isOutsideList）会被下一次
  // 打开继承。带上自增序号可保证每次打开都是干净的新实例。
  return <PileListContent key={`${openSeq}_${target.controller}_${target.location}`} />
}

const PileListContent: React.FC = () => {
  const { target, closePile } = usePileListStore()
  const openContextMenu = useContextMenuStore((s) => s.openMenu)
  const {
    state,
    activeDuelistId,
    setHoveredCard,
    setHoveredInstanceId,
    setSelectedCardId,
    removeCard,
    reorderPileCards,
    updateCardPosition,
    addCardToZone,
    moveCard
  } = useDuelStore()

  const [searchQuery, setSearchQuery] = useState<string>('')
  const [draggingIndex, setDraggingIndex] = useState<number | null>(null)
  const [dragOverInfo, setDragOverInfo] = useState<{
    index: number
    side: 'before' | 'after'
  } | null>(null)
  /**
   * 指针是否已移出卡片列表视窗。用于关窗时机判断与高亮清理，
   * 实际放行判定一律走同步的 `isPointerOutsideList`（state 是异步的，事件里读会拿到旧值）。
   */
  const [isOutsideList, setIsOutsideList] = useState(false)
  const scrollContainerRef = useRef<HTMLDivElement>(null)
  /** 列表视窗的实时矩形，dragover 里要判断指针是否越界 */
  const listRectRef = useRef<DOMRect | null>(null)

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
      setIsOutsideList(false)
    }
    window.addEventListener('dragend', handleDragEnd, true)
    return () => {
      window.removeEventListener('dragend', handleDragEnd, true)
    }
  }, [target])

  /**
   * 越界做场结束后关窗。
   *
   * 两个要点：
   * 1) 必须放在 effect 里而**不能塞进 setState 的 updater**。updater 必须是纯函数，
   *    StrictMode 下会重复求值且不保证被调用。
   * 2) 延后一帧关窗：dragover 期间立即卸载会连带中断本次拖拽。
   */
  useEffect(() => {
    if (!isOutsideList) return
    const timer = window.setTimeout(() => {
      setDraggingIndex(null)
      closePile()
    }, 60)
    return () => window.clearTimeout(timer)
  }, [isOutsideList, closePile])

  // 当前区域的卡片列表（按 sequence 升序排序）
  const pileCards = useMemo(() => {
    if (!target) return []
    // 与棋盘口径保持一致：多人时堆叠区按「当前查看的决斗者」收窄，
    // 否则列表里会混进同阵营其他人的牌，且拖拽排序会作用到别人的牌上。
    const ownerScope =
      target &&
      state.duelists?.find((d) => d.id === activeDuelistId && d.team === target.controller)
        ? activeDuelistId
        : null
    return state.cards
      .filter(
        (c) =>
          c.controller === target.controller &&
          c.location === target.location &&
          (ownerScope ? c.duelistId === ownerScope : true)
      )
      .sort((a, b) => a.sequence - b.sequence)
  }, [state.cards, state.duelists, activeDuelistId, target])

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

  if (!target) return null

  const meta = LOCATION_META[target.location] || {
    name: '卡片堆',
    short: '卡堆',
    icon: Layers
  }
  const IconComponent = meta.icon
  // 多人时标题带上决斗者名字，避免两人同名卡组「我方主卡组」分不清
  const ownerDuelist =
    state.duelists?.find((d) => d.id === activeDuelistId && d.team === target.controller) || null
  const ctrlLabel = ownerDuelist ? ownerDuelist.name : target.controller === 0 ? '我方' : '对方'
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

  /**
   * 指针是否已越出卡片列表的可视框。
   *
   * 三个层级（滚动容器 / 视窗 / 全屏遮罩）都要用这个判断来决定
   * 「拦住做换位高亮」还是「放行让棋盘接管做场」，所以必须是**同步**的
   * 纯坐标比较——不能依赖 React state（setState 异步，事件里读到的还是旧值）。
   * 列表容器在拖拽期间不会移动，故 dragStart 时缓存一次矩形即可。
   */
  const isPointerOutsideList = (clientX: number, clientY: number): boolean => {
    const rect = listRectRef.current
    if (!rect) return false
    return (
      clientX < rect.left || clientX > rect.right || clientY < rect.top || clientY > rect.bottom
    )
  }

  const getPileInsertionAtX = (
    clientX: number
  ): { index: number; side: 'before' | 'after' } | null => {
    const cardElements =
      scrollContainerRef.current?.querySelectorAll<HTMLElement>('[data-pile-card-index]')
    if (!cardElements?.length) return null

    let nearestCard: HTMLElement | undefined
    let nearestDistance = Number.POSITIVE_INFINITY
    for (const element of Array.from(cardElements)) {
      const rect = element.getBoundingClientRect()
      const distance =
        clientX < rect.left ? rect.left - clientX : clientX > rect.right ? clientX - rect.right : 0
      if (distance < nearestDistance) {
        nearestCard = element
        nearestDistance = distance
      }
    }

    if (!nearestCard) return null
    const rect = nearestCard.getBoundingClientRect()
    return {
      index: Number(nearestCard.dataset.pileCardIndex),
      side: clientX >= rect.left + rect.width / 2 ? 'after' : 'before'
    }
  }

  const handlePileCardDrop = (
    e: React.DragEvent,
    targetIndex: number,
    side: 'before' | 'after'
  ): void => {
    e.preventDefault()
    e.stopPropagation()
    const isReorder = e.dataTransfer.types.includes('text/pile-reorder-id')
    if (isReorder) {
      const fromStr = e.dataTransfer.getData('text/pile-reorder-index')
      const fromIndex = fromStr ? parseInt(fromStr, 10) : draggingIndex
      if (fromIndex !== null && fromIndex !== undefined && !isNaN(fromIndex)) {
        const finalIndex =
          side === 'before'
            ? fromIndex < targetIndex
              ? targetIndex - 1
              : targetIndex
            : fromIndex < targetIndex
              ? targetIndex
              : targetIndex + 1
        if (finalIndex !== fromIndex) {
          reorderPileCards(
            target.controller,
            target.location,
            fromIndex,
            finalIndex,
            ownerDuelist?.id
          )
        }
      }
    } else {
      handleExternalCardDrop(e, targetIndex + (side === 'after' ? 1 : 0))
    }
    setDraggingIndex(null)
    setDragOverInfo(null)
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
      onDragOver={(e) => {
        // 越界判定必须挂在**全屏遮罩**上，不能挂弹窗本体：
        // dragover 只在指针所在元素的祖先链上冒泡，弹窗内的处理器在指针
        // 移出弹窗后根本不会再触发，挂在里面等于死代码。
        if (!e.dataTransfer.types.includes('text/pile-reorder-id')) return
        if (!isPointerOutsideList(e.clientX, e.clientY)) {
          // 回到列表范围内 → 恢复换位语义
          if (isOutsideList) setIsOutsideList(false)
          return
        }
        // 不 preventDefault：让事件继续走。下面的 effect 会关窗，
        // 弹窗卸载后棋盘格子接管本次 drop。
        if (!isOutsideList) {
          setIsOutsideList(true)
          setDragOverInfo(null)
        }
      }}
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

        {/* 卡片横向滚动视窗 */}
        <div
          onDragOver={(e) => {
            // 本列表内部拖拽且指针已越出列表框 → 放行给下方决斗盘（做场）。
            // 这里不能 preventDefault，否则事件被视窗拦下，永远落不到棋盘上。
            if (
              e.dataTransfer.types.includes('text/pile-reorder-id') &&
              isPointerOutsideList(e.clientX, e.clientY)
            ) {
              return
            }
            const isExternal =
              e.dataTransfer.types.includes('application/json') ||
              e.dataTransfer.types.includes('text/instanceid')
            if (isExternal) {
              e.preventDefault()
              e.dataTransfer.dropEffect = 'copy'
            }
          }}
          onDrop={(e) => {
            if (e.dataTransfer.types.includes('text/pile-reorder-id')) {
              if (isPointerOutsideList(e.clientX, e.clientY)) return
              const dropPosition = dragOverInfo ?? getPileInsertionAtX(e.clientX)
              if (dropPosition) {
                handlePileCardDrop(e, dropPosition.index, dropPosition.side)
              }
              return
            }
            const isExternal =
              e.dataTransfer.types.includes('application/json') ||
              e.dataTransfer.types.includes('text/instanceid')
            if (isExternal) {
              e.preventDefault()
              handleExternalCardDrop(e, pileCards.length)
              setDragOverInfo(null)
            }
          }}
          className="relative flex-1 min-h-[360px] max-h-[60vh] flex items-center overflow-hidden p-4 bg-muted/10"
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
                    ? '还没有载入卡组 —— 右键主卡组格选「切换卡组」即可载入'
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
                  // 本列表自己发起的拖拽：按指针是否越出列表框切换语义。
                  // 越界后**不** preventDefault，事件才能穿透到下方决斗盘完成做场。
                  if (e.dataTransfer.types.includes('text/pile-reorder-id')) {
                    // 越界即放行：不preventDefault，让事件冒泡到遮罩直至棋盘格子
                    if (isPointerOutsideList(e.clientX, e.clientY)) return
                    e.preventDefault()
                    e.stopPropagation()
                    e.dataTransfer.dropEffect = 'move'
                    if (!(e.target as HTMLElement).closest('[data-pile-card-index]')) {
                      const insertion = getPileInsertionAtX(e.clientX)
                      if (insertion) setDragOverInfo(insertion)
                    }
                    return
                  }
                  const isExternal =
                    e.dataTransfer.types.includes('application/json') ||
                    e.dataTransfer.types.includes('text/instanceid')
                  if (isExternal) {
                    e.preventDefault()
                    e.dataTransfer.dropEffect = 'copy'
                  }
                }}
                onDragLeave={(e) => {
                  // 指针彻底离开列表容器（含卡片之间的空隙）时回到列表内语义
                  if (!e.currentTarget.contains(e.relatedTarget as Node)) {
                    if (isOutsideList) setIsOutsideList(false)
                  }
                }}
                onDrop={(e) => {
                  // 自己的拖拽在列表内落位由各卡片的 onDrop 处理，这里不接
                  if (e.dataTransfer.types.includes('text/pile-reorder-id')) {
                    if (isPointerOutsideList(e.clientX, e.clientY)) return
                    const dropPosition = dragOverInfo ?? getPileInsertionAtX(e.clientX)
                    if (dropPosition) {
                      handlePileCardDrop(e, dropPosition.index, dropPosition.side)
                    }
                    return
                  }
                  const isExternal =
                    e.dataTransfer.types.includes('application/json') ||
                    e.dataTransfer.types.includes('text/instanceid')
                  if (isExternal) {
                    e.preventDefault()
                    handleExternalCardDrop(e, pileCards.length)
                    setDragOverInfo(null)
                  }
                }}
                className="relative w-full h-full flex items-center gap-3 overflow-x-auto overflow-y-hidden px-4 py-2"
              >
                {filteredCards.map((card) => {
                  const originalIndex = pileCards.findIndex((c) => c.instanceId === card.instanceId)
                  const tagText = `${meta.short}[${originalIndex + 1}]`
                  const isDragging = draggingIndex === originalIndex
                  const isDragOver =
                    dragOverInfo?.index === originalIndex && draggingIndex !== originalIndex
                  const gapBefore = isDragOver && dragOverInfo.side === 'before'
                  const gapAfter = isDragOver && dragOverInfo.side === 'after'
                  const renderGap = (side: 'before' | 'after'): React.ReactNode => (
                    <div
                      aria-hidden="true"
                      onDragOver={(e) => {
                        e.preventDefault()
                        e.stopPropagation()
                        setDragOverInfo((current) =>
                          current?.index === originalIndex && current.side === side
                            ? current
                            : { index: originalIndex, side }
                        )
                      }}
                      onDrop={(e) => handlePileCardDrop(e, originalIndex, side)}
                      className="w-36 h-[280px] shrink-0 rounded-md border border-dashed border-border/50 bg-muted/10"
                    />
                  )

                  return (
                    <React.Fragment key={card.instanceId}>
                      {gapBefore && renderGap('before')}
                      {/* 原生拖拽期间保留源节点和 flex 占位，只隐藏原位卡片，避免 Electron 中断拖拽。 */}
                      <div
                        draggable
                        data-pile-card-index={originalIndex}
                        onDragStart={(e) => {
                          // 一次 dragstart 同时写好两类载荷：
                          // - text/pile-reorder-id：列表内换位判定
                          // - application/json + text/instanceId：移出列表后做场
                          // HTML5 不允许拖拽中途改载荷，所以两者必须一起写，
                          // 靠指针是否越出列表框决定当前语义。
                          e.dataTransfer.setData('text/pile-reorder-id', card.instanceId)
                          e.dataTransfer.setData('text/pile-reorder-index', String(originalIndex))
                          if (card.card) {
                            e.dataTransfer.setData('application/json', JSON.stringify(card.card))
                          }
                          e.dataTransfer.setData('text/instanceId', card.instanceId)
                          e.dataTransfer.effectAllowed = 'copyMove'
                          const cardRect = e.currentTarget.getBoundingClientRect()
                          // 直接以真实卡片作为原生拖拽预览，避免临时克隆节点在 Electron
                          // 捕获拖拽图像前被移除，导致拖拽被中断或预览停在原位。
                          e.dataTransfer.setDragImage(
                            e.currentTarget,
                            e.clientX - cardRect.left,
                            e.clientY - cardRect.top
                          )
                          // 等原生拖拽启动并捕获预览后再隐藏源卡片，保留原位空槽反馈。
                          window.requestAnimationFrame(() => setDraggingIndex(originalIndex))
                          // 记录列表矩形，供 dragover 判断指针是否已越出列表框
                          listRectRef.current =
                            scrollContainerRef.current?.getBoundingClientRect() ?? null
                        }}
                        onDragOver={(e) => {
                          const isReorder = e.dataTransfer.types.includes('text/pile-reorder-id')
                          const isExternal =
                            e.dataTransfer.types.includes('application/json') ||
                            e.dataTransfer.types.includes('text/instanceid')
                          if (isReorder || isExternal) {
                            // 自己的拖拽且指针已越出列表 → 立刻放行。
                            // 必须在 preventDefault / stopPropagation **之前**返回：
                            // 这两个调用一旦执行，事件就被截断在卡片上，
                            // 既到不了遮罩的越界判定，也到不了棋盘格子的 drop。
                            if (isReorder && isPointerOutsideList(e.clientX, e.clientY)) return
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
                          if (scrollContainerRef.current?.contains(e.relatedTarget as Node)) return
                          if (dragOverInfo?.index === originalIndex && !isOutsideList) {
                            setDragOverInfo(null)
                          }
                        }}
                        onDrop={(e) => {
                          const rect = e.currentTarget.getBoundingClientRect()
                          const side = e.clientX >= rect.left + rect.width / 2 ? 'after' : 'before'
                          handlePileCardDrop(e, originalIndex, side)
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
                            ? 'opacity-0 pointer-events-none'
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

                        {/* 卡片封面：拖拽手柄已上移到整张卡框，这里只负责卡面展示。
                          保留 hover 放大反馈，让「整卡可拖」这件事在手感上可预期。 */}
                        <div className="relative w-32 h-[186px] rounded overflow-hidden shadow border border-border/80 bg-black/30 transition-transform duration-150 group-hover:scale-[1.02]">
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
                      {gapAfter && renderGap('after')}
                    </React.Fragment>
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
              ? '提示：列表最左一张是卡组顶（下一抽，格子上显示的就是它）；左右拖动卡片可调整抽卡顺序；把卡片拖出列表即可移至场上。'
              : '提示：左右拖动卡片可换位（目标位置留出空位）；把卡片拖出列表即可移至场上；右键或点击「···」可移至手牌/送墓/除外/回卡组。'}
          </p>
          <Button size="sm" onClick={closePile} className="px-5 h-7 text-xs">
            确定
          </Button>
        </div>
      </div>
    </div>
  )
}
