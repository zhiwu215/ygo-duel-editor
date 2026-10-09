import { Tooltip, TooltipTrigger, TooltipContent } from '../../ui/tooltip'
import React, { useState, useRef, useEffect, useLayoutEffect } from 'react'
import { motion } from 'framer-motion'
import { Plus, Check, Edit2 } from 'lucide-react'
import { CardLocation, CdbCard, Duelist, FieldCard } from '@shared/index'
import { useDuelStore } from '../../../stores/useDuelStore'
import { DuelistHandStrip } from './DuelistHandStrip'
import { ZoneSlot } from '../ZoneSlot'
import { TurnOrderBadge } from './TurnOrderBadge'
import { LpInput } from './LpInput'
import { cn } from '../../../lib/utils'
import { getDropPosOverride } from '../../../utils/zoneDrop'
import { HAND_REORDER_DRAG_TYPE } from '../CardItem'
import {
  captureHandCardAnchors,
  getHandInsertionPosition,
  type HandInsertionPosition
} from '../../../utils/handReorder'

const MemoizedHandZoneSlot = React.memo(ZoneSlot)

interface HandTrayProps {
  controller: 0 | 1
}

/**
 * 单决斗者手牌托盘 (1v1 或单人阵营)
 * 扁平单层结构，信息栏与手牌槽合一，紧凑设计确保 1080p 窗口零滚动条
 */
