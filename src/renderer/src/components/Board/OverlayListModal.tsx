import React, { useState, useEffect, useMemo, useCallback } from 'react'
import { CdbCard, FieldCard } from '@shared/index'
import { useDuelStore } from '../../stores/useDuelStore'
import { useOverlayListStore } from '../../stores/useOverlayListStore'
import { useDuelEngineStore } from '../../stores/useDuelEngineStore'
import { useHeldCardStore } from '../../stores/useHeldCardStore'
import { useCardDataMap } from '../../hooks/useCardDataMap'
import { resolveCardName } from '../../utils/cardNames'
import { buildOverlayMaterialCards } from '../../utils/overlayMaterialCards'
import { Layers, X, Search } from 'lucide-react'
import { Button } from '../ui/button'
import { Input } from '../ui/input'
import { Badge } from '../ui/badge'
import { PileCardGrid } from './components/PileCardGrid'

export const OverlayListModal: React.FC = () => {
  const { hostInstanceId, closeOverlayList } = useOverlayListStore()
  const isEngineActive = useDuelEngineStore((s) => s.isInitialized)
  const {
    state,
    setHoveredCard,
    setHoveredInstanceId,
    removeOverlayMaterial,
    reorderOverlayMaterials
  } = useDuelStore()

  const [searchQuery, setSearchQuery] = useState<string>('')

  const hostCard = hostInstanceId ? state.cards.find((c) => c.instanceId === hostInstanceId) : null
  const materials = useMemo(() => hostCard?.overlayMaterials || [], [hostCard?.overlayMaterials])
  const cardDataMap = useCardDataMap(materials)

  const materialCards = useMemo<FieldCard[]>(
    () => (hostCard ? buildOverlayMaterialCards(materials, cardDataMap, hostCard) : []),
    [materials, cardDataMap, hostCard]
  )

  const isFiltering = searchQuery.trim().length > 0
  const dragEnabled = !isEngineActive && !isFiltering

  const filteredCards = useMemo(() => {
    const query = searchQuery.trim().toLowerCase()
    if (!query) return materialCards
    return materialCards.filter((c) => {
      const name = (c.card?.name || resolveCardName(c.code)).toLowerCase()
      return name.includes(query) || String(c.code).includes(query)
    })
  }, [materialCards, searchQuery])

  const handleSelect = useCallback(
    (card: FieldCard): void => {
      const detail = card.card || cardDataMap[card.code]
      if (detail) setHoveredCard(detail)
    },
    [cardDataMap, setHoveredCard]
  )

  const handleHoverChange = useCallback(
    (card: FieldCard, hovering: boolean): void => {
      if (hovering) {
        const detail = card.card || cardDataMap[card.code]
        if (detail) setHoveredCard(detail)
      }
    },
    [cardDataMap, setHoveredCard]
  )

  const handleHold = useCallback(
    (card: FieldCard, point: { x: number; y: number }): void => {
      if (!hostCard) return
      const index = materialCards.findIndex((c) => c.instanceId === card.instanceId)
      if (index < 0) return
      useHeldCardStore.getState().holdMaterial(hostCard.instanceId, index, point)
      closeOverlayList()
    },
    [hostCard, materialCards, closeOverlayList]
  )

  const handleRemoveCard = useCallback(
    (card: FieldCard): void => {
      if (!hostCard) return
      const index = materialCards.findIndex((c) => c.instanceId === card.instanceId)
      if (index < 0) return
      removeOverlayMaterial(hostCard.instanceId, index)
    },
    [hostCard, materialCards, removeOverlayMaterial]
  )

  useEffect(() => {
    return () => {
      setHoveredInstanceId(null)
    }
  }, [setHoveredInstanceId])

  if (!hostInstanceId || !hostCard) return null

  const hostName = cardDataMap[hostCard.code]?.name || resolveCardName(hostCard.code)

  const isExternalDrop = (e: React.DragEvent): boolean =>
    e.dataTransfer.types.includes('application/json') ||
    e.dataTransfer.types.includes('text/instanceid')

  const handleDropNewMaterial = (e: React.DragEvent): void => {
    e.preventDefault()
    e.stopPropagation()
    if (isEngineActive) return
    try {
      const movedInstanceId = e.dataTransfer.getData('text/instanceId')
      if (movedInstanceId) {
        const movedCard = state.cards.find((c) => c.instanceId === movedInstanceId)
        if (movedCard) {
          useDuelStore.getState().removeCard(movedInstanceId)
          useDuelStore
            .getState()
            .addOverlayMaterial(hostCard.instanceId, movedCard.code, movedInstanceId)
        }
      } else {
        const dataStr = e.dataTransfer.getData('application/json')
        if (dataStr) {
          const droppedCard = JSON.parse(dataStr) as CdbCard
          useDuelStore.getState().addOverlayMaterial(hostCard.instanceId, droppedCard.id)
        }
      }
    } catch (err) {
      console.error('[OverlayListModal] Drop material failed:', err)
    }
  }

  return (
    <div
      className="absolute inset-0 z-40 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 select-none animate-in fade-in"
      onClick={closeOverlayList}
    >
      <div
        className="bg-popover text-popover-foreground border border-border rounded-lg shadow-2xl w-full max-w-6xl max-h-[92%] flex flex-col overflow-hidden animate-in zoom-in-95 duration-100"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-4 py-3 border-b border-border bg-muted/30 shrink-0">
          <div className="flex items-center gap-2">
            <h2 className="font-bold text-sm tracking-tight flex items-center gap-1.5">
              <span>超量素材 — {hostName}</span>
              <Badge variant="secondary" className="font-mono text-xs px-1.5 py-0 h-5">
                {materials.length}
              </Badge>
            </h2>
            {isEngineActive && (
              <span className="text-[11px] text-muted-foreground">引擎校验中，素材仅供查看</span>
            )}
          </div>

          <div className="flex items-center gap-3">
            {materials.length > 3 && (
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
              onClick={closeOverlayList}
              className="text-muted-foreground hover:text-foreground p-1 rounded-md hover:bg-muted transition-colors cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        <div
          onDragOver={(e) => {
            if (isEngineActive) return
            if (!isExternalDrop(e)) return
            e.preventDefault()
            e.stopPropagation()
            e.dataTransfer.dropEffect = 'copy'
          }}
          onDrop={(e) => {
            if (isEngineActive) return
            if (!isExternalDrop(e)) return
            handleDropNewMaterial(e)
          }}
          className="relative flex-1 min-h-[300px] max-h-[66vh] overflow-y-auto overflow-x-hidden p-4 bg-muted/10"
        >
          {filteredCards.length === 0 ? (
            <div className="h-full min-h-[260px] w-full flex flex-col items-center justify-center text-muted-foreground py-16 text-xs gap-2 border-2 border-dashed border-border/40 rounded-lg">
              <Layers className="w-10 h-10 opacity-30 stroke-[1.5]" />
              <p>
                {searchQuery
                  ? '未找到符合条件的卡片'
                  : '当前怪兽暂无超量素材（可从右侧搜索栏拖入卡片）'}
              </p>
            </div>
          ) : (
            <PileCardGrid
              cards={filteredCards}
              dragEnabled={dragEnabled}
              location={hostCard.location}
              holdEnabled={!isEngineActive}
              actionsDisabled={isEngineActive}
              onSelect={handleSelect}
              onHoverChange={handleHoverChange}
              onHold={handleHold}
              onRemove={handleRemoveCard}
              onReorder={(fromIndex, toIndex) => {
                reorderOverlayMaterials(hostCard.instanceId, fromIndex, toIndex)
              }}
            />
          )}
        </div>

        <div className="flex items-center justify-end px-4 py-2.5 border-t border-border bg-muted/20 shrink-0">
          <Button size="sm" onClick={closeOverlayList} className="px-5 h-7 text-xs">
            确定
          </Button>
        </div>
      </div>
    </div>
  )
}
