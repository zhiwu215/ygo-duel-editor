import React, { useEffect, useRef, useState } from 'react'
import { CardLocation, CdbCard, FieldCard } from '@shared/index'
import { useDuelStore } from '../stores/useDuelStore'
import { useDuelEngineStore } from '../stores/useDuelEngineStore'
import { getDropPosOverride } from '../utils/zoneDrop'
import { buildInjectCommand } from '../utils/engineInject'
import { HAND_REORDER_DRAG_TYPE } from '../components/Board/CardItem'
import {
  captureHandCardAnchors,
  getHandInsertionPosition,
  type HandInsertionPosition
} from '../utils/handReorder'

export interface HandReorderDragOptions {
  cards: FieldCard[]
  controller: 0 | 1
  duelistId: string
  isOwnedHandCard: (movingCard: FieldCard) => boolean
  highlightOnForeignOver?: boolean
  canCaptureLayout?: () => boolean
  onDragStartCapture?: () => void
  onGlobalReset?: () => void
  onDropAdopted?: () => void
  onParseError?: () => void
  onInjectUnsupported?: () => void
  onDropFailure?: (err: unknown) => void
  dropLogTag: string
}

export interface HandReorderDrag {
  isDragOver: boolean
  draggedHandCardId: string | null
  handInsertionPosition: HandInsertionPosition | null
  hitAreaRef: React.RefObject<HTMLDivElement | null>
  scrollContainerRef: React.RefObject<HTMLDivElement | null>
  setIsDragOver: (over: boolean) => void
  updateHandInsertionPosition: (next: HandInsertionPosition | null) => void
  captureHandLayout: () => void
  handleDragStartCapture: (e: React.DragEvent<HTMLDivElement>) => void
  handleDragOver: (e: React.DragEvent<HTMLDivElement>) => void
  handleDrop: (e: React.DragEvent) => void
}