const SingleHandTray: React.FC<{
  duelist: Duelist
  controller: 0 | 1
  cards: FieldCard[]
  totalCount: number
}> = ({ duelist, controller, cards, totalCount }) => {
  const addCardToZone = useDuelStore((s) => s.addCardToZone)
  const moveCard = useDuelStore((s) => s.moveCard)
  const reorderHandCards = useDuelStore((s) => s.reorderHandCards)
  const updateDuelist = useDuelStore((s) => s.updateDuelist)
  const isOpponent = controller === 1

  // 名字行内编辑
  const [editingName, setEditingName] = useState<string | null>(null)
  const isEditingName = editingName !== null
  const nameInput = editingName ?? duelist.name

  // 拖拽高亮与横向滚轮
  const [isDragOver, setIsDragOver] = useState(false)
  const [draggedHandCardId, setDraggedHandCardId] = useState<string | null>(null)
  const [handInsertionPosition, setHandInsertionPosition] = useState<HandInsertionPosition | null>(
    null
  )
  const draggedHandCardIdRef = useRef<string | null>(null)
  const hideDraggedCardFrameRef = useRef<number | null>(null)
  const handInsertionPositionRef = useRef<HandInsertionPosition | null>(null)
  const handCardAnchorsRef = useRef<ReturnType<typeof captureHandCardAnchors>>([])
  const hasCapturedHandLayoutRef = useRef(false)
  const trayRef = useRef<HTMLDivElement>(null)
  const scrollContainerRef = useRef<HTMLDivElement>(null)

  // 监听原生非被动 wheel 事件，阻止外层纵向滚动，纯化为手牌横向平移
  useEffect(() => {
    const el = trayRef.current
    if (!el) return
    const onWheel = (e: WheelEvent): void => {
      if (e.deltaY !== 0) {
        e.preventDefault()
        if (scrollContainerRef.current) {
          scrollContainerRef.current.scrollLeft += e.deltaY
        }
      }
    }
    el.addEventListener('wheel', onWheel, { passive: false })
    return () => el.removeEventListener('wheel', onWheel)
  }, [])

  // 全局拖拽结束重置状态，避免拖拽取消或子槽位截断 drop 后残留空位。
  useEffect(() => {
    const handleGlobalDragEnd = (): void => {
      setIsDragOver(false)
      if (hideDraggedCardFrameRef.current !== null) {
        window.cancelAnimationFrame(hideDraggedCardFrameRef.current)
        hideDraggedCardFrameRef.current = null
      }
      setDraggedHandCardId(null)
      draggedHandCardIdRef.current = null
      handInsertionPositionRef.current = null
      handCardAnchorsRef.current = []
      hasCapturedHandLayoutRef.current = false
      setHandInsertionPosition(null)
    }
    const handleGlobalDropOutside = (e: DragEvent): void => {
      if (e.target instanceof Node && trayRef.current?.contains(e.target)) return
      handleGlobalDragEnd()
    }
    window.addEventListener('dragend', handleGlobalDragEnd)
    window.addEventListener('drop', handleGlobalDragEnd)
    window.addEventListener('drop', handleGlobalDropOutside, true)
    return () => {
      window.removeEventListener('dragend', handleGlobalDragEnd)
      window.removeEventListener('drop', handleGlobalDragEnd)
      window.removeEventListener('drop', handleGlobalDropOutside, true)
      if (hideDraggedCardFrameRef.current !== null) {
        window.cancelAnimationFrame(hideDraggedCardFrameRef.current)
      }
    }
  }, [])

  const updateHandInsertionPosition = (next: HandInsertionPosition | null): void => {
    const current = handInsertionPositionRef.current
    if (current?.targetInstanceId === next?.targetInstanceId && current?.side === next?.side) return
    handInsertionPositionRef.current = next
    setHandInsertionPosition(next)
  }

  const captureHandLayout = (): void => {
    const container = scrollContainerRef.current
    if (!hasCapturedHandLayoutRef.current && container) {
      handCardAnchorsRef.current = captureHandCardAnchors(container)
      hasCapturedHandLayoutRef.current = true
    }
  }

  const handleDragStartCapture = (e: React.DragEvent<HTMLDivElement>): void => {
    const cardElement = (e.target as HTMLElement).closest<HTMLElement>('[data-hand-instance-id]')
    const instanceId = cardElement?.dataset.handInstanceId ?? null
    draggedHandCardIdRef.current = instanceId
    hasCapturedHandLayoutRef.current = false
    captureHandLayout()
    updateHandInsertionPosition(null)

    if (hideDraggedCardFrameRef.current !== null) {
      window.cancelAnimationFrame(hideDraggedCardFrameRef.current)
    }
    setDraggedHandCardId(null)
    // Let Chromium capture the native drag image before hiding the source card.
    if (instanceId) {
      hideDraggedCardFrameRef.current = window.requestAnimationFrame(() => {
        hideDraggedCardFrameRef.current = null
        setDraggedHandCardId(instanceId)
      })
    }
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

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>): void => {
    e.preventDefault()
    if (e.dataTransfer.types.includes(HAND_REORDER_DRAG_TYPE)) {
      e.dataTransfer.dropEffect = 'move'
      setIsDragOver(false)
      captureHandLayout()
      const container = scrollContainerRef.current
      const nextPosition = container
        ? getHandInsertionPosition(
            container,
            handCardAnchorsRef.current,
            draggedHandCardIdRef.current,
            e.clientX
          )
        : null
      updateHandInsertionPosition(nextPosition)
      return
    }
    e.dataTransfer.dropEffect = 'copy'
    updateHandInsertionPosition(null)
    if (!isDragOver) setIsDragOver(true)
  }

  const handleDragLeave = (e: React.DragEvent<HTMLDivElement>): void => {
    e.preventDefault()
    if (e.currentTarget.contains(e.relatedTarget as Node)) return
    setIsDragOver(false)
    updateHandInsertionPosition(null)
  }

  const getInsertionIndex = (position: HandInsertionPosition | null): number => {
    if (!position?.targetInstanceId) return cards.length
    const targetIndex = cards.findIndex((card) => card.instanceId === position.targetInstanceId)
    return targetIndex < 0 ? cards.length : targetIndex + (position.side === 'after' ? 1 : 0)
  }

  const handleDrop = (e: React.DragEvent): void => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragOver(false)
    if (hideDraggedCardFrameRef.current !== null) {
      window.cancelAnimationFrame(hideDraggedCardFrameRef.current)
      hideDraggedCardFrameRef.current = null
    }
    setDraggedHandCardId(null)
    const insertionPosition = handInsertionPositionRef.current
    updateHandInsertionPosition(null)
    draggedHandCardIdRef.current = null
    handCardAnchorsRef.current = []
    hasCapturedHandLayoutRef.current = false
    try {
      const movedInstanceId = e.dataTransfer.getData('text/instanceId')
      if (movedInstanceId) {
        const movingCard = useDuelStore
          .getState()
          .state.cards.find((card) => card.instanceId === movedInstanceId)
        if (
          e.dataTransfer.types.includes(HAND_REORDER_DRAG_TYPE) &&
          movingCard?.controller === controller &&
          movingCard.location === CardLocation.HAND &&
          (movingCard.duelistId ?? duelist.id) === duelist.id
        ) {
          if (!insertionPosition) return
          const targetInstanceId =
            insertionPosition.targetInstanceId ?? cards[cards.length - 1]?.instanceId ?? null
          if (targetInstanceId) {
            reorderHandCards(
              controller,
              duelist.id,
              movedInstanceId,
              targetInstanceId,
              insertionPosition.targetInstanceId ? insertionPosition.side === 'after' : true
            )
          }
          return
        }
        moveCard(
          movedInstanceId,
          CardLocation.HAND,
          getInsertionIndex(insertionPosition),
          controller,
          getDropPosOverride(CardLocation.HAND, e.ctrlKey),
          duelist.id
        )
        return
      }

      const dataStr = e.dataTransfer.getData('application/json')
      if (!dataStr) return
      const droppedCard = JSON.parse(dataStr) as CdbCard
      addCardToZone(
        droppedCard,
        controller,
        CardLocation.HAND,
        getInsertionIndex(insertionPosition),
        getDropPosOverride(CardLocation.HAND, e.ctrlKey),
        duelist.id
      )
    } catch (err) {
      console.error('[SingleHandTray] Drop failed:', err)
    }
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
      className="relative z-10 w-full max-w-5xl shrink-0 p-1.5 rounded-xl bg-card border border-border/80 shadow-sm flex flex-col gap-1"
    >
      {/* 顶部单行信息与操作栏 */}
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

        {/* 角色名称行内编辑 */}
        {isEditingName ? (
          <div className="flex items-center gap-1">
            <input
              type="text"
              value={nameInput}
              onChange={(e) => setEditingName(e.target.value)}
              onBlur={handleSaveName}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleSaveName()
                if (e.key === 'Escape') setEditingName(null)
              }}
              autoFocus
              className="h-5 w-24 px-1 text-xs rounded border border-primary bg-background focus:outline-none"
            />
            <button
              type="button"
              onClick={handleSaveName}
              className="p-0.5 text-muted-foreground hover:text-foreground"
            >
              <Check className="w-3 h-3 text-emerald-500" />
            </button>
          </div>
        ) : (
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
        )}

        {/* 手牌张数 */}
        <span className="text-[11px] text-muted-foreground font-mono">({cards.length} 张)</span>

        {/* LP 编辑 (包含四则运算与无限设置计算器) */}
        <LpInput
          lp={duelist.lp}
          label="LP"
          size="sm"
          player={controller}
          popoverPlacement={controller === 0 ? 'top' : 'bottom'}
          onLpChange={(newLp) => updateDuelist(duelist.id, { lp: newLp })}
        />

        {/* 顺位与先攻标记（支持直接下拉切换全场每位角色的行动次序） */}
        <TurnOrderBadge duelist={duelist} totalCount={totalCount} />
      </div>

      {/* 手牌横向排布流 (固定紧凑高度，保证无纵向溢出) */}
      <div
        ref={scrollContainerRef}
        onDragStartCapture={handleDragStartCapture}
        onDragEnter={handleDragEnter}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        className={cn(
          'h-[100px] w-full px-2 py-0.5 rounded border border-dashed flex items-center gap-1.5 overflow-x-auto overflow-y-hidden transition-colors',
          isDragOver
            ? isOpponent
              ? 'border-red-500 ring-2 ring-red-500/20 bg-red-500/10'
              : 'border-blue-500 ring-2 ring-blue-500/20 bg-blue-500/10'
            : isOpponent
              ? 'border-red-500/25 hover:border-red-500/50 bg-muted/20 dark:bg-black/20'
              : 'border-blue-500/25 hover:border-blue-500/50 bg-muted/20 dark:bg-black/20'
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
                <MemoizedHandZoneSlot
                  label={`${duelist.name} ${idx + 1}`}
                  controller={controller}
                  location={CardLocation.HAND}
                  sequence={c.sequence}
                  card={c}
                  duelistId={duelist.id}
                />
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
    </div>
  )
}

