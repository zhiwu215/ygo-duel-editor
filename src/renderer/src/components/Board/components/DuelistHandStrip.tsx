import React, { useRef } from 'react'
import { motion } from 'framer-motion'
import { Plus } from 'lucide-react'
import { CardLocation, Duelist, FieldCard } from '@shared/index'
import { useDuelStore } from '../../../stores/useDuelStore'
import { MemoZoneSlot } from '../ZoneSlot'
import { TurnOrderBadge } from './TurnOrderBadge'
import { LpInput } from './LpInput'
import { HandShuffleOverlay } from './HandShuffleOverlay'
import { cn } from '../../../lib/utils'
import { HAND_REORDER_DRAG_TYPE } from '../CardItem'
import { DuelistHandStripCollapsed } from './DuelistHandStripCollapsed'
import { useHandReorderDrag } from '../../../hooks/useHandReorderDrag'
import { useHeldCardPlacement } from '../../../hooks/useHeldCardPlacement'
import { useHorizontalWheelScroll } from '../../../hooks/useHorizontalWheelScroll'
import { useLpCommit } from '../../../hooks/useLpCommit'

interface DuelistHandStripProps {
  duelist: Duelist
  controller: 0 | 1
  cards: FieldCard[]
  totalCount?: number
  isExpanded: boolean
  isCollapsed: boolean
  crowded: boolean
  shuffleTick: number
  shuffleActive: boolean
  ref?: React.Ref<HTMLDivElement>
  onExpand: () => void
  onCollapse: () => void
}

function mergeRefs<T>(...refs: Array<React.Ref<T> | undefined>): React.RefCallback<T> {
  return (node: T | null): void => {
    for (const ref of refs) {
      if (typeof ref === 'function') ref(node)
      else if (ref) (ref as React.MutableRefObject<T | null>).current = node
    }
  }
}

