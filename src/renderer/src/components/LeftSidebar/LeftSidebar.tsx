import React, { JSX } from 'react'
import { BookOpen, Bot, FolderKanban, Settings2 } from 'lucide-react'
import { useDuelStore } from '../../stores/useDuelStore'
import { useAgentStore } from '../../stores/useAgentStore'
import { CardDetailPanel } from '../CardDetail/CardDetailPanel'
import { BehindSpiritPanel } from '../BehindSpirit/BehindSpiritPanel'
import { DuelArchivesPanel } from './DuelArchivesPanel'
import { cn } from '../../lib/utils'

export function LeftSidebar(): JSX.Element {
  const { activeLeftTab, isLeftOpen, leftWidth, toggleLeftTab, setLeftWidth } = useDuelStore()

  const { isGenerating, setOpen: setAgentStoreOpen } = useAgentStore()

  // 处理拖拽右边缘调整左侧栏宽度
  const handleResizeMouseDown = (e: React.MouseEvent): void => {
    e.preventDefault()
    const startX = e.clientX
    const startWidth = leftWidth

    const handleMouseMove = (moveEvent: MouseEvent): void => {
      const deltaX = moveEvent.clientX - startX
      setLeftWidth(startWidth + deltaX)
    }

    const handleMouseUp = (): void => {
      window.removeEventListener('mousemove', handleMouseMove)
      window.removeEventListener('mouseup', handleMouseUp)
    }

    window.addEventListener('mousemove', handleMouseMove)
    window.addEventListener('mouseup', handleMouseUp)
  }

  const handleArchivesClick = (): void => {
    toggleLeftTab('archives')
  }

  const handleCardClick = (): void => {
    toggleLeftTab('card')
  }

  const handleAgentClick = (): void => {
    toggleLeftTab('agent')
    if (!isLeftOpen || activeLeftTab !== 'agent') {
      setAgentStoreOpen(true)
    }
  }

  return (
    <aside className="h-full flex shrink-0 select-none overflow-hidden">
      {/* VSCode 风格最左侧活动栏 (Activity Bar: 标准 48px 宽度) */}
      <div className="w-12 h-full border-r border-border bg-muted/40 dark:bg-neutral-900/80 flex flex-col items-center justify-start py-2 shrink-0 select-none z-10">
        {/* 顶部主工作区选项卡 (决斗档案 / 卡片详情 / 背后灵) */}
        <div className="flex flex-col items-center gap-1 w-full">
          {/* 1. 决斗档案 (整局、残局与 Combo 展开) */}
          <div className="w-full flex justify-center relative">
            {isLeftOpen && activeLeftTab === 'archives' && (
              <span className="absolute left-0 top-1 bottom-1 w-[2.5px] bg-primary rounded-r" />
            )}
            <button
              type="button"
              onClick={handleArchivesClick}
              title={
                isLeftOpen && activeLeftTab === 'archives'
                  ? '收起决斗档案'
                  : '决斗档案 (浏览与载入已保存的整局、残局与 Combo 展开)'
              }
              className={cn(
                'w-9 h-9 rounded-md flex items-center justify-center transition-all relative',
                isLeftOpen && activeLeftTab === 'archives'
                  ? 'text-foreground bg-accent/60 shadow-xs'
                  : 'text-muted-foreground hover:text-foreground hover:bg-muted/70'
              )}
            >
              <FolderKanban className="w-[18px] h-[18px]" />
            </button>
          </div>

          {/* 2. 卡片详情 */}
          <div className="w-full flex justify-center relative">
            {isLeftOpen && activeLeftTab === 'card' && (
              <span className="absolute left-0 top-1 bottom-1 w-[2.5px] bg-primary rounded-r" />
            )}
            <button
              type="button"
              onClick={handleCardClick}
              title={
                isLeftOpen && activeLeftTab === 'card'
                  ? '收起卡片详情'
                  : '卡片详情 (查阅选定卡片的大图与详细效果)'
              }
              className={cn(
                'w-9 h-9 rounded-md flex items-center justify-center transition-all relative',
                isLeftOpen && activeLeftTab === 'card'
                  ? 'text-foreground bg-accent/60 shadow-xs'
                  : 'text-muted-foreground hover:text-foreground hover:bg-muted/70'
              )}
            >
              <BookOpen className="w-[18px] h-[18px]" />
            </button>
          </div>

          {/* 3. 背后灵 (伴随式 AI 决斗推演顾问) */}
          <div className="w-full flex justify-center relative">
            {isLeftOpen && activeLeftTab === 'agent' && (
              <span className="absolute left-0 top-1 bottom-1 w-[2.5px] bg-primary rounded-r" />
            )}
            <button
              type="button"
              onClick={handleAgentClick}
              title={
                isLeftOpen && activeLeftTab === 'agent'
                  ? '收起背后灵'
                  : '背后灵 (伴随式 AI 决斗推演与台本顾问)'
              }
              className={cn(
                'w-9 h-9 rounded-md flex items-center justify-center transition-all relative',
                isLeftOpen && activeLeftTab === 'agent'
                  ? 'text-foreground bg-accent/60 shadow-xs'
                  : 'text-muted-foreground hover:text-foreground hover:bg-muted/70'
              )}
            >
              <Bot
                className={cn('w-[18px] h-[18px]', isGenerating && 'animate-pulse text-amber-500')}
              />

              {/* 生成中动态呼吸小圆点 */}
              {isGenerating && (
                <span className="absolute top-1.5 right-1.5 w-1.5 h-1.5 rounded-full bg-amber-500 animate-ping" />
              )}
            </button>
          </div>
        </div>

        {/* 底部固定：全局设置 (VSCode 风格入口，打开独立设置窗口) */}
        <div className="mt-auto flex flex-col items-center gap-1 w-full">
          <button
            type="button"
            onClick={() => void window.api.openSettingsWindow()}
            title="设置 (打开全局设置窗口：外观、路径与目录、AI 顾问)"
            className="w-9 h-9 rounded-md flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted/70 transition-all"
          >
            <Settings2 className="w-[18px] h-[18px]" />
          </button>
        </div>
      </div>

      {/* 左侧主内容面板 (当 isLeftOpen 为 true 时展开，支持右侧边缘拖拽调整宽度) */}
      {isLeftOpen && (
        <div
          style={{ width: leftWidth }}
          className="h-full flex flex-col shrink-0 overflow-hidden relative border-r border-border bg-card/40 transition-[width] duration-75"
        >
          {/* 右侧拖拽把手 */}
          <div
            onMouseDown={handleResizeMouseDown}
            className="absolute right-0 top-0 bottom-0 w-1 cursor-col-resize hover:w-1.5 hover:bg-amber-500/80 active:bg-amber-500 transition-all z-30"
            title="拖拽调整左侧栏宽度"
          />

          {/* 根据活动项渲染对应模态 */}
          {activeLeftTab === 'archives' ? (
            <DuelArchivesPanel />
          ) : activeLeftTab === 'card' ? (
            <CardDetailPanel />
          ) : (
            <BehindSpiritPanel />
          )}
        </div>
      )}
    </aside>
  )
}
