import { Tooltip, TooltipTrigger, TooltipContent } from '../ui/tooltip'
import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react'
import { createPortal } from 'react-dom'
import { motion } from 'framer-motion'
import { CardLocation, CardPosition, CdbCard } from '@shared/index'
import { useDuelStore } from '../../stores/useDuelStore'
import { usePileListStore } from '../../stores/usePileListStore'
import { useContextMenuStore } from '../../stores/useContextMenuStore'
import { getCardImageUrl, UNKNOWN_CARD_IMAGE } from '../../utils/cardImage'
import { fetchCardDataByCodes } from '../../utils/cardData'
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

type CdbCardItem = ReturnType<typeof useDuelStore.getState>['state']['cards'][number]

type PileRenderItem =
  { type: 'card'; card: CdbCardItem; remainingIndex: number } | { type: 'placeholder'; key: string }

interface PointerDragState {
  card: CdbCardItem
  originalIndex: number
  clientX: number
  clientY: number
  offsetX: number
  offsetY: number
  width: number
  height: number
}

interface GridMetrics {
  containerLeft: number
  containerTop: number
  colWidth: number
  rowHeight: number
  gap: number
  columns: number
  totalCards: number
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
  const [cardDataMap, setCardDataMap] = useState<Record<number, CdbCard>>({})
  const [draggedCardId, setDraggedCardId] = useState<string | null>(null)
  const [dropSlotIndex, setDropSlotIndex] = useState<number | null>(null)
  const [isExternalDrag, setIsExternalDrag] = useState<boolean>(false)
  const [pointerDrag, setPointerDrag] = useState<PointerDragState | null>(null)

  const pointerDragRef = useRef<PointerDragState | null>(null)
  const floatingCardRef = useRef<HTMLDivElement>(null)
  const dragStartPosRef = useRef<{ x: number; y: number } | null>(null)
  const pendingDragCardRef = useRef<{
    card: CdbCardItem
    originalIndex: number
    rect: DOMRect
    offsetX: number
    offsetY: number
  } | null>(null)

  const scrollContainerRef = useRef<HTMLDivElement>(null)
  const modalRef = useRef<HTMLDivElement>(null)
  const gridInfoRef = useRef<GridMetrics | null>(null)

  const autoScrollRafRef = useRef<number | null>(null)
  const slotRafRef = useRef<number | null>(null)
  const scrollVelocityRef = useRef<number>(0)
  const lastPointerRef = useRef<{ x: number; y: number } | null>(null)

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

  const pendingCodesRef = useRef<Set<number>>(new Set())
  const unknownCodesRef = useRef<Set<number>>(new Set())

  useEffect(() => {
    const missingCodes = Array.from(
      new Set(
        pileCards
          .filter(
            (c) =>
              c.code > 0 &&
              !cardDataMap[c.code] &&
              !pendingCodesRef.current.has(c.code) &&
              !unknownCodesRef.current.has(c.code)
          )
          .map((c) => c.code)
      )
    )
    if (missingCodes.length === 0) return
    for (const code of missingCodes) pendingCodesRef.current.add(code)

    fetchCardDataByCodes(missingCodes)
      .then((map) => {
        for (const code of missingCodes) {
          pendingCodesRef.current.delete(code)
          if (!map[code]) unknownCodesRef.current.add(code)
        }
        setCardDataMap((prev) => {
          const next = { ...prev }
          let changed = false
          for (const code of missingCodes) {
            const cardData = map[code]
            if (cardData && !next[code]) {
              next[code] = cardData
              changed = true
            }
          }
          return changed ? next : prev
        })
      })
      .catch((err) => {
        for (const code of missingCodes) pendingCodesRef.current.delete(code)
        void err
      })
  }, [pileCards, cardDataMap])

  const filteredCards = useMemo(() => {
    const query = searchQuery.trim().toLowerCase()
    if (!query) return pileCards
    return pileCards.filter((c) => {
      const name = (c.card?.name || cardDataMap[c.code]?.name || '').toLowerCase()
      const code = String(c.code)
      return name.includes(query) || code.includes(query)
    })
  }, [pileCards, searchQuery, cardDataMap])

