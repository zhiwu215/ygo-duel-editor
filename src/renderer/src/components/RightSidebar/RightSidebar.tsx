import React, { useEffect, useRef } from 'react'
import { Search, Film } from 'lucide-react'
import { useDuelStore } from '../../stores/useDuelStore'
import { useCardSearchStore } from '../../stores/useCardSearchStore'
import { useDuelEngineStore } from '../../stores/useDuelEngineStore'
import { EngineTimelineNode } from '@shared/index'
import { CardSearchPanel } from '../CardSearch/CardSearchPanel'
import { FilterDrawer } from '../CardSearch/FilterDrawer'
import { StepSequencerPanel } from '../StorySequencer/StepSequencerPanel'
import { cn } from '../../lib/utils'

/** 时间轴圆点配色：玩家 0 = 蓝，玩家 1 = 玫瑰 */
const DOT_BG: Record<0 | 1, string> = { 0: 'bg-blue-500', 1: 'bg-rose-500' }
const DOT_RING: Record<0 | 1, string> = { 0: 'ring-blue-400/70', 1: 'ring-rose-400/70' }

/** 节点圆点样式：当前节点放大 + 玩家色外环 + 呼吸动画；普通节点悬停微放大 */
function dotClass(player: 0 | 1, isCurrent: boolean): string {
  return cn(
    'rounded-full transition-all duration-150',
    DOT_BG[player],
    isCurrent
      ? cn('w-2.5 h-2.5 ring-2 animate-pulse shadow-sm', DOT_RING[player])
      : 'w-1.5 h-1.5 opacity-75 group-hover:opacity-100 group-hover:scale-150'
  )
}

interface TimelineDotProps {
  node: EngineTimelineNode
  isCurrent: boolean
  disabled: boolean
  ref?: React.Ref<HTMLButtonElement>
  onJump: () => void
}

/** 时间轴节点：hover 显露步骤摘要（title），点击跳转到该步 */
function TimelineDot({
  node,
  isCurrent,
  disabled,
  ref,
  onJump
}: TimelineDotProps): React.JSX.Element {
  return (
    <button
      ref={ref}
      type="button"
      title={`${node.stepNumber}: ${node.title}`}
      aria-label={`第 ${node.stepNumber} 步：${node.title}`}
      aria-current={isCurrent ? 'step' : undefined}
      disabled={disabled}
      onClick={onJump}
      className="group w-4 h-5 shrink-0 flex items-center justify-center rounded-sm transition-colors hover:bg-muted/70 disabled:pointer-events-none"
    >
      <span className={dotClass(node.player, isCurrent)} />
    </button>
  )
}

/**
 * 右栏（固定列，常驻不浮层）：80 宽度主操作栏，与棋盘并列。
 * 顶部双模态选项卡：[🔍 卡片检索] | [🎬 步骤编排]；
 * 步骤编排内容区顶部常驻横向时间轴（引擎时间线，点击跳步、当前高亮 + 自动滚动）。
 */
export const RightSidebar: React.FC = () => {
  const { activeRightTab, setActiveRightTab, state } = useDuelStore()
  const { isFilterOpen } = useCardSearchStore()
  const { timeline, currentStepId, isInitialized, loading, jumpToStep } = useDuelEngineStore()

  const barCurrentRef = useRef<HTMLButtonElement | null>(null)

  const stepCount = state.steps?.length || 0
  const engineActive = isInitialized && timeline.length > 0

  // 横向时间轴：切到步骤 tab / 当前节点变化时自动滚动到可见位置
  useEffect(() => {
    if (activeRightTab !== 'steps' || !engineActive) return
    barCurrentRef.current?.scrollIntoView({ block: 'nearest', inline: 'nearest' })
  }, [activeRightTab, currentStepId, engineActive])

  const handleJump = (stepId: string): void => {
    if (loading || stepId === currentStepId) return
    void jumpToStep(stepId)
  }

  return (
    <aside className="h-full border-l border-border bg-card/40 flex shrink-0 select-none overflow-hidden">
      {/* 80 宽度主操作栏（固定宽度与卡片详情对称，确保中央决斗台空间充足） */}
      <div className="w-80 h-full flex flex-col shrink-0 overflow-hidden">
        {/* 顶部双模态选项卡切换条：[🔍 卡片检索] | [🎬 步骤编排] */}
        <div className="p-1.5 border-b border-border/70 bg-muted/25 shrink-0">
          <div className="grid grid-cols-2 p-0.5 bg-background/90 rounded-lg border border-border/70 shadow-inner">
            <button
              type="button"
              onClick={() => setActiveRightTab('search')}
              className={cn(
                'flex items-center justify-center gap-1.5 py-1 px-3 text-xs font-semibold rounded-md transition-all',
                activeRightTab === 'search'
                  ? 'bg-primary text-primary-foreground shadow-xs'
                  : 'text-muted-foreground hover:text-foreground'
              )}
            >
              <Search className="w-3.5 h-3.5" />
              <span>卡片检索</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveRightTab('steps')}
              className={cn(
                'flex items-center justify-center gap-1.5 py-1 px-3 text-xs font-semibold rounded-md transition-all relative',
                activeRightTab === 'steps'
                  ? 'bg-primary text-primary-foreground shadow-xs'
                  : 'text-muted-foreground hover:text-foreground'
              )}
            >
              <Film className="w-3.5 h-3.5" />
              <span>步骤编排</span>
              {stepCount > 0 && (
                <span
                  className={cn(
                    'text-[9px] font-mono font-bold px-1.5 py-0.2 rounded-full shadow-xs',
                    activeRightTab === 'steps'
                      ? 'bg-primary-foreground/20 text-primary-foreground'
                      : 'bg-muted text-muted-foreground border border-border'
                  )}
                >
                  {stepCount}
                </span>
              )}
            </button>
          </div>
        </div>

        {/* 动态内容区 (双模态切换) */}
        <div className="flex-1 min-h-0 overflow-hidden">
          {activeRightTab === 'search' ? (
            <CardSearchPanel />
          ) : (
            <div className="w-full h-full flex flex-col overflow-hidden">
              {/* 顶部横向时间轴（引擎时间线；当前高亮 + 自动滚动） */}
              <div className="shrink-0 flex items-center gap-2 px-2 py-1.5 border-b border-border/60 bg-muted/10 select-none">
                <span className="shrink-0 text-[9px] font-semibold tracking-wider text-muted-foreground/80">
                  时间轴
                </span>
                {engineActive ? (
                  <div className="flex-1 min-w-0 flex items-center overflow-x-auto overflow-y-hidden py-0.5">
                    {timeline.map((node) => {
                      const isCurrent = node.id === currentStepId
                      return (
                        <TimelineDot
                          key={node.id}
                          node={node}
                          isCurrent={isCurrent}
                          disabled={loading}
                          ref={isCurrent ? barCurrentRef : undefined}
                          onJump={() => handleJump(node.id)}
                        />
                      )
                    })}
                  </div>
                ) : (
                  <span className="text-[10px] text-muted-foreground/70">未启动引擎</span>
                )}
              </div>

              {/* 步骤编排列表 */}
              <div className="flex-1 min-h-0 overflow-hidden">
                <StepSequencerPanel />
              </div>
            </div>
          )}
        </div>
      </div>

      {/* 高级筛选抽屉 (仅在卡片检索激活且展开时并列滑出) */}
      {activeRightTab === 'search' && isFilterOpen && <FilterDrawer />}
    </aside>
  )
}
