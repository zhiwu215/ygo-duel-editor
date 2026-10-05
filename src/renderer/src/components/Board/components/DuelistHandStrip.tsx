import React, { useState, useRef, useEffect } from 'react'
import { Crown, Plus, Check, Edit2 } from 'lucide-react'
import { CardLocation, CdbCard, Duelist, FieldCard } from '@shared/index'
import { useDuelStore } from '../../../stores/useDuelStore'
import { ZoneSlot } from '../ZoneSlot'
import { TurnOrderBadge } from './TurnOrderBadge'
import { LpInput } from './LpInput'
import { getDropPosOverride } from '../../../utils/zoneDrop'
import { cn } from '../../../lib/utils'

interface DuelistHandStripProps {
  duelist: Duelist
  controller: 0 | 1
  cards: FieldCard[]
  totalCount?: number
  isExpanded: boolean
  isCollapsed: boolean
  isOnlyOne: boolean
  onExpand: () => void
  onCollapse: () => void
}

export const DuelistHandStrip: React.FC<DuelistHandStripProps> = ({
  duelist,
  controller,
  cards,
  totalCount = 2,
  isExpanded,
  isCollapsed,
  isOnlyOne,
  onExpand,
  onCollapse
}) => {
  const { addCardToZone, moveCard, updateDuelist } = useDuelStore()
  const isSharedLp = Boolean(useDuelStore((s) => s.state.matchConfig?.sharedLp))

  const isOpponent = controller === 1

  // 名字行内编辑 (null 表示未处于编辑态)
  const [editingName, setEditingName] = useState<string | null>(null)
  const isEditingName = editingName !== null
  const nameInput = editingName ?? duelist.name

  // 拖拽高亮与悬停展开计时器
  const [isDragOver, setIsDragOver] = useState(false)
  const hoverExpandTimerRef = useRef<NodeJS.Timeout | null>(null)
  const stripRef = useRef<HTMLDivElement>(null)
  const scrollContainerRef = useRef<HTMLDivElement>(null)

  // 监听原生非被动 wheel 事件，彻底拦截纵向滚动，纯化为手牌横向左右平移
  useEffect(() => {
    const el = stripRef.current
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
  }, [isCollapsed])

  // 全局拖拽结束重置状态：避免卡片释放于子槽位或拖拽取消时导致 isDragOver 常驻
  useEffect(() => {
    const handleGlobalDragEnd = (): void => {
      setIsDragOver(false)
      if (hoverExpandTimerRef.current) {
        clearTimeout(hoverExpandTimerRef.current)
        hoverExpandTimerRef.current = null
      }
    }
    window.addEventListener('dragend', handleGlobalDragEnd)
    window.addEventListener('drop', handleGlobalDragEnd)
    return () => {
      window.removeEventListener('dragend', handleGlobalDragEnd)
      window.removeEventListener('drop', handleGlobalDragEnd)
    }
  }, [])

  // 拖拽悬停至收缩窄条时，自动展开
  const handleDragEnter = (): void => {
    setIsDragOver(true)
    if (isCollapsed) {
      if (hoverExpandTimerRef.current) clearTimeout(hoverExpandTimerRef.current)
      hoverExpandTimerRef.current = setTimeout(() => {
        onExpand()
      }, 300)
    }
  }

  const handleDragLeave = (): void => {
    setIsDragOver(false)
    if (hoverExpandTimerRef.current) {
      clearTimeout(hoverExpandTimerRef.current)
      hoverExpandTimerRef.current = null
    }
  }

  const handleDragOver = (e: React.DragEvent): void => {
    e.preventDefault()
    e.dataTransfer.dropEffect = 'copy'
  }

  const handleDrop = (e: React.DragEvent): void => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragOver(false)
    if (hoverExpandTimerRef.current) {
      clearTimeout(hoverExpandTimerRef.current)
      hoverExpandTimerRef.current = null
    }

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
      console.error('[DuelistHandStrip] Drop failed:', err)
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

  // 双击手牌区顶部信息条即可展开/收起（替代原先的独立「展开」按钮，少一个图标更好点）
  // 命中输入框 / 下拉框 / 按钮等交互元素时直接放行，避免与 LP 编辑、顺位选择、改名冲突
  const handleHeaderDoubleClick = (e: React.MouseEvent<HTMLDivElement>): void => {
    if (isOnlyOne || isEditingName) return
    const target = e.target as HTMLElement | null
    if (target?.closest('input, select, textarea, button, a, [data-no-expand]')) return
    if (isExpanded) {
      onCollapse()
    } else {
      onExpand()
    }
  }

  // ==========================================
  // 1. 收起状态（竖排窄条，横向收窄不换行）
  // ==========================================
  if (isCollapsed) {
    const currentOrder = duelist.turnOrder ?? (duelist.isFirst ? 1 : 2)
    const isFirst = currentOrder === 1
    return (
      <div
        onClick={onExpand}
        onDragEnter={handleDragEnter}
        onDragLeave={handleDragLeave}
        onDragOver={handleDragOver}
        onDrop={handleDrop}
        title={`点击展开 ${duelist.name} 的全部手牌（${cards.length} 张，行动顺位：第 ${currentOrder} 位）`}
        className={cn(
          'w-9 shrink-0 h-[136px] rounded border transition-all cursor-pointer select-none flex flex-col items-center justify-between py-1 px-0.5',
          isDragOver
            ? isOpponent
              ? 'border-red-500 ring-2 ring-red-500/30 bg-red-500/10'
              : 'border-blue-500 ring-2 ring-blue-500/30 bg-blue-500/10'
            : isOpponent
              ? 'border-red-500/30 bg-red-500/5 hover:bg-red-500/15 hover:border-red-500/50'
              : 'border-blue-500/30 bg-blue-500/5 hover:bg-blue-500/15 hover:border-blue-500/50'
        )}
      >
        <div className="flex flex-col items-center gap-0.5">
          <span
            className={cn(
              'w-2 h-2 rounded-full shrink-0',
              isOpponent ? 'bg-red-500' : 'bg-blue-500'
            )}
          />
          {isFirst ? (
            <Crown className="w-3 h-3 text-amber-500 shrink-0" />
          ) : (
            <span className="text-[9px] font-mono font-bold text-muted-foreground">
              #{currentOrder}
            </span>
          )}
        </div>

        {/* 竖排名字 */}
        <span
          className={cn(
            'text-[10px] font-semibold tracking-wider text-center leading-tight line-clamp-3 my-auto',
            isOpponent ? 'text-red-400' : 'text-blue-400'
          )}
          style={{ writingMode: 'vertical-rl' }}
        >
          {duelist.name}
        </span>

        {/* 手牌张数徽标 */}
        <span
          className={cn(
            'text-[9px] font-mono font-bold px-1 py-0.5 rounded-full shrink-0',
            cards.length > 0 ? 'bg-muted-foreground/20 text-foreground' : 'text-muted-foreground/60'
          )}
        >
          {cards.length}
        </span>
      </div>
    )
  }

  // ==========================================
  // 2. 正常状态（并排或独占展开）
  // ==========================================
  return (
    <div
      ref={stripRef}
      onDragEnter={() => setIsDragOver(true)}
      onDragLeave={() => setIsDragOver(false)}
      className={cn(
        'flex-1 min-w-[180px] h-[136px] rounded border flex flex-col p-1 transition-all gap-0.5 relative',
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
      {/* 头部信息条：名字、LP、顺位选择；双击本行即可展开/收起全部手牌 */}
      <div
        onDoubleClick={handleHeaderDoubleClick}
        title={
          isOnlyOne ? undefined : isExpanded ? '双击收起为并排展示' : '双击展开占满整行展示全部手牌'
        }
        className="flex items-center justify-between text-xs px-0.5 shrink-0 gap-1 h-5"
      >
        <div className="flex items-center gap-1 min-w-0">
          <span
            className={cn(
              'w-2 h-2 rounded-full shrink-0',
              isOpponent ? 'bg-red-500' : 'bg-blue-500'
            )}
          />

          {/* 名字行内编辑 */}
          {isEditingName ? (
            <div className="flex items-center gap-1" data-no-expand>
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
                className="h-4.5 w-20 px-1 text-[11px] rounded border border-primary bg-background focus:outline-none"
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
              data-no-expand
              className="flex items-center gap-0.5 group cursor-pointer hover:bg-muted/50 px-1 py-0.5 rounded truncate"
            >
              <span
                className={cn(
                  'font-bold text-[11px] truncate max-w-[90px]',
                  isOpponent ? 'text-red-500 dark:text-red-400' : 'text-blue-500 dark:text-blue-400'
                )}
              >
                {duelist.name}
              </span>
              <Edit2 className="w-2.5 h-2.5 opacity-0 group-hover:opacity-60 transition-opacity shrink-0" />
            </div>
          )}

          {/* 手牌张数 */}
          <span className="text-[10px] text-muted-foreground shrink-0 font-mono">
            ({cards.length})
          </span>
        </div>

        {/* 右侧：LP 编辑（仅在独立 LP 模式下显示）、顺位选择 */}
        <div className="flex items-center gap-1 shrink-0" data-no-expand>
          {/* LP 修改 (仅在独立 LP 时由决斗者各自持有；队伍共用 LP 时属于队伍统一管理) */}
          {!isSharedLp && (
            <LpInput
              lp={duelist.lp}
              label="LP"
              size="sm"
              player={controller}
              popoverPlacement={controller === 0 ? 'top' : 'bottom'}
              onLpChange={(newLp) => updateDuelist(duelist.id, { lp: newLp })}
            />
          )}

          {/* 行动顺位下拉选择 */}
          <TurnOrderBadge duelist={duelist} totalCount={totalCount || 2} />
        </div>
      </div>

      {/* 手牌卡片排布横向滚动槽位 (永远不换行) */}
      <div
        ref={scrollContainerRef}
        onDragOver={handleDragOver}
        onDrop={handleDrop}
        className={cn(
          'flex-1 w-full px-1 py-1 rounded border border-dashed flex items-center gap-1 overflow-x-auto overflow-y-hidden transition-colors',
          isDragOver
            ? isOpponent
              ? 'border-red-500 ring-2 ring-red-500/20 bg-red-500/10'
              : 'border-blue-500 ring-2 ring-blue-500/20 bg-blue-500/10'
            : isOpponent
              ? 'border-red-500/20 hover:border-red-500/40 bg-muted/20 dark:bg-black/20'
              : 'border-blue-500/20 hover:border-blue-500/40 bg-muted/20 dark:bg-black/20'
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
            <Plus className="w-3 h-3" />
          </div>
        )}
      </div>
    </div>
  )
}