  const ownerDuelist =
    state.duelists?.find((d) => d.id === activeDuelistId && d.team === target?.controller) || null

  const stopAutoScroll = useCallback((): void => {
    if (autoScrollRafRef.current !== null) {
      window.cancelAnimationFrame(autoScrollRafRef.current)
      autoScrollRafRef.current = null
    }
    scrollVelocityRef.current = 0
    lastPointerRef.current = null
  }, [])

  const queueSlotUpdate = useCallback((clientX: number, clientY: number): void => {
    if (slotRafRef.current !== null) return
    slotRafRef.current = window.requestAnimationFrame(() => {
      slotRafRef.current = null
      const grid = gridInfoRef.current
      const container = scrollContainerRef.current
      if (!grid || !container) return

      const relX = clientX - grid.containerLeft
      const relY = clientY - grid.containerTop + container.scrollTop
      const col = Math.min(
        grid.columns - 1,
        Math.max(0, Math.floor(relX / (grid.colWidth + grid.gap)))
      )
      const row = Math.max(0, Math.floor(relY / (grid.rowHeight + grid.gap)))
      const targetSlot = Math.max(0, Math.min(grid.totalCards - 1, row * grid.columns + col))

      setDropSlotIndex((prev) => (prev === targetSlot ? prev : targetSlot))
    })
  }, [])

  const startAutoScrollIfNeeded = useCallback((): void => {
    if (autoScrollRafRef.current !== null) return

    const scrollLoop = (): void => {
      const container = scrollContainerRef.current
      const velocity = scrollVelocityRef.current
      if (container && velocity !== 0) {
        container.scrollTop += velocity
        if (lastPointerRef.current) {
          queueSlotUpdate(lastPointerRef.current.x, lastPointerRef.current.y)
        }
      }
      autoScrollRafRef.current = window.requestAnimationFrame(scrollLoop)
    }

    autoScrollRafRef.current = window.requestAnimationFrame(scrollLoop)
  }, [queueSlotUpdate])

  const isPointerOutsideList = useCallback((clientX: number, clientY: number): boolean => {
    const rect = modalRef.current?.getBoundingClientRect()
    if (!rect) return false
    return (
      clientX < rect.left || clientX > rect.right || clientY < rect.top || clientY > rect.bottom
    )
  }, [])

  const handlePointerAutoScroll = useCallback(
    (clientX: number, clientY: number): void => {
      const container = scrollContainerRef.current
      if (!container) return

      lastPointerRef.current = { x: clientX, y: clientY }
      if (isPointerOutsideList(clientX, clientY)) {
        scrollVelocityRef.current = 0
        return
      }

      const rect = container.getBoundingClientRect()
      const EDGE_ZONE = 70
      const MAX_SPEED = 16

      if (clientY <= rect.top + EDGE_ZONE) {
        const ratio = Math.max(0, Math.min(1, (rect.top + EDGE_ZONE - clientY) / EDGE_ZONE))
        scrollVelocityRef.current = -Math.max(3, ratio * MAX_SPEED)
        startAutoScrollIfNeeded()
      } else if (clientY >= rect.bottom - EDGE_ZONE) {
        const ratio = Math.max(0, Math.min(1, (clientY - (rect.bottom - EDGE_ZONE)) / EDGE_ZONE))
        scrollVelocityRef.current = Math.max(3, ratio * MAX_SPEED)
        startAutoScrollIfNeeded()
      } else {
        scrollVelocityRef.current = 0
      }
    },
    [isPointerOutsideList, startAutoScrollIfNeeded]
  )

  const initGridMetrics = useCallback((): void => {
    const container = scrollContainerRef.current
    if (!container) return

    const gridEl = container.querySelector('.grid') as HTMLElement | null
    if (!gridEl) return

    const gridRect = gridEl.getBoundingClientRect()
    const firstChild = gridEl.firstElementChild as HTMLElement | null
    const childRect = firstChild?.getBoundingClientRect()

    const colWidth = childRect?.width ?? 104
    const rowHeight = childRect?.height ?? 180
    const gap = 10
    const style = window.getComputedStyle(gridEl)
    const columns = Math.max(1, style.gridTemplateColumns.split(' ').length)

    gridInfoRef.current = {
      containerLeft: gridRect.left,
      containerTop: gridRect.top - container.scrollTop,
      colWidth,
      rowHeight,
      gap,
      columns,
      totalCards: pileCards.length
    }
  }, [pileCards.length])

