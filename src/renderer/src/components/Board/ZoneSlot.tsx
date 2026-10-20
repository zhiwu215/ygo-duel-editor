import React, { memo, useState } from 'react'
import { FieldCard, CdbCard, CardLocation, CardPosition, CardUtils } from '@shared/index'
import { useDuelStore } from '../../stores/useDuelStore'
import { useDropHintStore } from '../../stores/useDropHintStore'
import { usePileListStore } from '../../stores/usePileListStore'
import { useOverlayListStore } from '../../stores/useOverlayListStore'
import { useContextMenuStore } from '../../stores/useContextMenuStore'
import { useTokenStore } from '../../stores/useTokenStore'
import { useDuelEngineStore } from '../../stores/useDuelEngineStore'
import { useStagingStore } from '../../stores/useStagingStore'
import { useHeldCardPlacement } from '../../hooks/useHeldCardPlacement'
import { CardItem, HAND_REORDER_DRAG_TYPE } from './CardItem'
import { DropHintPopover } from './components/DropHintPopover'
import { useDeckZoneInteraction } from '../../hooks/useDeckZoneInteraction'
import { getDropPosOverride } from '../../utils/zoneDrop'
import { buildInjectCommand } from '../../utils/engineInject'
import { Swords, Sparkles, Hexagon, Globe, Ghost, Layers, ShieldAlert, Ban } from 'lucide-react'
import { cn } from '../../lib/utils'

export type ZoneColorVariant =
  | 'monster'
  | 'spell'
  | 'emz'
  | 'field'
  | 'grave'
  | 'deck'
  | 'extra'
  | 'removed'
  | 'special'
  | 'pendulum-blue'
  | 'pendulum-red'

interface ZoneSlotProps {
  label: string
  controller: 0 | 1
  location: number
  sequence: number
  card?: FieldCard
  count?: number
  isPendulum?: boolean
  pendulumDirection?: 'left' | 'right'
  colorVariant?: ZoneColorVariant
  className?: string
  duelistId?: string
}

interface VariantConfig {
  border: string
  bg: string
  shadow: string
  text: string
  icon: React.ComponentType<{ className?: string }>
}

const NEUTRAL_BASE = {
  border: 'border-neutral-300/90 dark:border-neutral-700/80 hover:border-blue-400/80',
  bg: 'bg-neutral-100/75 dark:bg-white/[0.05]',
  shadow: 'shadow-2xs',
  text: 'text-muted-foreground/90'
}

const EMZ_BASE = {
  border: 'border-blue-500/50 border-dashed hover:border-blue-500/90',
  bg: 'bg-blue-500/[0.08] dark:bg-cyan-400/[0.08]',
  shadow: 'shadow-[0_0_10px_rgba(59,130,246,0.12)]',
  text: 'text-blue-600 dark:text-cyan-200'
}

const VARIANT_CONFIGS: Record<ZoneColorVariant, VariantConfig> = {
  monster: { ...NEUTRAL_BASE, icon: Swords },
  spell: { ...NEUTRAL_BASE, icon: Sparkles },
  emz: { ...EMZ_BASE, icon: Hexagon },
  field: { ...NEUTRAL_BASE, icon: Globe },
  grave: { ...NEUTRAL_BASE, icon: Ghost },
  deck: { ...NEUTRAL_BASE, icon: Layers },
  extra: { ...NEUTRAL_BASE, icon: Layers },
  removed: { ...NEUTRAL_BASE, icon: Ban },
  special: { ...NEUTRAL_BASE, icon: ShieldAlert },
  'pendulum-blue': { ...NEUTRAL_BASE, icon: ShieldAlert },
  'pendulum-red': { ...NEUTRAL_BASE, icon: ShieldAlert }
}

