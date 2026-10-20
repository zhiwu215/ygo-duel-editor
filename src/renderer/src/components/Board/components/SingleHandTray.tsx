import { Tooltip, TooltipTrigger, TooltipContent } from '../../ui/tooltip'
import React, { useState } from 'react'
import { motion } from 'framer-motion'
import { Plus, Edit2 } from 'lucide-react'
import { CardLocation, Duelist, FieldCard } from '@shared/index'
import { useDuelStore } from '../../../stores/useDuelStore'
import { useDuelEngineStore } from '../../../stores/useDuelEngineStore'
import { MemoZoneSlot } from '../ZoneSlot'
import { HandShuffleOverlay } from './HandShuffleOverlay'
import { TurnOrderBadge } from './TurnOrderBadge'
import { LpInput } from './LpInput'
import { EditableNameChip } from './EditableNameChip'
import { useHandShufflePulse } from '../../../hooks/useHandShufflePulse'
import { useHandReorderDrag } from '../../../hooks/useHandReorderDrag'
import { useHeldCardPlacement } from '../../../hooks/useHeldCardPlacement'
import { useHorizontalWheelScroll } from '../../../hooks/useHorizontalWheelScroll'
import { useLpCommit } from '../../../hooks/useLpCommit'
import { cn } from '../../../lib/utils'
import { HAND_REORDER_DRAG_TYPE } from '../CardItem'

export const SingleHandTray: React.FC<{
  duelist: Duelist
  controller: 0 | 1
  cards: FieldCard[]
  totalCount: number
}> = ({ duelist, controller, cards, totalCount }) => {
  const updateDuelist = useDuelStore((s) => s.updateDuelist)
  const isOpponent = controller === 1
  const shuffle = useHandShufflePulse(controller)
  const commitLp = useLpCommit()

  const [editingName, setEditingName] = useState<string | null>(null)
  const isEditingName = editingName !== null
  const nameInput = editingName ?? duelist.name

  const {
    isDragOver,
    draggedHandCardId,
    handInsertionPosition,
    hitAreaRef: trayRef,
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
    isOwnedHandCard: (movingCard) => (movingCard.duelistId ?? duelist.id) === duelist.id,
    highlightOnForeignOver: true,
    onParseError: () => useDuelEngineStore.setState({ error: '拖拽数据解析失败，请重试' }),
    onInjectUnsupported: () => useDuelEngineStore.setState({ error: '该落点不支持剧情安排注入' }),
    onDropFailure: (err) =>
      useDuelEngineStore.setState({
        error: err instanceof Error ? err.message : '拖拽操作失败'
      }),
    dropLogTag: 'SingleHandTray'
  })

  useHorizontalWheelScroll(trayRef, { scrollRef: scrollContainerRef })

  const { heldCardInstanceId, placeHeldCard } = useHeldCardPlacement()

  const handlePlaceHeldCard = (e: React.MouseEvent): void => {
    placeHeldCard(e, {
      controller,
      location: CardLocation.HAND,
      sequence: cards.length,
      duelistId: duelist.id
    })
  }

  const handleDragEnter = (e: React.DragEvent): void => {
    e.preventDefault()
    if (e.dataTransfer.types.includes(HAND_REORDER_DRAG_TYPE)) {
      setIsDragOver(false)
      captureHandLayout()
      return
    }
    if (!isDragOver) setIsDragOver(true)
  }

  const handleDragLeave = (e: React.DragEvent<HTMLDivElement>): void => {
    e.preventDefault()
    if (e.currentTarget.contains(e.relatedTarget as Node)) return
    setIsDragOver(false)
    updateHandInsertionPosition(null)
  }

  const handleSaveName = (): void => {
    if (editingName !== null) {
      const trimmed = editingName.trim()
      if (trimmed && trimmed !== duelist.name) {
        updateDuelist(duelist.id, { name: trimmed })
      }
      setEditingName(null)
    }
  }

  return (
    <div
      ref={trayRef}
      onDragEnter={handleDragEnter}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      className="relative z-10 w-full max-w-5xl shrink-0 p-1.5 rounded-xl bg-card border border-border/80 shadow-sm flex flex-col gap-1"
    >
      <div className="flex items-center gap-2 text-xs px-1 h-5">
        <span
          className={cn('w-2 h-2 rounded-full shrink-0', isOpponent ? 'bg-red-500' : 'bg-blue-500')}
        />

        <span
          className={cn(
            'font-bold tracking-wide text-xs',
            isOpponent ? 'text-red-600 dark:text-red-400' : 'text-blue-600 dark:text-blue-400'
          )}
        >
          {isOpponent ? '对方手牌' : '我方手牌'}
        </span>

        <EditableNameChip
          editing={isEditingName}
          draft={nameInput}
          onDraftChange={setEditingName}
          onCommit={handleSaveName}
          onCancel={() => setEditingName(null)}
          inputClassName="h-5 w-24 px-1 text-xs rounded border border-primary bg-background focus:outline-none"
          withConfirmButton
        >
          <Tooltip>
            <TooltipTrigger
              render={
                <div
                  onClick={() => setEditingName(duelist.name)}
                  className="flex items-center gap-1 group cursor-pointer hover:bg-muted/50 px-1 py-0.5 rounded"
                >
                  <span className="font-semibold text-foreground/90">{duelist.name}</span>
                  <Edit2 className="w-2.5 h-2.5 opacity-0 group-hover:opacity-60 transition-opacity shrink-0" />
                </div>
              }
            />
            <TooltipContent>点击修改角色名称</TooltipContent>
          </Tooltip>
        </EditableNameChip>

        <span className="text-[11px] text-muted-foreground font-mono">({cards.length} 张)</span>

        <LpInput
          lp={duelist.lp}
          label="LP"
          size="sm"
          player={controller}
          popoverPlacement={controller === 0 ? 'top' : 'bottom'}
          onLpChange={(newLp) =>
            commitLp(controller, newLp, (lp) => updateDuelist(duelist.id, { lp }))
          }
        />

        <TurnOrderBadge duelist={duelist} totalCount={totalCount} />
      </div>

      <div className="relative">
        <div
          ref={scrollContainerRef}
          onDragStartCapture={handleDragStartCapture}
          onDragEnter={handleDragEnter}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          onClick={handlePlaceHeldCard}
          className={cn(
            'h-[100px] w-full px-2 py-0.5 rounded border border-dashed flex items-center gap-1.5 overflow-x-auto overflow-y-hidden transition-colors',
            shuffle.active && 'ring-2 ring-amber-400/70 border-amber-400/60',
            isDragOver
              ? isOpponent
                ? 'border-red-500 ring-2 ring-red-500/20 bg-red-500/10'
                : 'border-blue-500 ring-2 ring-blue-500/20 bg-blue-500/10'
              : isOpponent
                ? 'border-red-500/25 hover:border-red-500/50 bg-muted/20 dark:bg-black/20'
                : 'border-blue-500/25 hover:border-blue-500/50 bg-muted/20 dark:bg-black/20',
            heldCardInstanceId && 'cursor-pointer ring-2 ring-primary/40 border-primary/60'
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
                    key={shuffle.tick}
                    initial={{ y: 0, rotate: 0 }}
                    animate={
                      shuffle.tick > 0
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
              <Plus className="w-3.5 h-3.5" />
            </div>
          )}
        </div>
        <HandShuffleOverlay active={shuffle.active} />
      </div>
    </div>
  )
}
