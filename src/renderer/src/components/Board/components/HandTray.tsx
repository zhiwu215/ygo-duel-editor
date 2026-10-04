import React, { useState, useRef, useEffect } from 'react'
import { Plus, Check, Edit2 } from 'lucide-react'
import { CardLocation, CdbCard, Duelist, FieldCard } from '@shared/index'
import { useDuelStore } from '../../../stores/useDuelStore'
import { DuelistHandStrip } from './DuelistHandStrip'
import { ZoneSlot } from '../ZoneSlot'
import { TurnOrderBadge } from './TurnOrderBadge'
import { LpInput } from './LpInput'
import { Badge } from '../../ui/badge'
import { cn } from '../../../lib/utils'
import { getDropPosOverride } from '../../../utils/zoneDrop'

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
  const { addCardToZone, moveCard, updateDuelist } = useDuelStore()
  const isOpponent = controller === 1

  // 名字行内编辑
  const [editingName, setEditingName] = useState<string | null>(null)
  const isEditingName = editingName !== null
  const nameInput = editingName ?? duelist.name

  // 拖拽高亮与横向滚轮
  const [isDragOver, setIsDragOver] = useState(false)
  const dragCounterRef = useRef(0)
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

  // 全局拖拽结束重置状态：避免卡片释放于子槽位 (stopPropagation) 或拖拽取消时导致托盘的 isDragOver 状态常驻为 true
  useEffect(() => {
    const handleGlobalDragEnd = (): void => {
      dragCounterRef.current = 0
      setIsDragOver(false)
    }
    window.addEventListener('dragend', handleGlobalDragEnd)
    window.addEventListener('drop', handleGlobalDragEnd)
    return () => {
      window.removeEventListener('dragend', handleGlobalDragEnd)
      window.removeEventListener('drop', handleGlobalDragEnd)
    }
  }, [])

  const handleDragEnter = (e: React.DragEvent): void => {
    e.preventDefault()
    dragCounterRef.current++
    if (!isDragOver) setIsDragOver(true)
  }

  const handleDragOver = (e: React.DragEvent): void => {
    e.preventDefault()
    e.dataTransfer.dropEffect = 'copy'
    if (!isDragOver) setIsDragOver(true)
  }

  const handleDragLeave = (e: React.DragEvent): void => {
    e.preventDefault()
    dragCounterRef.current--
    if (dragCounterRef.current <= 0) {
      dragCounterRef.current = 0
      setIsDragOver(false)
    }
  }

  const handleDrop = (e: React.DragEvent): void => {
    e.preventDefault()
    e.stopPropagation()
    dragCounterRef.current = 0
    setIsDragOver(false)
    try {
      const movedInstanceId = e.dataTransfer.getData('text/instanceId')
      if (movedInstanceId) {
        moveCard(
          movedInstanceId,
          CardLocation.HAND,
          cards.length,
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
        cards.length,
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
          <div
            onClick={() => setEditingName(duelist.name)}
            title="点击修改角色名称"
            className="flex items-center gap-1 group cursor-pointer hover:bg-muted/50 px-1 py-0.5 rounded"
          >
            <span className="font-semibold text-foreground/90">{duelist.name}</span>
            <Edit2 className="w-2.5 h-2.5 opacity-0 group-hover:opacity-60 transition-opacity shrink-0" />
          </div>
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
        {cards.map((c, idx) => (
          <div key={c.instanceId} className="shrink-0">
            <ZoneSlot
              label={`${duelist.name} ${idx + 1}`}
              controller={controller}
              location={CardLocation.HAND}
              sequence={c.sequence}
              card={c}
              duelistId={duelist.id}
            />
          </div>
        ))}

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
  const { state, expandedDuelistId, setExpandedDuelistId, toggleSharedLp, setPlayerLp } =
    useDuelStore()
  const isOpponent = controller === 1

  const activeExpandedDuelist = duelists.find((d) => d.id === expandedDuelistId)
  const isSharedLp = Boolean(state.matchConfig?.sharedLp)

  return (
    <div className="relative z-10 w-full max-w-5xl shrink-0 p-1.5 rounded-xl bg-card border border-border/80 shadow-sm flex flex-col gap-1">
      {/* 顶部阵营状态栏 */}
      <div className="flex items-center gap-2 text-xs px-1 h-5">
        <span
          className={cn(
            'font-bold tracking-wide text-xs',
            isOpponent ? 'text-red-600 dark:text-red-400' : 'text-blue-600 dark:text-blue-400'
          )}
        >
          {isOpponent ? '对方手牌区' : '我方手牌区'}
        </span>

        <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-4 font-medium">
          {duelists.length} 位决斗者
        </Badge>

        <span className="text-[11px] text-muted-foreground font-mono">
          全队共 {teamHandCards.length} 张手牌
        </span>

        {/* 多人时提供队伍共用 LP 开关 */}
        <button
          type="button"
          onClick={toggleSharedLp}
          title={
            isSharedLp
              ? '当前为队伍共用生命值，点击切换为每位决斗者独立生命值'
              : '当前为独立生命值，点击切换为全队共用同一生命值'
          }
          className={cn(
            'ml-1 px-1.5 py-0.5 rounded text-[10px] font-medium transition-colors border',
            isSharedLp
              ? 'bg-primary/15 border-primary/40 text-primary'
              : 'bg-muted/40 border-border text-muted-foreground hover:text-foreground'
          )}
        >
          {isSharedLp ? '✓ 队伍共用 LP' : '独立 LP'}
        </button>

        {/* 队伍共用 LP：仅在队伍共用模式下展示于队伍状态栏 (包含四则运算与无限设置计算器) */}
        {isSharedLp && (
          <LpInput
            lp={state.players[controller]?.lp ?? duelists[0]?.lp ?? 8000}
            label="队伍 LP"
            size="sm"
            player={controller}
            popoverPlacement={controller === 0 ? 'top' : 'bottom'}
            onLpChange={(newLp) => setPlayerLp(controller, newLp)}
          />
        )}
      </div>

      {/* 决斗者手牌带排布行 (横向并排，永远单行不换行，支持单人展开独占) */}
      <div className="w-full flex items-center gap-1.5 overflow-x-auto overflow-y-hidden select-none">
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
  const teamHandCards = state.cards.filter(
    (c) => c.controller === controller && c.location === CardLocation.HAND
  )

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