/**
 * 多决斗者手牌托盘 (2v2、1v2 等多人模式)
 * 顶部显示阵营汇总及队伍 LP 控制，下方并排各决斗者的独立手牌带
 */
const MultiHandTray: React.FC<{
  duelists: Duelist[]
  controller: 0 | 1
  teamHandCards: FieldCard[]
  totalCount: number
}> = ({ duelists, controller, teamHandCards, totalCount }) => {
  const sharedLp = useDuelStore((s) => s.state.matchConfig?.sharedLp)
  const teamLp = useDuelStore((s) => s.state.players[controller]?.lp)
  const expandedDuelistId = useDuelStore((s) => s.expandedDuelistId)
  const setExpandedDuelistId = useDuelStore((s) => s.setExpandedDuelistId)
  const toggleSharedLp = useDuelStore((s) => s.toggleSharedLp)
  const setPlayerLp = useDuelStore((s) => s.setPlayerLp)
  const activeDuelistId = useDuelStore((s) => s.activeDuelistId)
  const setActiveDuelistId = useDuelStore((s) => s.setActiveDuelistId)
  const updateDuelist = useDuelStore((s) => s.updateDuelist)
  const rowScrollRef = useRef<HTMLDivElement>(null)

  // 顶栏名字芯片右键重命名
  const [renamingId, setRenamingId] = useState<string | null>(null)
  const [renameDraft, setRenameDraft] = useState<string>('')

  // 拥挤判定：排布行实际横向溢出（而非写死人数阈值）。
  // 溢出时关闭各栏内部滚动 —— 滚轮只用于左右滑动查看不同决斗者；
  // 双击某栏展开占满整行后，该栏宽度足够，内部滚动依旧可用。
  const [isCrowded, setIsCrowded] = useState(false)
  useLayoutEffect(() => {
    const el = rowScrollRef.current
    if (!el) return
    const measure = (): void => {
      setIsCrowded(el.scrollWidth > el.clientWidth + 1)
    }
    measure()
    const ro = new ResizeObserver(measure)
    ro.observe(el)
    for (const child of Array.from(el.children)) ro.observe(child)
    return () => ro.disconnect()
  }, [duelists.length])

  const commitRename = (): void => {
    if (!renamingId) return
    const trimmed = renameDraft.trim()
    if (trimmed) updateDuelist(renamingId, { name: trimmed })
    setRenamingId(null)
  }

  // 人数过多时排布行横向溢出，点击顶栏名字芯片需把对应手牌带滚动到可视范围内
  const stripRefs = useRef<Map<string, HTMLDivElement>>(new Map())
  const scrollStripIntoView = (duelistId: string): void => {
    const row = rowScrollRef.current
    const strip = stripRefs.current.get(duelistId)
    if (!row || !strip) return
    // 以排布行左侧为基准换算目标 scrollLeft；已在可视范围内则不打扰用户
    const target = strip.offsetLeft - row.offsetLeft
    const maxScroll = row.scrollWidth - row.clientWidth
    if (maxScroll <= 0) return
    const clamped = Math.max(0, Math.min(target, maxScroll))
    if (row.scrollLeft === clamped) return
    row.scrollTo({ left: clamped, behavior: 'smooth' })
  }

  // 人数多时外层出现横向滚动条，但系统滚轮是纵向 deltaY，必须手动转成横向位移，
  // 否则该滚动条滚不动（内层手牌槽另有自己的 wheel 处理，两者互不干扰）。
  useEffect(() => {
    const el = rowScrollRef.current
    if (!el) return
    const onWheel = (e: WheelEvent): void => {
      if (e.deltaY !== 0 && el.scrollWidth > el.clientWidth) {
        e.preventDefault()
        el.scrollLeft += e.deltaY
      }
    }
    el.addEventListener('wheel', onWheel, { passive: false })
    return () => el.removeEventListener('wheel', onWheel)
  }, [])

  const activeExpandedDuelist = duelists.find((d) => d.id === expandedDuelistId)
  const isSharedLp = Boolean(sharedLp)

  return (
    <div className="relative z-10 w-full max-w-5xl shrink-0 p-1.5 rounded-xl bg-card border border-border/80 shadow-sm flex flex-col gap-1">
      {/* 顶部阵营状态栏 */}
      <div className="flex items-center gap-1.5 text-xs px-1 h-5">
        {/* 各位决斗者名字：左键切换棋盘显示谁的卡组，右键重命名。
            名字本身已含阵营前缀（我方 1 / 对方 1），只需用阵营色区分，不再额外写「我方 / 对方」 */}
        {duelists.map((d) =>
          renamingId === d.id ? (
            <input
              key={d.id}
              type="text"
              value={renameDraft}
              autoFocus
              onChange={(e) => setRenameDraft(e.target.value)}
              onBlur={commitRename}
              onKeyDown={(e) => {
                if (e.key === 'Enter') commitRename()
                if (e.key === 'Escape') setRenamingId(null)
              }}
              className="h-[18px] w-20 px-1 text-[10px] rounded border border-primary bg-background outline-none"
            />
          ) : (
            <Tooltip key={d.id}>
              <TooltipTrigger
                render={
                  <button
                    type="button"
                    onClick={() => {
                      setActiveDuelistId(d.id)
                      scrollStripIntoView(d.id)
                    }}
                    onContextMenu={(e) => {
                      e.preventDefault()
                      setRenamingId(d.id)
                      setRenameDraft(d.name)
                    }}

                    className={cn(
                      'px-1.5 py-0.5 rounded text-[10px] font-medium transition-colors border',
                      d.team === 1
                        ? 'text-red-600 dark:text-red-400'
                        : 'text-blue-600 dark:text-blue-400',
                      activeDuelistId === d.id
                        ? 'bg-primary text-primary-foreground border-primary'
                        : 'bg-muted/40 border-border hover:bg-muted'
                    )}
                  >
                    {d.name}
                  </button>
                }
              />
              <TooltipContent>{`左键查看 ${d.name} 的卡组 · 右键重命名`}</TooltipContent>
            </Tooltip>
          )
        )}

        <span className="text-[11px] text-muted-foreground font-mono ml-1">
          共 {teamHandCards.length} 张
        </span>

        {/* 多人时提供队伍共用 LP 开关 */}
        <Tooltip>
          <TooltipTrigger
            render={
              <button
                type="button"
                onClick={toggleSharedLp}
                className={cn(
                  'ml-1 px-1.5 py-0.5 rounded text-[10px] font-medium transition-colors border',
                  isSharedLp
                    ? 'bg-primary/15 border-primary/40 text-primary'
                    : 'bg-muted/40 border-border text-muted-foreground hover:text-foreground'
                )}
              >
                {isSharedLp ? '✓ 队伍共用 LP' : '独立 LP'}
              </button>
            }
          />
          <TooltipContent>
            {isSharedLp
              ? '当前为队伍共用生命值，点击切换为每位决斗者独立生命值'
              : '当前为独立生命值，点击切换为全队共用同一生命值'}
          </TooltipContent>
        </Tooltip>

        {/* 队伍共用 LP：仅在队伍共用模式下展示于队伍状态栏 (包含四则运算与无限设置计算器) */}
        {isSharedLp && (
          <LpInput
            lp={teamLp ?? duelists[0]?.lp ?? 8000}
            label="队伍 LP"
            size="sm"
            player={controller}
            popoverPlacement={controller === 0 ? 'top' : 'bottom'}
            onLpChange={(newLp) => setPlayerLp(controller, newLp)}
          />
        )}
      </div>

      {/* 决斗者手牌带排布行 (横向并排，永远单行不换行，支持单人展开独占) */}
      <div
        ref={rowScrollRef}
        className="w-full flex items-center gap-1.5 overflow-x-auto overflow-y-hidden select-none"
      >
        {duelists.map((duelist) => {
          const duelistCards = teamHandCards.filter((c) => {
            if (c.duelistId) return c.duelistId === duelist.id
            return duelist.id === duelists[0].id
          })

          const isExpanded = activeExpandedDuelist?.id === duelist.id
          const isCollapsed = Boolean(
            activeExpandedDuelist && activeExpandedDuelist.id !== duelist.id
          )

          return (
            <DuelistHandStrip
              key={duelist.id}
              duelist={duelist}
              controller={controller}
              cards={duelistCards}
              totalCount={totalCount}
              isExpanded={isExpanded}
              isCollapsed={isCollapsed}
              isOnlyOne={false}
              crowded={isCrowded}
              ref={(el) => {
                if (el) stripRefs.current.set(duelist.id, el)
                else stripRefs.current.delete(duelist.id)
              }}
              onExpand={() => setExpandedDuelistId(duelist.id)}
              onCollapse={() => setExpandedDuelistId(null)}
            />
          )
        })}
      </div>
    </div>
  )
}

export const HandTray: React.FC<HandTrayProps> = ({ controller }) => {
  const { state } = useDuelStore()

  // 获取本阵营决斗者列表
  const rawDuelists = (state.duelists || []).filter((d) => d.team === controller)
  const totalCount = state.duelists?.length || 2
  const duelists: Duelist[] =
    rawDuelists.length > 0
      ? rawDuelists
      : [
          {
            id: `duelist_${controller}_0`,
            team: controller,
            name: controller === 0 ? '我方' : '对方',
            lp: state.players[controller]?.lp ?? 8000,
            isFirst: controller === 0,
            turnOrder: controller === 0 ? 1 : 2
          }
        ]

  // 本阵营全部手牌
  const teamHandCards = state.cards
    .filter((c) => c.controller === controller && c.location === CardLocation.HAND)
    .sort((a, b) => a.sequence - b.sequence)

  if (duelists.length === 1) {
    return (
      <SingleHandTray
        duelist={duelists[0]}
        controller={controller}
        cards={teamHandCards}
        totalCount={totalCount}
      />
    )
  }

  return (
    <MultiHandTray
      duelists={duelists}
      controller={controller}
      teamHandCards={teamHandCards}
      totalCount={totalCount}
    />
  )
}