export const DuelistHandStrip: React.FC<DuelistHandStripProps> = ({
  duelist,
  controller,
  cards,
  totalCount = 2,
  isExpanded,
  isCollapsed,
  crowded,
  shuffleTick,
  shuffleActive,
  ref,
  onExpand,
  onCollapse
}) => {
  const updateDuelist = useDuelStore((s) => s.updateDuelist)
  const isSharedLp = Boolean(useDuelStore((s) => s.state.matchConfig?.sharedLp))
  const isActiveViewer = useDuelStore((s) => s.activeDuelistId === duelist.id)
  const setActiveDuelistId = useDuelStore((s) => s.setActiveDuelistId)

  const isOpponent = controller === 1

  const focusAsViewer = (): void => {
    if (!isActiveViewer) setActiveDuelistId(duelist.id)
  }

  const hoverExpandTimerRef = useRef<NodeJS.Timeout | null>(null)

  const {
    isDragOver,
    draggedHandCardId,
    handInsertionPosition,
    hitAreaRef: stripRef,
    scrollContainerRef,
    captureHandLayout,
    updateHandInsertionPosition,
    setIsDragOver,
    handleDragStartCapture,
    handleDragOver,
    handleDrop
  } = useHandReorderDrag({
    cards,
    controller,
    duelistId: duelist.id,
    isOwnedHandCard: (movingCard) => {
      const fallbackDuelistId =
        useDuelStore.getState().state.duelists?.find((item) => item.team === controller)?.id ??
        `duelist_${controller}_0`
      return (movingCard.duelistId ?? fallbackDuelistId) === duelist.id
    },
    onDragStartCapture: focusAsViewer,
    canCaptureLayout: () => !isCollapsed,
    onGlobalReset: () => {
      if (hoverExpandTimerRef.current) {
        clearTimeout(hoverExpandTimerRef.current)
        hoverExpandTimerRef.current = null
      }
    },
    onDropAdopted: () => {
      focusAsViewer()
      if (hoverExpandTimerRef.current) {
        clearTimeout(hoverExpandTimerRef.current)
        hoverExpandTimerRef.current = null
      }
    },
    dropLogTag: 'DuelistHandStrip'
  })

  useHorizontalWheelScroll(stripRef, {
    scrollRef: scrollContainerRef,
    skipWhenNoOverflow: true,
    stopPropagationAtEdges: true,
    canHandle: () => !(crowded && !isExpanded)
  })

  const commitLp = useLpCommit()

  const { placeHeldCard } = useHeldCardPlacement()

  const handlePlaceHeldCard = (e: React.MouseEvent): void => {
    placeHeldCard(e, {
      controller,
      location: CardLocation.HAND,
      sequence: cards.length,
      duelistId: duelist.id
    })
  }

  const handleDragEnter = (e: React.DragEvent): void => {
    const isHandReorder = e.dataTransfer.types.includes(HAND_REORDER_DRAG_TYPE)
    setIsDragOver(!isHandReorder)
    if (isHandReorder) captureHandLayout()
    if (isCollapsed) {
      if (hoverExpandTimerRef.current) clearTimeout(hoverExpandTimerRef.current)
      hoverExpandTimerRef.current = setTimeout(() => {
        onExpand()
      }, 300)
    }
  }

  const handleDragLeave = (e: React.DragEvent<HTMLDivElement>): void => {
    if (e.currentTarget.contains(e.relatedTarget as Node)) return
    setIsDragOver(false)
    updateHandInsertionPosition(null)
    if (hoverExpandTimerRef.current) {
      clearTimeout(hoverExpandTimerRef.current)
      hoverExpandTimerRef.current = null
    }
  }

  const handleHeaderDoubleClick = (e: React.MouseEvent<HTMLDivElement>): void => {
    const target = e.target as HTMLElement | null
    if (target?.closest('input, select, textarea, button, a, [data-no-expand]')) return
    if (isExpanded) {
      onCollapse()
    } else {
      onExpand()
    }
  }

  if (isCollapsed) {
    return (
      <DuelistHandStripCollapsed
        duelist={duelist}
        cards={cards}
        isOpponent={isOpponent}
        isActiveViewer={isActiveViewer}
        isDragOver={isDragOver}
        ref={ref}
        onClick={(e) => {
          if (
            placeHeldCard(e, {
              controller,
              location: CardLocation.HAND,
              sequence: cards.length,
              duelistId: duelist.id
            })
          ) {
            return
          }
          focusAsViewer()
          onExpand()
        }}
        onDragEnter={handleDragEnter}
        onDragLeave={handleDragLeave}
        onDragOver={handleDragOver}
        onDrop={handleDrop}
      />
    )
  }

  return (
    <div
      ref={mergeRefs(ref, stripRef)}
      onDragEnter={(e) => {
        if (!e.dataTransfer.types.includes(HAND_REORDER_DRAG_TYPE)) setIsDragOver(true)
      }}
      onDragOver={handleDragOver}
      onDragLeave={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget as Node)) setIsDragOver(false)
      }}
      onDrop={handleDrop}
      className={cn(
        'flex-1 min-w-[180px] h-[136px] rounded border-2 flex flex-col p-1 transition-all gap-0.5 relative',
        isActiveViewer && 'ring-1 ring-primary/60',
        isExpanded
          ? isOpponent
            ? 'border-red-500/60 bg-red-500/5 shadow-sm'
            : 'border-blue-500/60 bg-blue-500/5 shadow-sm'
          : isOpponent
            ? 'border-red-500/20 bg-card/60 hover:border-red-500/40'
            : 'border-blue-500/20 bg-card/60 hover:border-blue-500/40',
        isDragOver &&
          (isOpponent
            ? 'border-red-500 ring-2 ring-red-500/30 bg-red-500/10'
            : 'border-blue-500 ring-2 ring-blue-500/30 bg-blue-500/10')
      )}
    >
      <div
        onDoubleClick={handleHeaderDoubleClick}
        onClick={(e) => {
          const target = e.target as HTMLElement | null
          if (target?.closest('input, select, textarea, button, a, [data-no-expand]')) return
          focusAsViewer()
        }}
        className="flex items-center justify-between text-xs px-0.5 shrink-0 gap-1 h-5 cursor-pointer"
      >
        <div className="flex items-center gap-1 min-w-0">
          <span className="text-[10px] text-muted-foreground shrink-0 font-mono">
            ({cards.length})
          </span>
        </div>

        <div className="flex items-center gap-1 shrink-0" data-no-expand>
          {!isSharedLp && (
            <LpInput
              lp={duelist.lp}
              label="LP"
              size="sm"
              player={controller}
              popoverPlacement="bottom"
              onLpChange={(newLp) =>
                commitLp(controller, newLp, (lp) => updateDuelist(duelist.id, { lp }))
              }
            />
          )}

          <TurnOrderBadge duelist={duelist} totalCount={totalCount || 2} />
        </div>
      </div>

      <div
        ref={scrollContainerRef}
        onClickCapture={focusAsViewer}
        onClick={handlePlaceHeldCard}
        onDragStartCapture={handleDragStartCapture}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        className={cn(
          'flex-1 w-full px-1 py-1 rounded border border-dashed flex items-center gap-1 overflow-x-auto overflow-y-hidden transition-colors cursor-pointer',
          crowded && !isExpanded && 'scrollbar-none',
          shuffleActive && 'ring-2 ring-amber-400/70 border-amber-400/60',
          isDragOver
            ? isOpponent
              ? 'border-red-500 ring-2 ring-red-500/20 bg-red-500/10'
              : 'border-blue-500 ring-2 ring-blue-500/20 bg-blue-500/10'
            : isOpponent
              ? 'border-red-500/20 hover:border-red-500/40 bg-muted/20 dark:bg-black/20'
              : 'border-blue-500/20 hover:border-blue-500/40 bg-muted/20 dark:bg-black/20'
        )}
      >
        {cards.map((c, idx) => {
          const isGapBefore =
            handInsertionPosition?.targetInstanceId === c.instanceId &&
            handInsertionPosition.side === 'before'
          const isGapAfter =
            handInsertionPosition?.targetInstanceId === c.instanceId &&
            handInsertionPosition.side === 'after'

          return (
            <React.Fragment key={c.instanceId}>
              {isGapBefore && <div aria-hidden="true" className="w-[64px] h-[92px] shrink-0" />}
              <motion.div
                layout="position"
                transition={{
                  layout: {
                    type: 'spring',
                    stiffness: 170,
                    damping: 25,
                    mass: 1
                  }
                }}
                className={cn(draggedHandCardId === c.instanceId ? 'hidden' : 'shrink-0')}
                data-hand-instance-id={c.instanceId}
              >
                <motion.div
                  key={shuffleTick}
                  initial={{ y: 0, rotate: 0 }}
                  animate={
                    shuffleTick > 0
                      ? { y: [0, -8, 0], rotate: [0, idx % 2 === 0 ? -2.5 : 2.5, 0] }
                      : { y: 0, rotate: 0 }
                  }
                  transition={{ duration: 0.5, delay: idx * 0.045, ease: 'easeInOut' }}
                >
                  <MemoZoneSlot
                    label={`${duelist.name} ${idx + 1}`}
                    controller={controller}
                    location={CardLocation.HAND}
                    sequence={c.sequence}
                    card={c}
                    duelistId={duelist.id}
                  />
                </motion.div>
              </motion.div>
              {isGapAfter && <div aria-hidden="true" className="w-[64px] h-[92px] shrink-0" />}
            </React.Fragment>
          )
        })}
        {cards.length === 0 && (
          <div
            className={cn(
              'w-full h-full flex items-center justify-center pointer-events-none select-none',
              isOpponent ? 'text-red-500/40' : 'text-blue-500/40'
            )}
          >
            <Plus className="w-3 h-3" />
          </div>
        )}
      </div>

      <HandShuffleOverlay active={shuffleActive} />
    </div>
  )
}
