import React, { useState } from 'react'
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent
} from '@dnd-kit/core'
import { SortableContext, rectSortingStrategy } from '@dnd-kit/sortable'
import { DeckData, CdbCard } from '@shared/index'
import { CARD_BACK_IMAGE, getCardImageUrl } from '../../utils/cardImage'
import { DeckCardItem } from './DeckCardItem'

type DeckSection = 'main' | 'extra' | 'side'

interface ActiveDragCard {
  id: string
  code: number
  width: number
  height: number
}

interface SortableCard {
  id: string
  code: number
}

const getSortableCards = (section: DeckSection, codes: number[]): SortableCard[] => {
  const occurrences = new Map<number, number>()
  return codes.map((code) => {
    const occurrence = occurrences.get(code) ?? 0
    occurrences.set(code, occurrence + 1)
    return { id: `${section}:${code}:${occurrence}`, code }
  })
}

const parseSortableId = (id: string): { section: DeckSection } | null => {
  const match = /^(main|extra|side):\d+:\d+$/.exec(id)
  if (!match) return null
  return { section: match[1] as DeckSection }
}

interface DeckGridProps {
  deck: DeckData
  cardDetails: Record<number, CdbCard>
  onSelectCard: (card: CdbCard | null) => void
  onRemoveCard: (section: DeckSection, index: number) => void
  onMoveCard: (section: DeckSection, fromIndex: number, toIndex: number) => void
}

export const DeckGrid: React.FC<DeckGridProps> = ({
  deck,
  cardDetails,
  onSelectCard,
  onRemoveCard,
  onMoveCard
}) => {
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 6 }
    })
  )
  const [activeDragCard, setActiveDragCard] = useState<ActiveDragCard | null>(null)
  const sortableCards = {
    main: getSortableCards('main', deck.main),
    extra: getSortableCards('extra', deck.extra),
    side: getSortableCards('side', deck.side)
  }

  const handleDragStart = ({ active }: DragStartEvent): void => {
    const id = String(active.id)
    const draggedCard = parseSortableId(id)
    if (!draggedCard) return

    const card = sortableCards[draggedCard.section].find((item) => item.id === id)
    if (!card) return

    const rect = active.rect.current.initial
    const width = rect?.width ?? 68
    setActiveDragCard({
      id,
      code: card.code,
      width,
      height: rect?.height ?? (width * 86) / 59
    })
  }

  const handleDragEnd = ({ active, over }: DragEndEvent): void => {
    setActiveDragCard(null)
    if (!over) return

    const activeId = String(active.id)
    const overId = String(over.id)
    const activeCard = parseSortableId(activeId)
    const overCard = parseSortableId(overId)
    if (!activeCard || !overCard || activeCard.section !== overCard.section) return

    const cards = sortableCards[activeCard.section]
    const fromIndex = cards.findIndex((card) => card.id === activeId)
    const toIndex = cards.findIndex((card) => card.id === overId)
    if (fromIndex < 0 || toIndex < 0 || fromIndex === toIndex) return

    onMoveCard(activeCard.section, fromIndex, toIndex)
  }

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
      onDragCancel={() => setActiveDragCard(null)}
    >
      <div className="flex-1 overflow-y-auto pr-1 flex flex-col gap-3 min-h-0 select-none">
        {/* 1. 主卡组网格 (10 列) */}
        <div className="flex flex-col gap-1.5 p-2 rounded-lg bg-card/60 border border-border/60">
          <div className="flex items-center justify-between text-xs font-bold text-muted-foreground px-0.5">
            <span>主卡组 (10 列网格)</span>
            <span className="text-[11px] font-normal">拖动排序，右键移出卡组</span>
          </div>

          {deck.main.length > 0 ? (
            <SortableContext items={sortableCards.main} strategy={rectSortingStrategy}>
              <div className="grid grid-cols-10 gap-1.5 w-full">
                {sortableCards.main.map(({ id, code }, index) => (
                  <DeckCardItem
                    key={id}
                    sortableId={id}
                    isDragActive={activeDragCard !== null}
                    isDragging={activeDragCard?.id === id}
                    code={code}
                    card={cardDetails[code]}
                    section="main"
                    index={index}
                    onSelect={onSelectCard}
                    onRemove={onRemoveCard}
                  />
                ))}
              </div>
            </SortableContext>
          ) : (
            <div className="h-28 flex items-center justify-center border border-dashed border-border/60 rounded text-xs text-muted-foreground italic">
              主卡组为空，请从右侧点击卡片加入
            </div>
          )}
        </div>

        {/* 2. 额外卡组网格 (10 列) */}
        <div className="flex flex-col gap-1.5 p-2 rounded-lg bg-card/60 border border-border/60">
          <div className="flex items-center justify-between text-xs font-bold text-muted-foreground px-0.5">
            <span>额外卡组</span>
            <span className="text-[11px] font-normal">融合 / 同调 / 超量 / 连接</span>
          </div>

          {deck.extra.length > 0 ? (
            <SortableContext items={sortableCards.extra} strategy={rectSortingStrategy}>
              <div className="grid grid-cols-10 gap-1.5 w-full">
                {sortableCards.extra.map(({ id, code }, index) => (
                  <DeckCardItem
                    key={id}
                    sortableId={id}
                    isDragActive={activeDragCard !== null}
                    isDragging={activeDragCard?.id === id}
                    code={code}
                    card={cardDetails[code]}
                    section="extra"
                    index={index}
                    onSelect={onSelectCard}
                    onRemove={onRemoveCard}
                  />
                ))}
              </div>
            </SortableContext>
          ) : (
            <div className="h-16 flex items-center justify-center border border-dashed border-border/60 rounded text-xs text-muted-foreground italic">
              额外卡组为空
            </div>
          )}
        </div>

        {/* 3. 副卡组网格 (10 列) */}
        <div className="flex flex-col gap-1.5 p-2 rounded-lg bg-card/60 border border-border/60">
          <div className="flex items-center justify-between text-xs font-bold text-muted-foreground px-0.5">
            <span>副卡组</span>
            <span className="text-[11px] font-normal">备用卡</span>
          </div>

          {deck.side.length > 0 ? (
            <SortableContext items={sortableCards.side} strategy={rectSortingStrategy}>
              <div className="grid grid-cols-10 gap-1.5 w-full">
                {sortableCards.side.map(({ id, code }, index) => (
                  <DeckCardItem
                    key={id}
                    sortableId={id}
                    isDragActive={activeDragCard !== null}
                    isDragging={activeDragCard?.id === id}
                    code={code}
                    card={cardDetails[code]}
                    section="side"
                    index={index}
                    onSelect={onSelectCard}
                    onRemove={onRemoveCard}
                  />
                ))}
              </div>
            </SortableContext>
          ) : (
            <div className="h-16 flex items-center justify-center border border-dashed border-border/60 rounded text-xs text-muted-foreground italic">
              副卡组为空
            </div>
          )}
        </div>
      </div>
      <DragOverlay dropAnimation={null}>
        {activeDragCard && (
          <div
            className="pointer-events-none overflow-hidden rounded border border-primary/80 shadow-2xl ring-2 ring-primary/40"
            style={{ width: activeDragCard.width, height: activeDragCard.height }}
          >
            <img
              src={getCardImageUrl(activeDragCard.code, true)}
              alt={cardDetails[activeDragCard.code]?.name ?? ''}
              draggable={false}
              className="w-full h-full object-cover"
              onError={(e) => {
                e.currentTarget.src = CARD_BACK_IMAGE
              }}
            />
          </div>
        )}
      </DragOverlay>
    </DndContext>
  )
}
