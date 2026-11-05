import React, { useCallback, useMemo } from 'react'
import { createPortal } from 'react-dom'
import { DndContext, DragOverlay } from '@dnd-kit/core'
import { SortableContext, rectSortingStrategy } from '@dnd-kit/sortable'
import { FieldCard } from '@shared/index'
import { useSortableReorder } from '../../../hooks/useSortableReorder'
import { useExternalCardDrop } from '../../../hooks/useExternalCardDrop'
import { resolveCardName } from '../../../utils/cardNames'
import {
  DROP_ANIMATION,
  SORTABLE_MEASURING,
  pointerFirstCollisionDetection
} from '../../../utils/dnd'
import { CardThumb } from '../../ui/CardThumb'
import { PileCardTile } from './PileCardTile'
import { PileDropPlaceholder } from './PileDropPlaceholder'

interface PileCardGridProps {
  cards: FieldCard[]
  labels?: ReadonlyMap<string, string>
  dragEnabled: boolean
  location: number
  holdEnabled: boolean
  chainIndexesByInstance?: Map<string, number[]>
  actionsDisabled?: boolean
  getCardName?: (card: FieldCard) => string
  onSelect: (card: FieldCard) => void
  onCardClick?: (e: React.MouseEvent, card: FieldCard) => boolean
  onHoverChange: (card: FieldCard, hovering: boolean) => void
  onTogglePosition?: (card: FieldCard) => void
  onHold: (card: FieldCard, point: { x: number; y: number }) => void
  onRemove: (card: FieldCard) => void
  onReorder: (fromIndex: number, toIndex: number) => void
  onContextMenu?: (e: React.MouseEvent, card: FieldCard) => void
  onDropCard?: (e: React.DragEvent, insertIndex: number) => void
}

export const PileCardGrid: React.FC<PileCardGridProps> = ({
  cards,
  labels,
  dragEnabled,
  location,
  holdEnabled,
  chainIndexesByInstance,
  actionsDisabled = false,
  getCardName,
  onSelect,
  onCardClick,
  onHoverChange,
  onTogglePosition,
  onHold,
  onRemove,
  onReorder,
  onContextMenu,
  onDropCard
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

  const handleExternalDrop = useCallback(
    (event: React.DragEvent<HTMLElement>, insertIndex: number): void => {
      onDropCard?.(event, insertIndex)
    },
    [onDropCard]
  )

  const externalDrop = useExternalCardDrop({
    enabled: onDropCard !== undefined,
    onDrop: handleExternalDrop
  })

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

  const placeholder = (
    <PileDropPlaceholder
      card={externalDrop.previewCard}
      onDragOver={externalDrop.handlePlaceholderDragOver}
      onDrop={externalDrop.handlePlaceholderDrop}
    />
  )

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
        <div
          onDragLeave={externalDrop.handleDragLeave}
          className="grid grid-cols-[repeat(auto-fill,minmax(128px,1fr))] gap-x-5 gap-y-4"
        >
          {cards.map((card, index) => (
            <React.Fragment key={card.instanceId}>
              {externalDrop.insertedAt === index && placeholder}
              <PileCardTile
                card={card}
                cardName={
                  getCardName ? getCardName(card) : card.card?.name || resolveCardName(card.code)
                }
                label={labels?.get(card.instanceId)}
                index={index}
                location={location}
                dragDisabled={!dragEnabled}
                chainIndexes={chainIndexesByInstance?.get(card.instanceId)}
                actionsDisabled={actionsDisabled}
                onSelect={handleSelect}
                onCardClick={onCardClick}
                onHoverChange={handleHoverChange}
                onTogglePosition={onTogglePosition}
                onHold={onHold}
                holdEnabled={holdEnabled}
                onRemove={onRemove}
                onContextMenu={onContextMenu}
                onExternalDragOver={onDropCard ? externalDrop.handleDragOver : undefined}
                onExternalDrop={onDropCard ? externalDrop.handleDrop : undefined}
              />
            </React.Fragment>
          ))}
          {externalDrop.insertedAt === cards.length && placeholder}
        </div>
      </SortableContext>
      {createPortal(
        <DragOverlay dropAnimation={DROP_ANIMATION} style={{ pointerEvents: 'none' }}>
          {activeCard ? (
            <div className="aspect-[59/86] w-full overflow-hidden rounded shadow-2xl ring-2 ring-blue-500/70">
              <CardThumb
                code={activeCard.code}
                name={
                  getCardName
                    ? getCardName(activeCard)
                    : activeCard.card?.name || resolveCardName(activeCard.code)
                }
                imageClassName="pointer-events-none"
                className="h-full w-full"
              />
            </div>
          ) : null}
        </DragOverlay>,
        document.body
      )}
    </DndContext>
  )
}
