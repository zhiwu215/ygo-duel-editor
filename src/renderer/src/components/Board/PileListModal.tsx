import { Tooltip, TooltipTrigger, TooltipContent } from '../ui/tooltip'
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
        className="bg-popover text-popover-foreground border border-border rounded-lg shadow-2xl w-full max-w-4xl max-h-[92%] flex flex-col overflow-hidden animate-in zoom-in-95 duration-100"
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
          onDragOver={(e) => {
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
              {filteredCards.length > 5 && (
                <Tooltip>
                  <TooltipTrigger
                    render={
                      <button
                        type="button"
                        onClick={handleScrollLeft}
                        className="absolute left-2 z-20 w-8 h-8 rounded-full bg-background/80 hover:bg-background border border-border shadow-md flex items-center justify-center text-foreground/80 hover:text-foreground transition-all cursor-pointer"
                      >
                        <ChevronLeft className="w-5 h-5" />
                      </button>
                    }
                  />
                  <TooltipContent>向左滚动</TooltipContent>
                </Tooltip>
              )}

              <div
                ref={scrollContainerRef}
                onWheel={(e) => {
                  if (scrollContainerRef.current && e.deltaY !== 0) {
                    scrollContainerRef.current.scrollLeft += e.deltaY
                  }
                }}
                onDragOver={(e) => {
                  if (e.dataTransfer.types.includes('text/pile-reorder-id')) {
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
                  if (!e.currentTarget.contains(e.relatedTarget as Node)) {
                    if (isOutsideList) setIsOutsideList(false)
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
                      <div
                        draggable
                        data-pile-card-index={originalIndex}
                        onDragStart={(e) => {
                          e.dataTransfer.setData('text/pile-reorder-id', card.instanceId)
                          e.dataTransfer.setData('text/pile-reorder-index', String(originalIndex))
                          if (card.card) {
                            e.dataTransfer.setData('application/json', JSON.stringify(card.card))
                          }
                          e.dataTransfer.setData('text/instanceId', card.instanceId)
                          e.dataTransfer.effectAllowed = 'copyMove'
                          const sourceImage = e.currentTarget.querySelector('img')
                          if (sourceImage?.complete && sourceImage.naturalWidth > 0) {
                            const preview = document.createElement('canvas')
                            preview.width = 64
                            preview.height = 92
                            preview.style.cssText =
                              'position:fixed;left:0;top:0;opacity:0.01;pointer-events:none'
                            const context = preview.getContext('2d')
                            if (context) {
                              context.drawImage(sourceImage, 0, 0, preview.width, preview.height)
                              document.body.appendChild(preview)

                              const cleanupPreview = (): void => {
                                preview.remove()
                                document.removeEventListener('dragend', cleanupPreview, true)
                                window.clearTimeout(cleanupTimer)
                              }
                              document.addEventListener('dragend', cleanupPreview, true)
                              const cleanupTimer = window.setTimeout(cleanupPreview, 30_000)

                              e.dataTransfer.setDragImage(
                                preview,
                                preview.width / 2,
                                preview.height / 2
                              )
                            } else {
                              e.dataTransfer.setDragImage(
                                sourceImage,
                                sourceImage.width / 2,
                                sourceImage.height / 2
                              )
                            }
                          } else if (sourceImage) {
                            e.dataTransfer.setDragImage(
                              sourceImage,
                              sourceImage.width / 2,
                              sourceImage.height / 2
                            )
                          }

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
                                      'text-[9px] px-1 py-0.5 rounded font-sans transition-colors cursor-pointer border leading-none',
                                      card.position === CardPosition.FACEUP
                                        ? 'bg-cyan-500/15 text-cyan-600 dark:text-cyan-400 border-cyan-500/40 font-semibold'
                                        : 'bg-muted/80 text-muted-foreground border-border hover:text-foreground'
                                    )}
                                  >
                                    {card.position === CardPosition.FACEUP ? '表侧' : '里侧'}
                                  </button>
                                }
                              />
                              <TooltipContent>点击切换 表侧 / 里侧 表示形式</TooltipContent>
                            </Tooltip>
                          )}
                        </div>

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

                        <div className="w-full mt-2 text-center">
                          <Tooltip>
                            <TooltipTrigger
                              render={
                                <p className="text-xs font-medium text-foreground truncate px-1">
                                  {card.card?.name || `卡密: ${card.code}`}
                                </p>
                              }
                            />
                            <TooltipContent>{card.card?.name || String(card.code)}</TooltipContent>
                          </Tooltip>
                        </div>

                        <div className="w-full flex items-center justify-between mt-2 pt-1.5 border-t border-border/50 text-muted-foreground">
                          <span className="text-[10px] font-mono text-muted-foreground/60 px-0.5">
                            #{originalIndex + 1}
                          </span>

                          <div className="flex items-center gap-1">
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
                                    className="p-1 rounded hover:bg-muted hover:text-foreground text-muted-foreground transition-colors cursor-pointer"
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
                                    className="p-1 rounded hover:bg-rose-500/10 hover:text-rose-500 text-muted-foreground transition-colors cursor-pointer"
                                  >
                                    <Trash2 className="w-3.5 h-3.5" />
                                  </button>
                                }
                              />
                              <TooltipContent>从决斗中移除</TooltipContent>
                            </Tooltip>
                          </div>
                        </div>
                      </div>
                      {gapAfter && renderGap('after')}
                    </React.Fragment>
                  )
                })}
              </div>

              {filteredCards.length > 5 && (
                <Tooltip>
                  <TooltipTrigger
                    render={
                      <button
                        type="button"
                        onClick={handleScrollRight}
                        className="absolute right-2 z-20 w-8 h-8 rounded-full bg-background/80 hover:bg-background border border-border shadow-md flex items-center justify-center text-foreground/80 hover:text-foreground transition-all cursor-pointer"
                      >
                        <ChevronRight className="w-5 h-5" />
                      </button>
                    }
                  />
                  <TooltipContent>向右滚动</TooltipContent>
                </Tooltip>
              )}
            </>
          )}
        </div>

        <div className="flex items-center justify-end px-4 py-2.5 border-t border-border bg-muted/20 shrink-0">
          <Button size="sm" onClick={closePile} className="px-5 h-7 text-xs">
            确定
          </Button>
        </div>
      </div>
    </div>
  )
}
