import { Tooltip, TooltipTrigger, TooltipContent } from '../ui/tooltip'
import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react'
import { motion } from 'framer-motion'
import { CardLocation, CardPosition, CdbCard, FieldCard, InjectCommand } from '@shared/index'
import { useDuelStore } from '../../stores/useDuelStore'
import { useDuelEngineStore } from '../../stores/useDuelEngineStore'
import { usePileListStore } from '../../stores/usePileListStore'
import { useContextMenuStore } from '../../stores/useContextMenuStore'
import { resolveCardName } from '../../utils/cardNames'
import { getDropPosOverride } from '../../utils/zoneDrop'
import { useCardDataMap } from '../../hooks/useCardDataMap'
import { usePileDragReorder } from '../../hooks/usePileDragReorder'
import { Layers, Ghost, Ban, X, Search } from 'lucide-react'
import { Button } from '../ui/button'
import { Input } from '../ui/input'
import { Badge } from '../ui/badge'
import { PileCardTile } from './components/PileCardTile'

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

type PileRenderItem =
  { type: 'card'; card: FieldCard; remainingIndex: number } | { type: 'placeholder'; key: string }

const PileListContent: React.FC = () => {
  const { target, closePile } = usePileListStore()
  const openContextMenu = useContextMenuStore((s) => s.openMenu)
  const isEngineActive = useDuelEngineStore((s) => s.isInitialized)
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
  const [isExternalDrag, setIsExternalDrag] = useState<boolean>(false)

  const scrollContainerRef = useRef<HTMLDivElement>(null)
  const modalRef = useRef<HTMLDivElement>(null)

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
      .sort((a, b) =>
        target.location === CardLocation.DECK && isEngineActive
          ? b.sequence - a.sequence
          : a.sequence - b.sequence
      )
  }, [state.cards, state.duelists, activeDuelistId, target, isEngineActive])

  const codes = useMemo(() => pileCards.map((c) => c.code), [pileCards])
  const cardDataMap = useCardDataMap(codes)

  const getCardName = useCallback(
    (code: number): string => cardDataMap[code]?.name || resolveCardName(code),
    [cardDataMap]
  )

  const filteredCards = useMemo(() => {
    const query = searchQuery.trim().toLowerCase()
    if (!query) return pileCards
    return pileCards.filter((c) => {
      const name = getCardName(c.code).toLowerCase()
      const code = String(c.code)
      return name.includes(query) || code.includes(query)
    })
  }, [pileCards, searchQuery, getCardName])

  const ownerDuelist =
    state.duelists?.find((d) => d.id === activeDuelistId && d.team === target?.controller) || null

  const handleReorder = useCallback(
    (fromIndex: number, toIndex: number): void => {
      if (!target) return
      reorderPileCards(target.controller, target.location, fromIndex, toIndex, ownerDuelist?.id)
    },
    [target, reorderPileCards, ownerDuelist]
  )

  const handleSelectPendingCard = useCallback(
    (card: FieldCard): void => {
      setSelectedCardId(card.instanceId)
      const detail = card.card || cardDataMap[card.code]
      if (detail) setHoveredCard(detail)
    },
    [setSelectedCardId, setHoveredCard, cardDataMap]
  )

  const drag = usePileDragReorder({
    cards: pileCards,
    dragEnabled: !isEngineActive,
    scrollContainerRef,
    modalRef,
    getCardName,
    onReorder: handleReorder,
    onSelectPendingCard: handleSelectPendingCard
  })

  useEffect(() => {
    if (!target) return
    const handleKeyDown = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') {
        if (drag.cancelPointerDrag()) return
        closePile()
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => {
      window.removeEventListener('keydown', handleKeyDown)
      setHoveredInstanceId(null)
    }
  }, [target, closePile, setHoveredInstanceId, drag.cancelPointerDrag])

  const renderItems = useMemo<PileRenderItem[]>(() => {
    if (!drag.draggedCardId && !isExternalDrag) {
      return filteredCards.map((card, idx) => ({
        type: 'card',
        card,
        remainingIndex: idx
      }))
    }

    const remaining = drag.draggedCardId
      ? filteredCards.filter((c) => c.instanceId !== drag.draggedCardId)
      : filteredCards

    if (drag.dropSlotIndex === null) {
      return remaining.map((card, idx) => ({
        type: 'card',
        card,
        remainingIndex: idx
      }))
    }

    const clampedSlot = Math.max(0, Math.min(remaining.length, drag.dropSlotIndex))
    const items: PileRenderItem[] = []

    for (let i = 0; i < clampedSlot; i++) {
      items.push({ type: 'card', card: remaining[i], remainingIndex: i })
    }
    items.push({ type: 'placeholder', key: '__drag_slot_placeholder__' })
    for (let i = clampedSlot; i < remaining.length; i++) {
      items.push({ type: 'card', card: remaining[i], remainingIndex: i })
    }

    return items
  }, [filteredCards, drag.draggedCardId, isExternalDrag, drag.dropSlotIndex])

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
        const engine = useDuelEngineStore.getState()
        if (engine.isInitialized) {
          const to: Extract<InjectCommand, { op: 'add-card' }>['to'] | null =
            target.location === CardLocation.DECK
              ? insertIndex <= 0
                ? 'deck-top'
                : 'deck-bottom'
              : target.location === CardLocation.GRAVE
                ? insertIndex <= 0
                  ? 'grave-top'
                  : 'grave-bottom'
                : target.location === CardLocation.EXTRA
                  ? 'extra'
                  : target.location === CardLocation.REMOVED
                    ? 'removed'
                    : null
          if (!to) return
          void engine.inject({
            op: 'add-card',
            player: target.controller,
            code: droppedCard.id,
            to
          })
          return
        }
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
            drag.handlePointerAutoScroll(e.clientX, e.clientY)
            drag.queueSlotUpdate(e.clientX, e.clientY)
          }}
          onDragLeave={(e) => {
            if (!e.currentTarget.contains(e.relatedTarget as Node)) {
              drag.resetDropSlot()
              setIsExternalDrag(false)
              drag.stopAutoScroll()
            }
          }}
          onDrop={(e) => {
            const isExternal =
              e.dataTransfer.types.includes('application/json') ||
              e.dataTransfer.types.includes('text/instanceid')
            if (isExternal && target) {
              e.preventDefault()
              e.stopPropagation()
              handleExternalCardDrop(e, drag.dropSlotIndex ?? pileCards.length)
              drag.resetDropSlot()
              setIsExternalDrag(false)
              drag.stopAutoScroll()
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
                  drag.resetDropSlot()
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
                const cardDetail = card.card || cardDataMap[card.code]

                return (
                  <PileCardTile
                    key={card.instanceId}
                    card={card}
                    cardName={getCardName(card.code)}
                    originalIndex={originalIndex}
                    remainingIndex={item.remainingIndex}
                    location={target.location}
                    isSelected={selectedCardId === card.instanceId}
                    isBeingDragged={drag.draggedCardId === card.instanceId}
                    onPointerDown={(e) => drag.handleTilePointerDown(e, card, originalIndex)}
                    onContextMenu={(e) => {
                      e.preventDefault()
                      e.stopPropagation()
                      openContextMenu({ ...card, card: cardDetail }, e.clientX, e.clientY)
                    }}
                    onMouseEnter={() => {
                      setHoveredInstanceId(card.instanceId)
                      if (cardDetail) setHoveredCard(cardDetail)
                    }}
                    onMouseLeave={() => {
                      if (useDuelStore.getState().hoveredInstanceId === card.instanceId) {
                        setHoveredInstanceId(null)
                      }
                    }}
                    onTogglePosition={() =>
                      updateCardPosition(
                        card.instanceId,
                        card.position === CardPosition.FACEUP
                          ? CardPosition.FACEDOWN
                          : CardPosition.FACEUP
                      )
                    }
                    onOpenMenu={(e) => {
                      const rect = e.currentTarget.getBoundingClientRect()
                      openContextMenu({ ...card, card: cardDetail }, rect.left, rect.bottom + 4)
                    }}
                    onRemove={() => removeCard(card.instanceId)}
                  />
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

      {drag.ghostPortal}
    </div>
  )
}
