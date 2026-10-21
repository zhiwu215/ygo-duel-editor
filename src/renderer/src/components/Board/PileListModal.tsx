import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react'
import { CardLocation, CardPosition, CdbCard, FieldCard, InjectCommand } from '@shared/index'
import { useDuelStore } from '../../stores/useDuelStore'
import { useDuelEngineStore } from '../../stores/useDuelEngineStore'
import { useStagingStore } from '../../stores/useStagingStore'
import { usePileListStore } from '../../stores/usePileListStore'
import { useHeldCardStore } from '../../stores/useHeldCardStore'
import { resolveCardName } from '../../utils/cardNames'
import { getDropPosOverride } from '../../utils/zoneDrop'
import { useCardDataMap } from '../../hooks/useCardDataMap'
import { Layers, Ghost, Ban, X, Search } from 'lucide-react'
import { Button } from '../ui/button'
import { Input } from '../ui/input'
import { Badge } from '../ui/badge'
import { PileCardGrid } from './components/PileCardGrid'

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
  const isEngineActive = useDuelEngineStore((s) => s.isInitialized)
  const stagingActive = useStagingStore((s) => s.session !== null)
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
      .sort((a, b) => (isEngineActive ? b.sequence - a.sequence : a.sequence - b.sequence))
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

  const isFiltering = searchQuery.trim().length > 0
  const dragEnabled = !isEngineActive && !isFiltering && !stagingActive

  const handleSelect = useCallback(
    (card: FieldCard): void => {
      setSelectedCardId(card.instanceId)
      const detail = card.card || cardDataMap[card.code]
      if (detail) setHoveredCard(detail)
    },
    [cardDataMap, setSelectedCardId, setHoveredCard]
  )

  const handleHoverChange = useCallback(
    (card: FieldCard, hovering: boolean): void => {
      if (hovering) {
        setHoveredInstanceId(card.instanceId)
        const detail = card.card || cardDataMap[card.code]
        if (detail) setHoveredCard(detail)
      } else if (useDuelStore.getState().hoveredInstanceId === card.instanceId) {
        setHoveredInstanceId(null)
      }
    },
    [cardDataMap, setHoveredCard, setHoveredInstanceId]
  )

  const handleTogglePosition = useCallback(
    (card: FieldCard): void => {
      updateCardPosition(
        card.instanceId,
        card.position === CardPosition.FACEUP ? CardPosition.FACEDOWN : CardPosition.FACEUP
      )
    },
    [updateCardPosition]
  )

  const handleHold = useCallback(
    (card: FieldCard, point: { x: number; y: number }): void => {
      useHeldCardStore.getState().hold(card.instanceId, point)
      closePile()
    },
    [closePile]
  )

  const handleRemoveCard = useCallback(
    (card: FieldCard): void => {
      removeCard(card.instanceId)
    },
    [removeCard]
  )

  useEffect(() => {
    useHeldCardStore.getState().release()
  }, [])

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
        if (engine.isInitialized && !stagingActive) {
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
              onClick={() => {
                closePile()
              }}
              className="text-muted-foreground hover:text-foreground p-1 rounded-md hover:bg-muted transition-colors cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
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
          }}
          onDrop={(e) => {
            const isExternal =
              e.dataTransfer.types.includes('application/json') ||
              e.dataTransfer.types.includes('text/instanceid')
            if (isExternal && target) {
              e.preventDefault()
              e.stopPropagation()
              handleExternalCardDrop(e, pileCards.length)
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
            <PileCardGrid
              cards={filteredCards}
              dragEnabled={dragEnabled}
              location={target.location}
              holdEnabled={!isEngineActive || stagingActive}
              selectedCardId={selectedCardId}
              getCardName={(card) => getCardName(card.code)}
              onSelect={handleSelect}
              onHoverChange={handleHoverChange}
              onTogglePosition={handleTogglePosition}
              onHold={handleHold}
              onRemove={handleRemoveCard}
              onReorder={(fromIndex, toIndex) => {
                reorderPileCards(
                  target.controller,
                  target.location,
                  fromIndex,
                  toIndex,
                  ownerDuelist?.id
                )
              }}
            />
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