  useEffect(() => {
    if (!target) return
    const handleKeyDown = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') {
        if (pointerDragRef.current) {
          pointerDragRef.current = null
          gridInfoRef.current = null
          setPointerDrag(null)
          setDraggedCardId(null)
          setDropSlotIndex(null)
          dragStartPosRef.current = null
          pendingDragCardRef.current = null
          stopAutoScroll()
          return
        }
        closePile()
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => {
      window.removeEventListener('keydown', handleKeyDown)
      setHoveredInstanceId(null)
    }
  }, [target, closePile, setHoveredInstanceId, stopAutoScroll])

  useEffect(() => {
    return () => {
      stopAutoScroll()
      if (slotRafRef.current !== null) {
        window.cancelAnimationFrame(slotRafRef.current)
      }
    }
  }, [stopAutoScroll])

  useEffect(() => {
    const container = scrollContainerRef.current
    if (!container) return

    const handleWheelDuringPointerDrag = (e: WheelEvent): void => {
      if (!pointerDragRef.current) return
      if (e.deltaY !== 0) {
        container.scrollTop += e.deltaY
        if (lastPointerRef.current) {
          queueSlotUpdate(lastPointerRef.current.x, lastPointerRef.current.y)
        }
      }
    }

    container.addEventListener('wheel', handleWheelDuringPointerDrag, { passive: true })
    return () => container.removeEventListener('wheel', handleWheelDuringPointerDrag)
  }, [queueSlotUpdate])

  useEffect(() => {
    const handleWindowPointerMove = (e: PointerEvent): void => {
      lastPointerRef.current = { x: e.clientX, y: e.clientY }

      if (pendingDragCardRef.current && dragStartPosRef.current) {
        const dx = e.clientX - dragStartPosRef.current.x
        const dy = e.clientY - dragStartPosRef.current.y
        if (dx * dx + dy * dy >= 16) {
          const pending = pendingDragCardRef.current
          pendingDragCardRef.current = null
          initGridMetrics()
          const dragInfo: PointerDragState = {
            card: pending.card,
            originalIndex: pending.originalIndex,
            clientX: e.clientX,
            clientY: e.clientY,
            offsetX: pending.offsetX,
            offsetY: pending.offsetY,
            width: pending.rect.width,
            height: pending.rect.height
          }
          pointerDragRef.current = dragInfo
          setPointerDrag(dragInfo)
          setDraggedCardId(pending.card.instanceId)
          setDropSlotIndex(pending.originalIndex)
        }
      }

      if (pointerDragRef.current) {
        pointerDragRef.current.clientX = e.clientX
        pointerDragRef.current.clientY = e.clientY

        if (floatingCardRef.current) {
          const x = e.clientX - pointerDragRef.current.offsetX
          const y = e.clientY - pointerDragRef.current.offsetY
          floatingCardRef.current.style.transform = `translate3d(${x}px, ${y}px, 0)`
        }

        handlePointerAutoScroll(e.clientX, e.clientY)
        queueSlotUpdate(e.clientX, e.clientY)
      }
    }

    const handleWindowPointerUp = (): void => {
      if (pointerDragRef.current) {
        stopAutoScroll()
        const fromIndex = pointerDragRef.current.originalIndex
        const toIndex = dropSlotIndex

        if (toIndex !== null && fromIndex !== null && fromIndex !== toIndex && target) {
          reorderPileCards(target.controller, target.location, fromIndex, toIndex, ownerDuelist?.id)
        }

        pointerDragRef.current = null
        gridInfoRef.current = null
        setPointerDrag(null)
        setDraggedCardId(null)
        setDropSlotIndex(null)
        dragStartPosRef.current = null
        pendingDragCardRef.current = null
        return
      }

      if (pendingDragCardRef.current) {
        const pending = pendingDragCardRef.current
        pendingDragCardRef.current = null
        dragStartPosRef.current = null
        setSelectedCardId(pending.card.instanceId)
        const detail = pending.card.card || cardDataMap[pending.card.code]
        if (detail) setHoveredCard(detail)
      }
    }

    window.addEventListener('pointermove', handleWindowPointerMove)
    window.addEventListener('pointerup', handleWindowPointerUp)
    window.addEventListener('pointercancel', handleWindowPointerUp)

    return () => {
      window.removeEventListener('pointermove', handleWindowPointerMove)
      window.removeEventListener('pointerup', handleWindowPointerUp)
      window.removeEventListener('pointercancel', handleWindowPointerUp)
    }
  }, [
    dropSlotIndex,
    target,
    reorderPileCards,
    ownerDuelist,
    stopAutoScroll,
    handlePointerAutoScroll,
    queueSlotUpdate,
    initGridMetrics,
    cardDataMap,
    setSelectedCardId,
    setHoveredCard
  ])

