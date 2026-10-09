import { Tooltip, TooltipTrigger, TooltipContent } from '../ui/tooltip'
import React, { useState, useEffect, useMemo, useRef } from 'react'
import { CardLocation, CardPosition, CdbCard } from '@shared/index'
import { useDuelStore } from '../../stores/useDuelStore'
import { usePileListStore } from '../../stores/usePileListStore'
import { useContextMenuStore } from '../../stores/useContextMenuStore'
import { getCardImageUrl, UNKNOWN_CARD_IMAGE, setCardDragImage } from '../../utils/cardImage'
import { getDropPosOverride } from '../../utils/zoneDrop'
import { Layers, Ghost, Ban, X, Trash2, Search, MoreHorizontal } from 'lucide-react'
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

export const PileListModal: React.FC = () => {
  const { target, openSeq } = usePileListStore()

  if (!target) return null

  return <PileListContent key={`${openSeq}_${target.controller}_${target.location}`} />
}

const PileListContent: React.FC = () => {
  const { target, closePile } = usePileListStore()
  const openContextMenu = useContextMenuStore((s) => s.openMenu)
  const {
    state,
    activeDuelistId,
    selectedCardId,
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

  const [isOutsideList, setIsOutsideList] = useState(false)
  const scrollContainerRef = useRef<HTMLDivElement>(null)

  const listRectRef = useRef<DOMRect | null>(null)

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

  useEffect(() => {
    if (!isOutsideList) return
    const timer = window.setTimeout(() => {
      setDraggingIndex(null)
      closePile()
    }, 60)
    return () => window.clearTimeout(timer)
  }, [isOutsideList, closePile])

  const pileCards = useMemo(() => {
    if (!target) return []

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

  const ownerDuelist =
    state.duelists?.find((d) => d.id === activeDuelistId && d.team === target.controller) || null
  const ctrlLabel = ownerDuelist ? ownerDuelist.name : target.controller === 0 ? '我方' : '对方'
  const title = `${ctrlLabel}${meta.name}`

  const isPointerOutsideList = (clientX: number, clientY: number): boolean => {
    const rect = listRectRef.current
    if (!rect) return false
    return (
      clientX < rect.left || clientX > rect.right || clientY < rect.top || clientY > rect.bottom
    )
  }

  const getPileInsertionAtPointer = (
    clientX: number,
    clientY: number
  ): { index: number; side: 'before' | 'after' } | null => {
    const cardElements =
      scrollContainerRef.current?.querySelectorAll<HTMLElement>('[data-pile-card-index]')
    if (!cardElements?.length) return null

    let nearestCard: HTMLElement | undefined
    let nearestDistance = Number.POSITIVE_INFINITY
    for (const element of Array.from(cardElements)) {
      const rect = element.getBoundingClientRect()
      const offsetX =
        clientX < rect.left ? rect.left - clientX : clientX > rect.right ? clientX - rect.right : 0
      const offsetY =
        clientY < rect.top ? rect.top - clientY : clientY > rect.bottom ? clientY - rect.bottom : 0
      const distance = offsetX * offsetX + offsetY * offsetY
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
        if (!e.dataTransfer.types.includes('text/pile-reorder-id')) return
        if (!isPointerOutsideList(e.clientX, e.clientY)) {
          if (isOutsideList) setIsOutsideList(false)
          return
        }

        if (!isOutsideList) {
          setIsOutsideList(true)
          setDragOverInfo(null)
        }
      }}
    >
      <div
        className="bg-popover text-popover-foreground border border-border rounded-lg shadow-2xl w-full max-w-6xl max-h-[92%] flex flex-col overflow-hidden animate-in zoom-in-95 duration-100"
        onClick={(e) => e.stopPropagation()}
      >
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

            <Tooltip>
              <TooltipTrigger
                render={
                  <button
                    type="button"
                    onClick={closePile}
                    className="text-muted-foreground hover:text-foreground p-1 rounded-md hover:bg-muted transition-colors cursor-pointer"
                  >
                    <X className="w-4 h-4" />
                  </button>
                }
              />
              <TooltipContent>关闭 (Esc)</TooltipContent>
            </Tooltip>
          </div>
        </div>

        <div
          ref={scrollContainerRef}
          onDragOver={(e) => {
            if (e.dataTransfer.types.includes('text/pile-reorder-id')) {
              if (isPointerOutsideList(e.clientX, e.clientY)) return
              e.preventDefault()
              e.stopPropagation()
              e.dataTransfer.dropEffect = 'move'
              if (!(e.target as HTMLElement).closest('[data-pile-card-index]')) {
                const insertion = getPileInsertionAtPointer(e.clientX, e.clientY)
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
            if (!e.currentTarget.contains(e.relatedTarget as Node)) {
              if (isOutsideList) setIsOutsideList(false)
            }
          }}
          onDrop={(e) => {
            if (e.dataTransfer.types.includes('text/pile-reorder-id')) {
              if (isPointerOutsideList(e.clientX, e.clientY)) return
              const dropPosition = dragOverInfo ?? getPileInsertionAtPointer(e.clientX, e.clientY)
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
          className="relative flex-1 min-h-[300px] max-h-[66vh] overflow-y-auto overflow-x-hidden p-4 bg-muted/10"
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
              className="h-full min-h-[260px] w-full flex flex-col items-center justify-center text-muted-foreground py-16 text-xs gap-2 border-2 border-dashed border-border/40 rounded-lg"
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
            <div className="grid grid-cols-[repeat(auto-fill,minmax(104px,1fr))] gap-2.5">
              {filteredCards.map((card) => {
                const originalIndex = pileCards.findIndex((c) => c.instanceId === card.instanceId)
                const isDragging = draggingIndex === originalIndex
                const isDragOver =
                  dragOverInfo?.index === originalIndex && draggingIndex !== originalIndex
                const isSelected = selectedCardId === card.instanceId
                const cardName = card.card?.name || String(card.code)

                return (
                  <div
                    key={card.instanceId}
                    draggable
                    data-pile-card-index={originalIndex}
                    title={cardName}
                    onDragStart={(e) => {
                      e.dataTransfer.setData('text/pile-reorder-id', card.instanceId)
                      e.dataTransfer.setData('text/pile-reorder-index', String(originalIndex))
                      if (card.card) {
                        e.dataTransfer.setData('application/json', JSON.stringify(card.card))
                      }
                      e.dataTransfer.setData('text/instanceId', card.instanceId)
                      e.dataTransfer.effectAllowed = 'copyMove'
                      setCardDragImage(e.dataTransfer, e.currentTarget)

                      window.requestAnimationFrame(() => setDraggingIndex(originalIndex))

                      listRectRef.current =
                        scrollContainerRef.current?.getBoundingClientRect() ?? null
                    }}
                    onDragOver={(e) => {
                      const isReorder = e.dataTransfer.types.includes('text/pile-reorder-id')
                      const isExternal =
                        e.dataTransfer.types.includes('application/json') ||
                        e.dataTransfer.types.includes('text/instanceid')
                      if (isReorder || isExternal) {
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
                      'group relative flex flex-col rounded-md border bg-card p-1.5 shadow-sm transition-colors select-none cursor-grab active:cursor-grabbing',
                      isDragging
                        ? 'opacity-25 border-dashed border-border pointer-events-none'
                        : isSelected
                          ? 'border-blue-500 ring-1 ring-blue-500/50'
                          : 'border-border/80 hover:border-blue-500/70 hover:shadow-md'
                    )}
                    onMouseEnter={() => {
                      setHoveredInstanceId(card.instanceId)
                      if (card.card) setHoveredCard(card.card)
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
                    <div className="relative w-full aspect-[59/86] rounded overflow-hidden border border-border/70 bg-black/30">
                      <img
                        src={getCardImageUrl(card.code, true)}
                        alt={cardName}
                        className="w-full h-full object-cover pointer-events-none"
                        onError={(e) => {
                          const targetEl = e.currentTarget
                          if (targetEl.src !== UNKNOWN_CARD_IMAGE) {
                            targetEl.src = UNKNOWN_CARD_IMAGE
                          }
                        }}
                      />

                      <span className="absolute left-1 top-1 px-1 rounded bg-black/65 text-white/90 font-mono text-[9px] leading-[14px] pointer-events-none">
                        #{originalIndex + 1}
                      </span>

                      {target.location === CardLocation.DECK && originalIndex === 0 && (
                        <span className="absolute right-1 top-1 px-1 rounded border border-amber-500/50 bg-amber-500/85 text-black font-sans text-[9px] font-bold leading-[14px] pointer-events-none">
                          下一抽
                        </span>
                      )}

                      {target.location === CardLocation.EXTRA && (
                        <span className="absolute right-1 top-1 inline-flex">
                          <Tooltip>
                            <TooltipTrigger
                              render={
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
                                    'px-1 rounded font-sans text-[9px] leading-[14px] border transition-colors cursor-pointer',
                                    card.position === CardPosition.FACEUP
                                      ? 'bg-cyan-500/85 text-black border-cyan-500/50 font-bold'
                                      : 'bg-black/65 text-white/85 border-white/25 hover:text-white'
                                  )}
                                >
                                  {card.position === CardPosition.FACEUP ? '表侧' : '里侧'}
                                </button>
                              }
                            />
                            <TooltipContent>点击切换 表侧 / 里侧 表示形式</TooltipContent>
                          </Tooltip>
                        </span>
                      )}

                      <div className="absolute inset-x-0 bottom-0 flex items-center justify-center gap-1 p-1 opacity-0 group-hover:opacity-100 transition-opacity bg-linear-to-t from-black/80 via-black/40 to-transparent">
                        <Tooltip>
                          <TooltipTrigger
                            render={
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation()
                                  const rect = e.currentTarget.getBoundingClientRect()
                                  openContextMenu(card, rect.left, rect.bottom + 4)
                                }}
                                className="p-1 rounded text-white/85 hover:text-white hover:bg-white/15 transition-colors cursor-pointer"
                              >
                                <MoreHorizontal className="w-3.5 h-3.5" />
                              </button>
                            }
                          />
                          <TooltipContent>
                            更多操作 (手牌/墓地/除外/回卡组，也可右键卡片)
                          </TooltipContent>
                        </Tooltip>
                        <Tooltip>
                          <TooltipTrigger
                            render={
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation()
                                  removeCard(card.instanceId)
                                }}
                                className="p-1 rounded text-white/85 hover:text-rose-300 hover:bg-white/15 transition-colors cursor-pointer"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            }
                          />
                          <TooltipContent>从决斗中移除</TooltipContent>
                        </Tooltip>
                      </div>
                    </div>

                    <span className="mt-1 min-h-[26px] px-0.5 text-[10.5px] leading-[13px] text-center text-foreground/85 line-clamp-2 break-all">
                      {cardName}
                    </span>

                    {isDragOver && (
                      <span
                        aria-hidden="true"
                        className={cn(
                          'pointer-events-none absolute inset-y-1 w-[3px] rounded-full bg-blue-500 shadow-[0_0_8px_rgba(59,130,246,0.75)]',
                          dragOverInfo?.side === 'before' ? '-left-[7px]' : '-right-[7px]'
                        )}
                      />
                    )}
                  </div>
                )
              })}
            </div>
          )}
        </div>

        <div className="flex items-center justify-between px-4 py-2.5 border-t border-border bg-muted/20 shrink-0">
          <span className="text-[11px] text-muted-foreground">
            拖拽卡片可调整顺序，拖出窗口可关闭；右键卡片可移动至其他区域
          </span>
          <Button size="sm" onClick={closePile} className="px-5 h-7 text-xs">
            确定
          </Button>
        </div>
      </div>
    </div>
  )
}