export const ZoneSlot: React.FC<ZoneSlotProps> = ({
  label,
  controller,
  location,
  sequence,
  card,
  count,
  isPendulum,
  pendulumDirection,
  colorVariant = 'monster',
  className = '',
  duelistId
}) => {
  const { addCardToZone, setSelectedCardId, moveCard, overlayDropOnto } = useDuelStore()
  const hintZone = useDropHintStore((s) => s.zone)
  const showHint = useDropHintStore((s) => s.show)
  const openPile = usePileListStore((s) => s.openPile)
  const openOverlayList = useOverlayListStore((s) => s.openOverlayList)
  const openZoneMenu = useContextMenuStore((s) => s.openZoneMenu)
  const pendingToken = useTokenStore((s) => s.pendingToken)
  const cancelPendingToken = useTokenStore((s) => s.cancelPending)
  const { heldCardInstanceId, placeHeldCard } = useHeldCardPlacement()
  const [isOver, setIsOver] = useState(false)
  const { cancelDeckDraw, scheduleDeckDraw } = useDeckZoneInteraction(controller)

  const isPileZone =
    location === CardLocation.EXTRA ||
    location === CardLocation.DECK ||
    location === CardLocation.GRAVE ||
    location === CardLocation.REMOVED

  const isHintTarget =
    hintZone !== null &&
    hintZone.controller === controller &&
    hintZone.location === location &&
    hintZone.sequence === sequence

  const isTokenDropTarget =
    pendingToken !== null && location === CardLocation.MZONE && !card && sequence <= 4

  const pendingRequest = useDuelEngineStore((s) => s.pendingRequest)
  const isEngineActive = useDuelEngineStore((s) => s.isInitialized)
  const stagingActive = useStagingStore((s) => s.session !== null)
  const canEditLocally = !isEngineActive || stagingActive
  const masterRule = useDuelStore((s) => s.state.masterRule)
  const enginePlaceMatch =
    pendingRequest !== null &&
    (pendingRequest.data.kind === 'place' || pendingRequest.data.kind === 'disfield')
      ? pendingRequest.data.places.find(
          (p) => p.controller === controller && p.location === location && p.sequence === sequence
        )
      : undefined
  const isEnginePlaceTarget = Boolean(enginePlaceMatch)

  const handlePlacementClick = (): boolean => {
    if (enginePlaceMatch) {
      void useDuelEngineStore.getState().submitAnswer({ kind: 'place', places: [enginePlaceMatch] })
      return true
    }
    return false
  }

  const handleTokenDrop = (): boolean => {
    if (!pendingToken || !isTokenDropTarget) return false
    addCardToZone(
      pendingToken,
      controller,
      location,
      sequence,
      CardPosition.FACEUP_ATTACK,
      duelistId
    )
    cancelPendingToken()
    return true
  }

  const placeHeldCardOnSlot = (e: React.MouseEvent): boolean => {
    if (!heldCardInstanceId) return false
    const toSequence = isPileZone
      ? location === CardLocation.DECK || location === CardLocation.EXTRA
        ? 0
        : (count ?? 0)
      : sequence
    return placeHeldCard(e, {
      controller,
      location,
      sequence: toSequence,
      duelistId: duelistId || card?.duelistId
    })
  }

  const handleDragOver = (e: React.DragEvent): void => {
    e.preventDefault()
    const isHandReorder = e.dataTransfer.types.includes(HAND_REORDER_DRAG_TYPE)
    e.dataTransfer.dropEffect = e.dataTransfer.types.includes('text/instanceId') ? 'move' : 'copy'
    if (isHandReorder && location === CardLocation.HAND) {
      setIsOver(false)
      return
    }
    if (!isOver) setIsOver(true)
  }

  const handleDragLeave = (e: React.DragEvent): void => {
    if (e.currentTarget.contains(e.relatedTarget as Node)) return
    setIsOver(false)
  }

  const handleDrop = (e: React.DragEvent): void => {
    e.preventDefault()
    if (location === CardLocation.HAND && e.dataTransfer.types.includes(HAND_REORDER_DRAG_TYPE)) {
      return
    }
    e.stopPropagation()
    setIsOver(false)
    const posOverride = getDropPosOverride(location, e.ctrlKey)
    try {
      const movedInstanceId = e.dataTransfer.getData('text/instanceId')

      if (!isEngineActive && card && location === CardLocation.MZONE && e.altKey) {
        if (movedInstanceId && movedInstanceId === card.instanceId) {
          return
        }

        let incomingCard: CdbCard | null = null
        let incomingSourceId: string | null = null

        if (movedInstanceId) {
          const movedCard = useDuelStore
            .getState()
            .state.cards.find((c) => c.instanceId === movedInstanceId)
          if (movedCard) {
            incomingSourceId = movedInstanceId
            incomingCard = movedCard.card ?? null
          }
        }

        if (!incomingCard) {
          const dataStr = e.dataTransfer.getData('application/json')
          if (dataStr) {
            incomingCard = JSON.parse(dataStr) as CdbCard
          }
        }

        if (incomingCard) {
          overlayDropOnto(card.instanceId, incomingCard, incomingSourceId)
          return
        }
      }
      if (!movedInstanceId && !canEditLocally) {
        const dataStr = e.dataTransfer.getData('application/json')
        if (!dataStr) return
        const droppedCard = JSON.parse(dataStr) as CdbCard
        const isFieldSlot =
          location === CardLocation.MZONE ||
          location === CardLocation.SZONE ||
          location === CardLocation.PZONE ||
          location === CardLocation.FZONE
        if (isFieldSlot && card) {
          useDuelEngineStore.setState({ error: '该格已有卡片，请拖到空位。' })
          return
        }
        const command = buildInjectCommand({
          card: droppedCard,
          controller,
          location,
          sequence,
          ctrlKey: e.ctrlKey,
          masterRule
        })
        if (command) void useDuelEngineStore.getState().inject(command)
        return
      }
      if (movedInstanceId) {
        const targetRect = e.currentTarget.getBoundingClientRect()
        const insertAfterTarget =
          location === CardLocation.HAND &&
          Boolean(card) &&
          e.clientX >= targetRect.left + targetRect.width / 2
        moveCard(
          movedInstanceId,
          location,
          sequence + (insertAfterTarget ? 1 : 0),
          controller,
          posOverride,
          duelistId || card?.duelistId
        )
      } else {
        const dataStr = e.dataTransfer.getData('application/json')
        if (!dataStr) return
        const droppedCard = JSON.parse(dataStr) as CdbCard
        addCardToZone(
          droppedCard,
          controller,
          location,
          sequence,
          posOverride,
          duelistId || card?.duelistId
        )
      }

      if (location === CardLocation.MZONE || location === CardLocation.SZONE) {
        showHint({ controller, location, sequence })
      }
    } catch (err) {
      console.error('[ZoneSlot] Drop failed:', err)
    }
  }

  const isFromZoneBadge = (e: React.MouseEvent): boolean =>
    Boolean((e.target as Element | null)?.closest?.('[data-zone-badge]'))

  const config = VARIANT_CONFIGS[colorVariant] || VARIANT_CONFIGS.monster
  const IconComponent = config.icon

  const isSquareCell =
    location === CardLocation.MZONE ||
    location === CardLocation.SZONE ||
    location === CardLocation.PZONE

  const pendulumMark = isPendulum
    ? pendulumDirection === 'left'
      ? '◀ P'
      : pendulumDirection === 'right'
        ? 'P ▶'
        : 'P'
    : null
  const pendulumMarkClass =
    colorVariant === 'pendulum-red'
      ? 'bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/30'
      : colorVariant === 'pendulum-blue'
        ? 'bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/30'
        : 'bg-muted text-muted-foreground border-border'

  return (
    <div
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      onClickCapture={(e) => {
        if (placeHeldCardOnSlot(e)) return
        if (location !== CardLocation.DECK) return
        if (!canEditLocally) return
        if (isFromZoneBadge(e)) return
        scheduleDeckDraw()
      }}
      onClick={() => {
        if (location === CardLocation.DECK) return
        if (handlePlacementClick()) return
        if (handleTokenDrop()) return
        if (!card) setSelectedCardId(null)
      }}
      onDoubleClickCapture={(e) => {
        if (location !== CardLocation.DECK) return
        if (isFromZoneBadge(e)) return
        cancelDeckDraw()
        openPile(controller, location)
      }}
      onDoubleClick={() => {
        if (location === CardLocation.DECK) return
        const isXyz = card?.card ? CardUtils.isXyz(card.card.type) : false
        const hasMats = card?.overlayMaterials && card.overlayMaterials.length > 0
        if (card && (isXyz || hasMats)) {
          openOverlayList(card.instanceId)
        } else if (isPileZone && count !== undefined && count > 0) {
          openPile(controller, location)
        }
      }}
      onContextMenuCapture={(e) => {
        if (location !== CardLocation.DECK || card) return
        e.preventDefault()
        e.stopPropagation()
        openZoneMenu(controller, location, e.clientX, e.clientY)
      }}
      className={`group relative ${
        isSquareCell ? 'w-[92px] h-[92px]' : 'w-[64px] h-[92px]'
      } rounded border ${config.border} ${config.bg} ${config.shadow} flex flex-col items-center justify-center transition-all duration-150 select-none shrink-0 ${
        isOver ? 'ring-2 ring-blue-400 bg-blue-500/15 scale-[1.03] border-transparent' : ''
      } ${
        isTokenDropTarget
          ? 'ring-2 ring-emerald-400/80 bg-emerald-500/10 border-emerald-400/60 cursor-copy animate-pulse'
          : ''
      } ${
        isEnginePlaceTarget
          ? 'ring-2 ring-amber-400 bg-amber-500/10 border-amber-400/60 cursor-pointer animate-pulse'
          : ''
      } ${
        heldCardInstanceId ? 'cursor-pointer hover:ring-2 hover:ring-primary/70' : ''
      } ${className}`}
      title={
        isTokenDropTarget
          ? `点击放下「${pendingToken.name}」`
          : heldCardInstanceId
            ? '点击将手上的卡片放到这里'
            : location === CardLocation.DECK
              ? isEngineActive
                ? '双击展开卡组列表'
                : '单击抽 1 张 · 双击展开卡组列表 · 右键切换卡组'
              : card &&
                  ((card.card ? CardUtils.isXyz(card.card.type) : false) ||
                    (card.overlayMaterials && card.overlayMaterials.length > 0))
                ? `双击查看超量素材列表 (当前 ${card.overlayMaterials?.length || 0} 张)`
                : isPileZone && count !== undefined && count > 0
                  ? '双击直接查看列表'
                  : undefined
      }
    >
      {count !== undefined && count > 0 && (
        <button
          type="button"
          data-zone-badge=""
          onClick={(e) => {
            if (isPileZone) {
              e.stopPropagation()
              openPile(controller, location)
            }
          }}
          className={cn(
            'absolute top-1.5 right-1.5 z-20 px-1.5 py-0.5 rounded-full bg-black/80 border border-white/25 text-[9px] font-mono font-bold text-white leading-none shadow-sm transition-all',
            isPileZone
              ? 'hover:bg-blue-600 hover:scale-110 cursor-pointer pointer-events-auto'
              : 'pointer-events-none'
          )}
          title={
            isPileZone
              ? location === CardLocation.DECK
                ? '点击展开卡组列表 (或双击格子)'
                : '点击查看列表 (或双击格子)'
              : undefined
          }
        >
          {count}
        </button>
      )}

      {isHintTarget && card && <DropHintPopover card={card} location={location} />}

      {card ? (
        <CardItem key={card.instanceId} card={card} squareCell={isSquareCell} />
      ) : (
        <div className="flex flex-col items-center justify-center p-1.5 text-center pointer-events-none relative z-10 w-full">
          {!isPendulum && (
            <div className="mb-1 opacity-30 group-hover:opacity-50 transition-opacity">
              <IconComponent className="w-5 h-5 stroke-[1.5] text-foreground" />
            </div>
          )}

          <span
            className={`text-[10px] font-mono tracking-tight font-medium ${config.text} leading-tight`}
          >
            {label}
          </span>

          {pendulumMark && (
            <span
              className={cn(
                'mt-1 text-[9px] px-1 py-0.5 rounded border font-bold',
                pendulumMarkClass
              )}
            >
              {pendulumMark}
            </span>
          )}
        </div>
      )}
    </div>
  )
}

export const MemoZoneSlot = memo(ZoneSlot)