  const renderItems = useMemo<PileRenderItem[]>(() => {
    if (!draggedCardId && !isExternalDrag) {
      return filteredCards.map((card, idx) => ({
        type: 'card',
        card,
        remainingIndex: idx
      }))
    }

    const remaining = draggedCardId
      ? filteredCards.filter((c) => c.instanceId !== draggedCardId)
      : filteredCards

    if (dropSlotIndex === null) {
      return remaining.map((card, idx) => ({
        type: 'card',
        card,
        remainingIndex: idx
      }))
    }

    const clampedSlot = Math.max(0, Math.min(remaining.length, dropSlotIndex))
    const items: PileRenderItem[] = []

    for (let i = 0; i < clampedSlot; i++) {
      items.push({ type: 'card', card: remaining[i], remainingIndex: i })
    }
    items.push({ type: 'placeholder', key: '__drag_slot_placeholder__' })
    for (let i = clampedSlot; i < remaining.length; i++) {
      items.push({ type: 'card', card: remaining[i], remainingIndex: i })
    }

    return items
  }, [filteredCards, draggedCardId, isExternalDrag, dropSlotIndex])

  if (!target) return null

  const meta = LOCATION_META[target.location] || {
    name: '卡片堆',
    short: '卡堆',
    icon: Layers
  }
  const IconComponent = meta.icon

  const ctrlLabel = ownerDuelist ? ownerDuelist.name : target.controller === 0 ? '我方' : '对方'
  const title = `${ctrlLabel}${meta.name}`

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
      onClick={() => {
        closePile()
      }}
    >
      <div
        ref={modalRef}
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
                    onClick={() => {
                      closePile()
                    }}
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
            const isExternal =
              e.dataTransfer.types.includes('application/json') ||
              e.dataTransfer.types.includes('text/instanceid')

            if (!isExternal) return

            e.preventDefault()
            e.stopPropagation()
            e.dataTransfer.dropEffect = 'copy'

