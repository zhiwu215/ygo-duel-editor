import { Tooltip, TooltipTrigger, TooltipContent } from '../ui/tooltip'
import React, { useMemo } from 'react'
import { motion } from 'framer-motion'
import { FieldCard, CardPosition, CardLocation, CardUtils } from '@shared/index'
import { setCardDragImage } from '../../utils/cardImage'
import { resolveCardName } from '../../utils/cardNames'
import { useDuelStore } from '../../stores/useDuelStore'
import { useContextMenuStore } from '../../stores/useContextMenuStore'
import { useOverlayListStore } from '../../stores/useOverlayListStore'
import { usePileListStore } from '../../stores/usePileListStore'
import { CardHudOverlay } from './components/CardHudOverlay'
import { CardFieldStats } from './components/CardFieldStats'
import { OverlayMaterialStack } from './components/OverlayMaterialStack'
import { useCardCommandMenuStore } from '../../stores/useCardCommandMenuStore'
import { useDuelEngineStore } from '../../stores/useDuelEngineStore'
import { useStagingStore } from '../../stores/useStagingStore'
import { useSelectionStore } from '../../stores/useSelectionStore'
import { useAttackTargetingStore } from '../../stores/useAttackTargetingStore'
import { isFaceupMonster } from '../../utils/battleDamage'
import { hasCardEngineActions } from '../../utils/engineActions'
import {
  resolveCardSelectionMatch,
  resolveCardRole,
  type CardSelectionMatch
} from '../../utils/duelSelection'
import { useCardPointerActions } from '../../hooks/useCardPointerActions'
import { useFieldCardCdb } from '../../hooks/useFieldCardCdb'
import { CardImage } from '../ui/CardImage'
import { getCardBack } from '../../utils/cardImage'
import { cn } from '../../lib/utils'

export const HAND_REORDER_DRAG_TYPE = 'application/x-ygo-hand-reorder'

interface CardItemProps {
  card: FieldCard
  squareCell?: boolean
}

