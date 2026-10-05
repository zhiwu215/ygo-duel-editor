import React, { useState, useRef, useEffect } from 'react'
import { Crown, Plus } from 'lucide-react'
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
  /** 排布行已横向溢出（人数过多）：关闭本栏内部滚动，滚轮一律用于左右滑动查看各人 */
  crowded: boolean
  /** 供父级定位该栏（人数过多时点击名字芯片滚动到对应手牌带） */
  ref?: React.Ref<HTMLDivElement>
  onExpand: () => void
  onCollapse: () => void
}

/** 合并多个 ref 到同一个元素（内部 stripRef + 父级传入的定位 ref） */
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
  isOnlyOne,
  crowded,
  ref,
  onExpand,
  onCollapse
}) => {
  const { addCardToZone, moveCard, updateDuelist } = useDuelStore()
  const isSharedLp = Boolean(useDuelStore((s) => s.state.matchConfig?.sharedLp))
  const isActiveViewer = useDuelStore((s) => s.activeDuelistId === duelist.id)
  const setActiveDuelistId = useDuelStore((s) => s.setActiveDuelistId)

  const isOpponent = controller === 1

  // 切换「棋盘堆叠区当前显示谁的卡组」的三种触发（均为主动操作，非悬停）：
  //   ① 点击本栏外框（头部信息条空白处）② 点击本栏手牌 ③ 向本栏拖入/拖来卡片。
  // 仅查看归属，不会改动任何卡牌数据。
  const focusAsViewer = (): void => {
    if (!isActiveViewer) setActiveDuelistId(duelist.id)
  }

  // 拖拽高亮与悬停展开计时器
  const [isDragOver, setIsDragOver] = useState(false)
  const hoverExpandTimerRef = useRef<NodeJS.Timeout | null>(null)
  const stripRef = useRef<HTMLDivElement>(null)
  const scrollContainerRef = useRef<HTMLDivElement>(null)

  // 监听原生非被动 wheel 事件，把纵向滚轮转成本栏手牌的横向平移。
  // 三种情形不拦截，让滚轮冒泡给上层「决斗者手牌带排布行」去左右滑动查看各人：
  //   ① 本栏手牌槽已滚到尽头；
  //   ② 拥挤且未展开（排布行横向溢出，滚轮一律用于切换查看不同决斗者）。
  // 拥挤但已双击展开的栏位宽度足够，仍保留本栏内部滚动。
  useEffect(() => {
    const el = stripRef.current
    if (!el) return
    const onWheel = (e: WheelEvent): void => {
      if (e.deltaY === 0) return
      if (crowded && !isExpanded) return
      const box = scrollContainerRef.current
      if (!box) return
      const maxScroll = box.scrollWidth - box.clientWidth
      if (maxScroll <= 0) return
      e.preventDefault()
      const next = box.scrollLeft + e.deltaY
      if (next <= 0 || next >= maxScroll) {
        e.stopPropagation()
      }
      box.scrollLeft = next
    }
    el.addEventListener('wheel', onWheel, { passive: false })
    return () => el.removeEventListener('wheel', onWheel)
  }, [isCollapsed, crowded, isExpanded])

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
    // 向该决斗者手牌拖入卡片即视为选定他，棋盘卡组区同步切换
    focusAsViewer()
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

  // 双击手牌区顶部信息条即可展开/收起（替代原先的独立「展开」按钮，少一个图标更好点）
  // 命中输入框 / 下拉框 / 按钮等交互元素时直接放行，避免与 LP 编辑、顺位选择冲突
  const handleHeaderDoubleClick = (e: React.MouseEvent<HTMLDivElement>): void => {
    if (isOnlyOne) return
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
        ref={ref}
        onClick={() => {
          focusAsViewer()
          onExpand()
        }}
        onDragEnter={handleDragEnter}
        onDragLeave={handleDragLeave}
        onDragOver={handleDragOver}
        onDrop={handleDrop}
        title={`点击展开 ${duelist.name} 的全部手牌（${cards.length} 张，行动顺位：第 ${currentOrder} 位）`}
        className={cn(
          'w-9 shrink-0 h-[136px] rounded border-2 transition-all cursor-pointer select-none flex flex-col items-center justify-between py-1 px-0.5',
          isActiveViewer && 'ring-2 ring-primary ring-offset-1 ring-offset-background',
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
      ref={mergeRefs(ref, stripRef)}
      onDragEnter={() => setIsDragOver(true)}
      onDragLeave={() => setIsDragOver(false)}
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
      {/* 头部信息条：手牌张数、LP、顺位选择；单击切换查看归属，双击展开/收起 */}
      <div
        onDoubleClick={handleHeaderDoubleClick}
        onClick={(e) => {
          const target = e.target as HTMLElement | null
          if (target?.closest('input, select, textarea, button, a, [data-no-expand]')) return
          focusAsViewer()
        }}
        title={
          isActiveViewer
            ? isOnlyOne
              ? `正在查看 ${duelist.name} 的卡组`
              : `正在查看 ${duelist.name} 的卡组 · 双击收起为并排展示`
            : isOnlyOne
              ? `点击切换：棋盘卡组区显示 ${duelist.name} 的`
              : `点击切换查看 ${duelist.name} 的卡组 · 双击展开占满整行`
        }
        className="flex items-center justify-between text-xs px-0.5 shrink-0 gap-1 h-5 cursor-pointer"
      >
        <div className="flex items-center gap-1 min-w-0">
          {/* 手牌张数（角色名统一在顶栏名字芯片展示，本栏不再重复） */}
          <span className="text-[10px] text-muted-foreground shrink-0 font-mono">
            ({cards.length})
          </span>
        </div>

        {/* 右侧：LP 编辑（仅在独立 LP 模式下显示）、顺位选择 */}
        <div className="flex items-center gap-1 shrink-0" data-no-expand>
          {/* LP 修改 (仅在独立 LP 时由决斗者各自持有；队伍共用 LP 时属于队伍统一管理) */}
          {!isSharedLp && (
            // 一律向下展开：本栏处于 MultiHandTray 的横向滚动行内，该行是 overflow-y-hidden，
            // 向上弹出的弹层会整块被裁掉（此前「下方我方栏看不到弹层」的根因）；向下展开则
            // 落在本栏 136px 高度内，上下两方都能正常看到与点击。
            <LpInput
              lp={duelist.lp}
              label="LP"
              size="sm"
              player={controller}
              popoverPlacement="bottom"
              onLpChange={(newLp) => updateDuelist(duelist.id, { lp: newLp })}
            />
          )}

          {/* 行动顺位下拉选择 */}
          <TurnOrderBadge duelist={duelist} totalCount={totalCount || 2} />
        </div>
      </div>

      {/* 手牌卡片排布横向滚动槽位 (永远不换行)；点击（含点手牌本体）即切换查看归属 */}
      <div
        ref={scrollContainerRef}
        onClick={focusAsViewer}
        onDragOver={handleDragOver}
        onDrop={handleDrop}
        className={cn(
          'flex-1 w-full px-1 py-1 rounded border border-dashed flex items-center gap-1 overflow-x-auto overflow-y-hidden transition-colors cursor-pointer',
          // 拥挤模式下隐藏本栏滚动条：横向滚动只保留「排布行」那一层，避免两条并存
          crowded && !isExpanded && 'scrollbar-none',
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
