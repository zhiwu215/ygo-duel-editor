import { useCallback, useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import type { PointerEvent as ReactPointerEvent, ReactNode, RefObject } from 'react'
import { FieldCard } from '@shared/index'
import { getCardImageUrl } from '../utils/cardImage'

interface PointerDragState {
  card: FieldCard
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

interface PendingDragCard {
  card: FieldCard
  originalIndex: number
  rect: DOMRect
  offsetX: number
  offsetY: number
}

export interface PileDragReorderOptions {
  cards: FieldCard[]
  dragEnabled: boolean
  scrollContainerRef: RefObject<HTMLDivElement | null>
  modalRef: RefObject<HTMLDivElement | null>
  getCardName: (code: number) => string
  onReorder: (fromIndex: number, toIndex: number) => void
  onSelectPendingCard: (card: FieldCard) => void
}

export function usePileDragReorder(options: PileDragReorderOptions): {
  draggedCardId: string | null
  dropSlotIndex: number | null
  pointerDrag: PointerDragState | null
  ghostPortal: ReactNode
  handleTilePointerDown: (
    e: ReactPointerEvent<HTMLDivElement>,
    card: FieldCard,
    originalIndex: number
  ) => void
  cancelPointerDrag: () => boolean
  resetDropSlot: () => void
  stopAutoScroll: () => void
  handlePointerAutoScroll: (clientX: number, clientY: number) => void
  queueSlotUpdate: (clientX: number, clientY: number) => void
} {
  const {
    cards,
    dragEnabled,
    scrollContainerRef,
    modalRef,
    getCardName,
    onReorder,
    onSelectPendingCard
  } = options

  const [draggedCardId, setDraggedCardId] = useState<string | null>(null)
  const [dropSlotIndex, setDropSlotIndex] = useState<number | null>(null)
  const [pointerDrag, setPointerDrag] = useState<PointerDragState | null>(null)

  const pointerDragRef = useRef<PointerDragState | null>(null)
  const floatingCardRef = useRef<HTMLDivElement>(null)
  const dragStartPosRef = useRef<{ x: number; y: number } | null>(null)
  const pendingDragCardRef = useRef<PendingDragCard | null>(null)
  const gridInfoRef = useRef<GridMetrics | null>(null)

  const autoScrollRafRef = useRef<number | null>(null)
  const slotRafRef = useRef<number | null>(null)
  const scrollVelocityRef = useRef<number>(0)
  const lastPointerRef = useRef<{ x: number; y: number } | null>(null)

  const stopAutoScroll = useCallback((): void => {
    if (autoScrollRafRef.current !== null) {
      window.cancelAnimationFrame(autoScrollRafRef.current)
      autoScrollRafRef.current = null
    }
    scrollVelocityRef.current = 0
    lastPointerRef.current = null
  }, [])

  const queueSlotUpdate = useCallback(
    (clientX: number, clientY: number): void => {
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
    },
    [scrollContainerRef]
  )

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
  }, [queueSlotUpdate, scrollContainerRef])

  const isPointerOutsideList = useCallback(
    (clientX: number, clientY: number): boolean => {
      const rect = modalRef.current?.getBoundingClientRect()
      if (!rect) return false
      return (
        clientX < rect.left || clientX > rect.right || clientY < rect.top || clientY > rect.bottom
      )
    },
    [modalRef]
  )

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
    [isPointerOutsideList, startAutoScrollIfNeeded, scrollContainerRef]
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
      totalCards: cards.length
    }
  }, [cards.length, scrollContainerRef])

  const resetDragRefs = useCallback((): void => {
    pointerDragRef.current = null
    gridInfoRef.current = null
    dragStartPosRef.current = null
    pendingDragCardRef.current = null
  }, [])

  const cancelPointerDrag = useCallback((): boolean => {
    if (!pointerDragRef.current) return false
    resetDragRefs()
    setPointerDrag(null)
    setDraggedCardId(null)
    setDropSlotIndex(null)
    stopAutoScroll()
    return true
  }, [resetDragRefs, stopAutoScroll])

  const resetDropSlot = useCallback((): void => {
    setDropSlotIndex(null)
  }, [])

  const handleTilePointerDown = useCallback(
    (e: ReactPointerEvent<HTMLDivElement>, card: FieldCard, originalIndex: number): void => {
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
    },
    []
  )

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
  }, [queueSlotUpdate, scrollContainerRef])

  useEffect(() => {
    const handleWindowPointerMove = (e: PointerEvent): void => {
      lastPointerRef.current = { x: e.clientX, y: e.clientY }

      if (pendingDragCardRef.current && dragStartPosRef.current && dragEnabled) {
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

        if (toIndex !== null && fromIndex !== null && fromIndex !== toIndex) {
          onReorder(fromIndex, toIndex)
        }

        resetDragRefs()
        setPointerDrag(null)
        setDraggedCardId(null)
        setDropSlotIndex(null)
        return
      }

      if (pendingDragCardRef.current) {
        const pending = pendingDragCardRef.current
        pendingDragCardRef.current = null
        dragStartPosRef.current = null
        onSelectPendingCard(pending.card)
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
    dragEnabled,
    onReorder,
    onSelectPendingCard,
    stopAutoScroll,
    handlePointerAutoScroll,
    queueSlotUpdate,
    initGridMetrics,
    resetDragRefs
  ])

  const ghostPortal = pointerDrag
    ? createPortal(
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
            {getCardName(pointerDrag.card.code)}
          </span>
        </div>,
        document.body
      )
    : null

  return {
    draggedCardId,
    dropSlotIndex,
    pointerDrag,
    ghostPortal,
    handleTilePointerDown,
    cancelPointerDrag,
    resetDropSlot,
    stopAutoScroll,
    handlePointerAutoScroll,
    queueSlotUpdate
  }
}