export const CardItem: React.FC<CardItemProps> = ({ card, squareCell = false }) => {
  const { selectedCardId, setSelectedCardId, setHoveredCard, setHoveredInstanceId } = useDuelStore()
  const tacticalView = useDuelStore((s) => s.tacticalView)
  const isEngineActive = useDuelEngineStore((s) => s.isInitialized)
  const stagingActive = useStagingStore((s) => s.session !== null)
  const canDrag = !isEngineActive || stagingActive
  const pendingRequest = useDuelEngineStore((s) => s.pendingRequest)
  const selectedKeys = useSelectionStore((s) => s.selectedKeys)

  const hasRequestActions = useMemo(
    () => hasCardEngineActions(pendingRequest, card),
    [pendingRequest, card]
  )

  const selectionMatch = useMemo<CardSelectionMatch | null>(
    () => resolveCardSelectionMatch(pendingRequest, card, selectedKeys),
    [pendingRequest, card, selectedKeys]
  )

  const editorTargetActive = useAttackTargetingStore((s) =>
    s.attacker &&
    s.attacker.instanceId !== card.instanceId &&
    card.controller !== s.attacker.controller &&
    isFaceupMonster(card)
      ? 'target'
      : null
  )

  const role = useMemo(
    () => editorTargetActive ?? resolveCardRole(selectionMatch),
    [editorTargetActive, selectionMatch]
  )

  const handleCardClick = useCardPointerActions({
    card,
    role,
    selectionMatch
  })

  useFieldCardCdb(card)

  const { openMenu } = useContextMenuStore()
  const openOverlayList = useOverlayListStore((s) => s.openOverlayList)
  const openPile = usePileListStore((s) => s.openPile)
  const { closeMenu: closeCommandMenu } = useCardCommandMenuStore()

  const isSelected = selectedCardId === card.instanceId
  const isDefense =
    card.position === CardPosition.FACEUP_DEFENSE || card.position === CardPosition.FACEDOWN_DEFENSE
  const isFacedown =
    card.position === CardPosition.FACEDOWN || card.position === CardPosition.FACEDOWN_DEFENSE

  const isXyzMonster = card.card ? CardUtils.isXyz(card.card.type) : false
  const materialCount = card.overlayMaterials?.length || 0
  const isMonsterZone = card.location === CardLocation.MZONE
  const showOverlayBadge = isMonsterZone && (isXyzMonster || materialCount > 0)

  const isMonster = card.card
    ? CardUtils.isMonster(card.card.type)
    : card.location === CardLocation.MZONE

  const hasCounters = !!(card.counters && Object.values(card.counters).some((v) => v > 0))

  const isFieldZone =
    card.location === CardLocation.MZONE ||
    card.location === CardLocation.SZONE ||
    card.location === CardLocation.FZONE ||
    card.location === CardLocation.PZONE

  const showHud = tacticalView && isFieldZone && (isMonster || hasCounters)
  const showFieldStats = isMonster && card.location === CardLocation.MZONE

  const isHand = card.location === CardLocation.HAND
  const isPileZone =
    card.location === CardLocation.DECK ||
    card.location === CardLocation.EXTRA ||
    card.location === CardLocation.GRAVE ||
    card.location === CardLocation.REMOVED
  const isDeckPile = card.location === CardLocation.DECK || card.location === CardLocation.EXTRA
  const isPileFacedown = isFacedown && isDeckPile
  const isSetOnField = isFacedown && !isDeckPile && !isHand
  const showFacedownVeil = isSetOnField || isPileFacedown
  const isPublicHand = isHand && card.position === CardPosition.FACEUP

  const badgePos = squareCell
    ? isDefense
      ? { top: 18, left: 3 }
      : { top: 3, left: 18 }
    : { top: 3, left: 3 }

  const oruPos = squareCell
    ? isDefense
      ? { bottom: 18, right: 3 }
      : { bottom: 20, right: 18 }
    : { bottom: 3, right: 3 }

  return (
    <div
      draggable={canDrag}
      onDragStart={(e) => {
        if (!canDrag) {
          e.preventDefault()
          return
        }
        if (card.location === CardLocation.HAND) {
          e.dataTransfer.setData(HAND_REORDER_DRAG_TYPE, card.instanceId)
          setCardDragImage(e.dataTransfer, e.currentTarget)
        }
        e.dataTransfer.setData('text/instanceId', card.instanceId)
        if (card.card) {
          e.dataTransfer.setData('application/json', JSON.stringify(card.card))
        }
        e.dataTransfer.effectAllowed = 'copyMove'
      }}
      onClick={handleCardClick}
      onDoubleClick={(e) => {
        e.stopPropagation()
        closeCommandMenu()
        if (showOverlayBadge) {
          openOverlayList(card.instanceId)
        } else if (isPileZone) {
          openPile(card.controller, card.location)
        }
      }}
      onMouseEnter={() => {
        setHoveredInstanceId(card.instanceId)
      }}
      onMouseLeave={() => {
        if (useDuelStore.getState().hoveredInstanceId === card.instanceId) {
          setHoveredInstanceId(null)
        }
      }}
      onContextMenu={(e) => {
        e.preventDefault()
        e.stopPropagation()
        closeCommandMenu()
        setSelectedCardId(card.instanceId)
        if (card.card) setHoveredCard(card.card)
        openMenu(card, e.clientX, e.clientY)
      }}
      title={
        showOverlayBadge
          ? `双击查看超量素材列表 (当前 ${materialCount} 张)`
          : isPileZone
            ? '双击查看卡片列表'
            : undefined
      }
      className={cn(
        'w-full h-full relative flex items-center justify-center cursor-grab active:cursor-grabbing group select-none',
        role === 'dim' && 'opacity-25',
        (role === 'legal' || role === 'target') && 'cursor-crosshair'
      )}
    >
      <div
        className={`relative ${
          squareCell ? 'w-[68.6%] h-full' : isDefense ? 'w-[68.6%] h-[71%]' : 'w-full h-full'
        }`}
      >
        <OverlayMaterialStack card={card} />

        <motion.div
          initial={false}
          animate={{
            rotate: isDefense ? 90 : 0,
            z: isSelected ? 20 : role === 'legal' || role === 'target' ? 10 : 0,
            scale: isSelected ? 1.04 : 1
          }}
          transition={{ type: 'spring', stiffness: 320, damping: 26 }}
          className={`relative w-full h-full rounded shadow-md ${
            role === 'source'
              ? 'ring-2 ring-amber-400 ring-offset-1 ring-offset-background'
              : role === 'target'
                ? 'ring-2 ring-rose-500 ring-offset-1 ring-offset-background shadow-[0_0_14px_rgba(244,63,94,0.65)]'
                : role === 'chosen'
                  ? 'ring-2 ring-rose-500 ring-offset-1 ring-offset-background'
                  : role === 'legal'
                    ? 'ring-2 ring-emerald-400/80 ring-offset-1 ring-offset-background shadow-[0_0_12px_rgba(52,211,153,0.4)]'
                    : isSelected
                      ? 'ring-2 ring-blue-400 ring-offset-1 ring-offset-background shadow-[0_4px_16px_rgba(96,165,250,0.3)]'
                      : hasRequestActions
                        ? 'ring-2 ring-yellow-400/90 ring-offset-1 ring-offset-background shadow-[0_0_10px_rgba(250,204,21,0.45)]'
                        : 'group-hover:ring-1 group-hover:ring-blue-400/50'
          }`}
          style={{ zIndex: (card.overlayMaterials?.length || 0) + 2 }}
        >
          <div className="absolute inset-0 rounded overflow-hidden">
            <CardImage
              code={card.code}
              small
              alt={resolveCardName(card.code)}
              fallback={getCardBack(card.controller)}
              className="w-full h-full object-cover select-none pointer-events-none"
            />
            {showFacedownVeil && (
              <div className="absolute inset-0 bg-black/30 border border-amber-400/50 rounded pointer-events-none" />
            )}
          </div>
        </motion.div>
      </div>

      {(isSetOnField || isPublicHand) && (
        <motion.div
          initial={false}
          animate={{ top: badgePos.top, left: badgePos.left }}
          transition={{ type: 'spring', stiffness: 300, damping: 25 }}
          className="absolute z-20 pointer-events-none"
        >
          <div className="bg-black/90 text-amber-300 font-sans text-[8px] font-bold px-1.5 py-0.5 rounded-full border border-amber-400/50 shadow-md flex items-center gap-1 select-none whitespace-nowrap">
            <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse" />
            <span>{isSetOnField ? '盖放' : '公开'}</span>
          </div>
        </motion.div>
      )}

      {card.location === CardLocation.EXTRA && !isFacedown && (
        <motion.div
          initial={false}
          animate={{ top: badgePos.top, left: badgePos.left }}
          transition={{ type: 'spring', stiffness: 300, damping: 25 }}
          className="absolute z-20 pointer-events-none"
        >
          <div className="bg-cyan-600/90 text-white font-sans text-[8px] font-bold px-1.5 py-0.5 rounded-full border border-cyan-400/50 shadow-md select-none">
            表侧
          </div>
        </motion.div>
      )}

      {showOverlayBadge && (
        <Tooltip>
          <TooltipTrigger
            render={
              <motion.div
                initial={false}
                animate={{ bottom: oruPos.bottom, right: oruPos.right }}
                transition={{ type: 'spring', stiffness: 300, damping: 25 }}
                className="absolute z-20 pointer-events-auto cursor-pointer group/oru"
                onClick={(e) => {
                  e.stopPropagation()
                  openOverlayList(card.instanceId)
                }}
              >
                <div
                  className={cn(
                    'font-mono text-[9px] font-bold px-1.5 py-0.5 rounded-full border shadow-md flex items-center gap-1 select-none whitespace-nowrap transition-transform group-hover/oru:scale-110 active:scale-95',
                    materialCount > 0
                      ? 'bg-black/90 group-hover/oru:bg-black text-amber-400 border-amber-400/50 group-hover/oru:border-amber-300'
                      : 'bg-black/85 group-hover/oru:bg-black text-amber-400/80 border-amber-400/40 group-hover/oru:border-amber-300/80'
                  )}
                >
                  <span
                    className={cn(
                      'w-1.5 h-1.5 rounded-full bg-amber-400 inline-block',
                      materialCount > 0 ? 'animate-pulse' : 'opacity-70'
                    )}
                  />
                  <span>{materialCount}</span>
                </div>
              </motion.div>
            }
          />
          <TooltipContent>{`点击查看超量素材列表 (当前 ${materialCount} 张)`}</TooltipContent>
        </Tooltip>
      )}

      {showFieldStats && <CardFieldStats card={card} />}

      {showHud && <CardHudOverlay card={card} />}
    </div>
  )
}