export function useHandReorderDrag(options: HandReorderDragOptions): HandReorderDrag {
  const {
    cards,
    controller,
    duelistId,
    isOwnedHandCard,
    highlightOnForeignOver = false,
    canCaptureLayout,
    onDragStartCapture,
    onGlobalReset,
    onDropAdopted,
    onParseError,
    onInjectUnsupported,
    onDropFailure,
    dropLogTag
  } = options

  const masterRule = useDuelStore((s) => s.state.masterRule)
  const reorderHandCards = useDuelStore((s) => s.reorderHandCards)
  const moveCard = useDuelStore((s) => s.moveCard)
  const addCardToZone = useDuelStore((s) => s.addCardToZone)

  const [isDragOver, setIsDragOver] = useState(false)
  const [draggedHandCardId, setDraggedHandCardId] = useState<string | null>(null)
  const [handInsertionPosition, setHandInsertionPosition] = useState<HandInsertionPosition | null>(
    null
  )
  const draggedHandCardIdRef = useRef<string | null>(null)
  const hideDraggedCardFrameRef = useRef<number | null>(null)
  const handInsertionPositionRef = useRef<HandInsertionPosition | null>(null)
  const handCardAnchorsRef = useRef<ReturnType<typeof captureHandCardAnchors>>([])
  const hasCapturedHandLayoutRef = useRef(false)
  const hitAreaRef = useRef<HTMLDivElement>(null)
  const scrollContainerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const handleGlobalDragEnd = (): void => {
      setIsDragOver(false)
      if (hideDraggedCardFrameRef.current !== null) {
        window.cancelAnimationFrame(hideDraggedCardFrameRef.current)
        hideDraggedCardFrameRef.current = null
      }
      setDraggedHandCardId(null)
      draggedHandCardIdRef.current = null
      handInsertionPositionRef.current = null
      handCardAnchorsRef.current = []
      hasCapturedHandLayoutRef.current = false
      setHandInsertionPosition(null)
      onGlobalReset?.()
    }
    const handleGlobalDropOutside = (e: DragEvent): void => {
      if (e.target instanceof Node && hitAreaRef.current?.contains(e.target)) return
      handleGlobalDragEnd()
    }
    window.addEventListener('dragend', handleGlobalDragEnd)
    window.addEventListener('drop', handleGlobalDragEnd)
    window.addEventListener('drop', handleGlobalDropOutside, true)
    return () => {
      window.removeEventListener('dragend', handleGlobalDragEnd)
      window.removeEventListener('drop', handleGlobalDragEnd)
      window.removeEventListener('drop', handleGlobalDropOutside, true)
      if (hideDraggedCardFrameRef.current !== null) {
        window.cancelAnimationFrame(hideDraggedCardFrameRef.current)
      }
    }
  }, [])

  const updateHandInsertionPosition = (next: HandInsertionPosition | null): void => {
    const current = handInsertionPositionRef.current
    if (current?.targetInstanceId === next?.targetInstanceId && current?.side === next?.side) return
    handInsertionPositionRef.current = next
    setHandInsertionPosition(next)
  }

  const captureHandLayout = (): void => {
    if (canCaptureLayout && !canCaptureLayout()) return
    const container = scrollContainerRef.current
    if (!hasCapturedHandLayoutRef.current && container) {
      handCardAnchorsRef.current = captureHandCardAnchors(container)
      hasCapturedHandLayoutRef.current = true
    }
  }

  const handleDragStartCapture = (e: React.DragEvent<HTMLDivElement>): void => {
    onDragStartCapture?.()
    const cardElement = (e.target as HTMLElement).closest<HTMLElement>('[data-hand-instance-id]')
    const instanceId = cardElement?.dataset.handInstanceId ?? null
    draggedHandCardIdRef.current = instanceId
    hasCapturedHandLayoutRef.current = false
    captureHandLayout()
    updateHandInsertionPosition(null)

    if (hideDraggedCardFrameRef.current !== null) {
      window.cancelAnimationFrame(hideDraggedCardFrameRef.current)
    }
    setDraggedHandCardId(null)
    if (instanceId) {
      hideDraggedCardFrameRef.current = window.requestAnimationFrame(() => {
        hideDraggedCardFrameRef.current = null
        setDraggedHandCardId(instanceId)
      })
    }
  }

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>): void => {
    e.preventDefault()
    if (e.dataTransfer.types.includes(HAND_REORDER_DRAG_TYPE)) {
      e.dataTransfer.dropEffect = 'move'
      setIsDragOver(false)
      captureHandLayout()
      const container = scrollContainerRef.current
      const nextPosition = container
        ? getHandInsertionPosition(
            container,
            handCardAnchorsRef.current,
            draggedHandCardIdRef.current,
            e.clientX
          )
        : null
      updateHandInsertionPosition(nextPosition)
      return
    }
    e.dataTransfer.dropEffect = 'copy'
    updateHandInsertionPosition(null)
    if (highlightOnForeignOver && !isDragOver) setIsDragOver(true)
  }

  const getInsertionIndex = (position: HandInsertionPosition | null): number => {
    if (!position?.targetInstanceId) return cards.length
    const targetIndex = cards.findIndex((card) => card.instanceId === position.targetInstanceId)
    return targetIndex < 0 ? cards.length : targetIndex + (position.side === 'after' ? 1 : 0)
  }

  const handleDrop = (e: React.DragEvent): void => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragOver(false)
    if (hideDraggedCardFrameRef.current !== null) {
      window.cancelAnimationFrame(hideDraggedCardFrameRef.current)
      hideDraggedCardFrameRef.current = null
    }
    setDraggedHandCardId(null)
    const insertionPosition = handInsertionPositionRef.current
    updateHandInsertionPosition(null)
    draggedHandCardIdRef.current = null
    handCardAnchorsRef.current = []
    hasCapturedHandLayoutRef.current = false
    onDropAdopted?.()
    try {
      const movedInstanceId = e.dataTransfer.getData('text/instanceId')
      if (movedInstanceId) {
        const movingCard = useDuelStore
          .getState()
          .state.cards.find((card) => card.instanceId === movedInstanceId)
        if (
          e.dataTransfer.types.includes(HAND_REORDER_DRAG_TYPE) &&
          movingCard?.controller === controller &&
          movingCard.location === CardLocation.HAND &&
          isOwnedHandCard(movingCard)
        ) {
          if (!insertionPosition) return
          const targetInstanceId =
            insertionPosition.targetInstanceId ?? cards[cards.length - 1]?.instanceId ?? null
          if (targetInstanceId) {
            reorderHandCards(
              controller,
              duelistId,
              movedInstanceId,
              targetInstanceId,
              insertionPosition.targetInstanceId ? insertionPosition.side === 'after' : true
            )
          }
          return
        }
        moveCard(
          movedInstanceId,
          CardLocation.HAND,
          getInsertionIndex(insertionPosition),
          controller,
          getDropPosOverride(CardLocation.HAND, e.ctrlKey),
          duelistId
        )
        return
      }

      const dataStr = e.dataTransfer.getData('application/json')
      if (!dataStr) return
      let droppedCard: CdbCard
      try {
        droppedCard = JSON.parse(dataStr) as CdbCard
      } catch (parseErr) {
        if (onParseError) {
          onParseError()
          return
        }
        throw parseErr
      }
      const engine = useDuelEngineStore.getState()
      if (engine.isInitialized) {
        const command = buildInjectCommand({
          card: droppedCard,
          controller,
          location: CardLocation.HAND,
          sequence: cards.length,
          ctrlKey: e.ctrlKey,
          masterRule
        })
        if (command) {
          void engine.inject(command)
        } else {
          onInjectUnsupported?.()
        }
        return
      }
      addCardToZone(
        droppedCard,
        controller,
        CardLocation.HAND,
        getInsertionIndex(insertionPosition),
        getDropPosOverride(CardLocation.HAND, e.ctrlKey),
        duelistId
      )
    } catch (err) {
      console.error(`[${dropLogTag}] Drop failed:`, err)
      onDropFailure?.(err)
    }
  }

  return {
    isDragOver,
    draggedHandCardId,
    handInsertionPosition,
    hitAreaRef,
    scrollContainerRef,
    setIsDragOver,
    updateHandInsertionPosition,
    captureHandLayout,
    handleDragStartCapture,
    handleDragOver,
    handleDrop
  }
}
