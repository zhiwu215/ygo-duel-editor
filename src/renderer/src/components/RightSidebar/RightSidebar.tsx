import React from 'react'
import { Search, Film } from 'lucide-react'
import { useDuelStore } from '../../stores/useDuelStore'
import { useCardSearchStore } from '../../stores/useCardSearchStore'
import { CardSearchPanel } from '../CardSearch/CardSearchPanel'
import { FilterDrawer } from '../CardSearch/FilterDrawer'
import { StepSequencerPanel } from '../StorySequencer/StepSequencerPanel'
import { cn } from '../../lib/utils'

export const RightSidebar: React.FC = () => {
  const { activeRightTab, setActiveRightTab, state } = useDuelStore()
  const { isFilterOpen } = useCardSearchStore()
  const stepCount = state.steps?.length || 0

  return (
    <aside className="h-full border-l border-border bg-card/40 flex shrink-0 select-none overflow-hidden transition-all duration-200">
      {/* 80 宽度主操作栏 (固定宽度与卡片详情对称，确保中央决斗台空间充足) */}
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
          {activeRightTab === 'search' ? <CardSearchPanel /> : <StepSequencerPanel />}
        </div>
      </div>

      {/* 高级筛选抽屉 (仅在卡片检索激活且展开时并列滑出) */}
      {activeRightTab === 'search' && isFilterOpen && <FilterDrawer />}
    </aside>
  )
}
