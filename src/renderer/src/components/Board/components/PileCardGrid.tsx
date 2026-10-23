import React, { useCallback, useMemo } from 'react'
import { createPortal } from 'react-dom'
import { DndContext, DragOverlay } from '@dnd-kit/core'
import { SortableContext, rectSortingStrategy } from '@dnd-kit/sortable'
import { FieldCard } from '@shared/index'
import { useSortableReorder } from '../../../hooks/useSortableReorder'
import { resolveCardName } from '../../../utils/cardNames'
import {
  DROP_ANIMATION,
  SORTABLE_MEASURING,
  pointerFirstCollisionDetection
} from '../../../utils/dnd'
import { CardImage } from '../../ui/CardImage'
import { PileCardTile } from './PileCardTile'

interface PileCardGridProps {
  cards: FieldCard[]
  dragEnabled: boolean
  location: number
  holdEnabled: boolean
  selectedCardId?: string | null
  chainIndexesByInstance?: Map<string, number[]>
  actionsDisabled?: boolean
  getCardName?: (card: FieldCard) => string
  onSelect: (card: FieldCard) => void
  onHoverChange: (card: FieldCard, hovering: boolean) => void
  onTogglePosition?: (card: FieldCard) => void
  onHold: (card: FieldCard, point: { x: number; y: number }) => void
  onRemove: (card: FieldCard) => void
  onReorder: (fromIndex: number, toIndex: number) => void
}

export const PileCardGrid: React.FC<PileCardGridProps> = ({
  cards,
  dragEnabled,
  location,
  holdEnabled,
  selectedCardId = null,
  chainIndexesByInstance,
  actionsDisabled = false,
  getCardName,
  onSelect,
  onHoverChange,
  onTogglePosition,
  onHold,
  onRemove,
  onReorder
}) => {
  const ids = useMemo(() => cards.map((card) => card.instanceId), [cards])

  const {
    activeId,
    activeIdRef,
    activeSensors,
    wasDraggingRef,
    handleDragStart,
    handleDragEnd,
    handleDragCancel
  } = useSortableReorder({ ids, enabled: dragEnabled, onReorder })

  const handleSelect = useCallback(
    (card: FieldCard): void => {
      if (wasDraggingRef.current) {
        wasDraggingRef.current = false
        return
      }
      onSelect(card)
    },
    [wasDraggingRef, onSelect]
  )

  const handleHoverChange = useCallback(
    (card: FieldCard, hovering: boolean): void => {
      if (activeIdRef.current) return
      onHoverChange(card, hovering)
    },
    [activeIdRef, onHoverChange]
  )

  const activeCard = activeId ? (cards.find((card) => card.instanceId === activeId) ?? null) : null

  return (
    <DndContext
      sensors={activeSensors}
      collisionDetection={pointerFirstCollisionDetection}
      measuring={SORTABLE_MEASURING}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
      onDragCancel={handleDragCancel}
    >
      <SortableContext items={ids} strategy={rectSortingStrategy}>
        <div className="grid grid-cols-[repeat(auto-fill,minmax(104px,1fr))] gap-2.5">
          {cards.map((card, index) => (
            <PileCardTile
              key={card.instanceId}
              card={card}
              cardName={
                getCardName ? getCardName(card) : card.card?.name || resolveCardName(card.code)
              }
              index={index}
              location={location}
              isSelected={selectedCardId === card.instanceId}
              dragDisabled={!dragEnabled}
              chainIndexes={chainIndexesByInstance?.get(card.instanceId)}
              actionsDisabled={actionsDisabled}
              onSelect={handleSelect}
              onHoverChange={handleHoverChange}
              onTogglePosition={onTogglePosition}
              onHold={onHold}
              holdEnabled={holdEnabled}
              onRemove={onRemove}
            />
          ))}
        </div>
      </SortableContext>
      {createPortal(
        <DragOverlay dropAnimation={DROP_ANIMATION} style={{ pointerEvents: 'none' }}>
          {activeCard ? (
            <div className="w-full h-full rounded overflow-hidden shadow-2xl ring-2 ring-blue-500/70">
              <CardImage
                code={activeCard.code}
                small
                alt=""
                draggable={false}
                className="w-full h-full object-cover pointer-events-none"
              />
            </div>
          ) : null}
        </DragOverlay>,
        document.body
      )}
    </DndContext>
  )
}