            setIsExternalDrag(true)
            handlePointerAutoScroll(e.clientX, e.clientY)
            queueSlotUpdate(e.clientX, e.clientY)
          }}
          onDragLeave={(e) => {
            if (!e.currentTarget.contains(e.relatedTarget as Node)) {
              setDropSlotIndex(null)
              setIsExternalDrag(false)
              stopAutoScroll()
            }
          }}
          onDrop={(e) => {
            const isExternal =
              e.dataTransfer.types.includes('application/json') ||
              e.dataTransfer.types.includes('text/instanceid')
            if (isExternal && target) {
              e.preventDefault()
              e.stopPropagation()
              handleExternalCardDrop(e, dropSlotIndex ?? pileCards.length)
              setDropSlotIndex(null)
              setIsExternalDrag(false)
              stopAutoScroll()
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
                  setDropSlotIndex(null)
                  setIsExternalDrag(false)
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
              {renderItems.map((item) => {
                if (item.type === 'placeholder') {
                  return (
                    <motion.div
                      key={item.key}
                      layout="position"
                      transition={{
                        layout: {
                          type: 'spring',
                          stiffness: 300,
                          damping: 30
                        }
                      }}
                      aria-hidden="true"
                      className="rounded-md border border-dashed border-border/40 bg-muted/5 flex flex-col p-1.5 pointer-events-none select-none"
                    >
                      <div className="w-full aspect-[59/86] rounded" />
                      <div className="mt-1 min-h-[26px]" />
                    </motion.div>
                  )
                }

                const card = item.card
                const originalIndex = pileCards.findIndex((c) => c.instanceId === card.instanceId)
                const isSelected = selectedCardId === card.instanceId
                const cardName =
                  card.card?.name || cardDataMap[card.code]?.name || String(card.code)
                const cardDetail = card.card || cardDataMap[card.code]
                const isBeingDragged = draggedCardId === card.instanceId

                return (
                  <motion.div
                    key={card.instanceId}
                    layout="position"
                    transition={{
                      layout: {
                        type: 'spring',
                        stiffness: 300,
                        damping: 30
                      }
                    }}
                    data-remaining-index={item.remainingIndex}
                    className={cn('h-full', isBeingDragged && 'opacity-0 pointer-events-none')}
                  >
                    <div
                      title={cardName}
                      onDragStart={(e) => {
                        e.preventDefault()
                      }}
                      onPointerDown={(e) => {
                        if (e.button !== 0) return
                        dragStartPosRef.current = { x: e.clientX, y: e.clientY }
                        const rect = e.currentTarget.getBoundingClientRect()
                        pendingDragCardRef.current = {
                          card,
                          originalIndex,
                          rect,
                          offsetX: e.clientX - rect.left,
                          offsetY: e.clientY - rect.top
                        }
                      }}
                      onContextMenu={(e) => {
                        e.preventDefault()
                        e.stopPropagation()
                        openContextMenu({ ...card, card: cardDetail }, e.clientX, e.clientY)
                      }}
                      className={cn(
                        'group relative flex flex-col rounded-md border bg-card p-1.5 shadow-sm transition-colors select-none cursor-grab active:cursor-grabbing',
                        isSelected
                          ? 'border-blue-500 ring-1 ring-blue-500/50'
                          : 'border-border/80 hover:border-blue-500/70 hover:shadow-md'
                      )}
                      onMouseEnter={() => {
                        setHoveredInstanceId(card.instanceId)
                        if (cardDetail) setHoveredCard(cardDetail)
                      }}
                      onMouseLeave={() => {
                        if (useDuelStore.getState().hoveredInstanceId === card.instanceId) {
                          setHoveredInstanceId(null)
                        }
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
                                    openContextMenu(
                                      { ...card, card: cardDetail },
                                      rect.left,
                                      rect.bottom + 4
                                    )
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
                    </div>
                  </motion.div>
                )
              })}
            </div>
          )}
        </div>

        <div className="flex items-center justify-between px-4 py-2.5 border-t border-border bg-muted/20 shrink-0">
          <span className="text-[11px] text-muted-foreground">
            按住拖拽卡片调整顺序（拖拽中可用滚轮上下滚动） · 右键卡片可移动至其他区域
          </span>
          <Button
            size="sm"
            onClick={() => {
              closePile()
            }}
            className="px-5 h-7 text-xs"
          >
            确定
          </Button>
        </div>
      </div>

      {pointerDrag &&
        createPortal(
          <div
            ref={floatingCardRef}
            className="fixed left-0 top-0 pointer-events-none z-[9999] rounded-md border border-border shadow-2xl overflow-hidden bg-card p-1.5 will-change-transform"
            style={{
              width: pointerDrag.width,
              height: pointerDrag.height,
              transform: `translate3d(${pointerDrag.clientX - pointerDrag.offsetX}px, ${pointerDrag.clientY - pointerDrag.offsetY}px, 0)`,
              opacity: 0.9
            }}
          >
            <div className="relative w-full aspect-[59/86] rounded overflow-hidden border border-border/70 bg-black/30">
              <img
                src={getCardImageUrl(pointerDrag.card.code, true)}
                alt=""
                className="w-full h-full object-cover pointer-events-none"
              />
            </div>
            <span className="mt-1 min-h-[26px] px-0.5 text-[10.5px] leading-[13px] text-center text-foreground/85 line-clamp-2 break-all block">
              {pointerDrag.card.card?.name ||
                cardDataMap[pointerDrag.card.code]?.name ||
                String(pointerDrag.card.code)}
            </span>
          </div>,
          document.body
        )}
    </div>
  )
}
