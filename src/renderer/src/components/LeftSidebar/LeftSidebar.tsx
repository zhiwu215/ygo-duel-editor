import { Tooltip, TooltipTrigger, TooltipContent } from '../ui/tooltip'
import { JSX } from 'react'
import { BookOpen, Bot, FolderKanban, Settings } from 'lucide-react'
import { useDuelStore } from '../../stores/useDuelStore'
import { useAgentStore } from '../../stores/useAgentStore'
import { usePanelResize } from '../../hooks/usePanelResize'
import { CardDetailPanel } from '../CardDetail/CardDetailPanel'
import { BehindSpiritPanel } from '../BehindSpirit/BehindSpiritPanel'
import { DuelArchivesPanel } from './DuelArchivesPanel'
import { cn } from '../../lib/utils'

export function LeftSidebar(): JSX.Element {
  const { activeLeftTab, isLeftOpen, leftWidth, toggleLeftTab, setLeftWidth } = useDuelStore()

  const { isGenerating, setOpen: setAgentStoreOpen } = useAgentStore()

  const handleResizeMouseDown = usePanelResize(() => leftWidth, setLeftWidth)

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
      <div className="w-12 h-full border-r border-border bg-muted/40 dark:bg-neutral-900/80 flex flex-col items-center justify-start py-2 shrink-0 select-none z-10">
        <div className="flex flex-col items-center gap-1 w-full">
          <div className="w-full flex justify-center relative">
            {isLeftOpen && activeLeftTab === 'archives' && (
              <span className="absolute left-0 top-1 bottom-1 w-[2.5px] bg-primary rounded-r" />
            )}
            <Tooltip>
              <TooltipTrigger
                render={
                  <button
                    type="button"
                    onClick={handleArchivesClick}
                    className={cn(
                      'w-9 h-9 rounded-md flex items-center justify-center transition-all relative',
                      isLeftOpen && activeLeftTab === 'archives'
                        ? 'text-foreground bg-accent/60 shadow-xs'
                        : 'text-muted-foreground hover:text-foreground hover:bg-muted/70'
                    )}
                  >
                    <FolderKanban className="w-[18px] h-[18px]" />
                  </button>
                }
              />
              <TooltipContent>
                {isLeftOpen && activeLeftTab === 'archives'
                  ? '收起决斗档案'
                  : '决斗档案 (浏览与载入已保存的整局、残局与 Combo 展开)'}
              </TooltipContent>
            </Tooltip>
          </div>

          <div className="w-full flex justify-center relative">
            {isLeftOpen && activeLeftTab === 'card' && (
              <span className="absolute left-0 top-1 bottom-1 w-[2.5px] bg-primary rounded-r" />
            )}
            <Tooltip>
              <TooltipTrigger
                render={
                  <button
                    type="button"
                    onClick={handleCardClick}
                    className={cn(
                      'w-9 h-9 rounded-md flex items-center justify-center transition-all relative',
                      isLeftOpen && activeLeftTab === 'card'
                        ? 'text-foreground bg-accent/60 shadow-xs'
                        : 'text-muted-foreground hover:text-foreground hover:bg-muted/70'
                    )}
                  >
                    <BookOpen className="w-[18px] h-[18px]" />
                  </button>
                }
              />
              <TooltipContent>
                {isLeftOpen && activeLeftTab === 'card'
                  ? '收起卡片详情'
                  : '卡片详情 (查阅选定卡片的大图与详细效果)'}
              </TooltipContent>
            </Tooltip>
          </div>

          <div className="w-full flex justify-center relative">
            {isLeftOpen && activeLeftTab === 'agent' && (
              <span className="absolute left-0 top-1 bottom-1 w-[2.5px] bg-primary rounded-r" />
            )}
            <Tooltip>
              <TooltipTrigger
                render={
                  <button
                    type="button"
                    onClick={handleAgentClick}
                    className={cn(
                      'w-9 h-9 rounded-md flex items-center justify-center transition-all relative',
                      isLeftOpen && activeLeftTab === 'agent'
                        ? 'text-foreground bg-accent/60 shadow-xs'
                        : 'text-muted-foreground hover:text-foreground hover:bg-muted/70'
                    )}
                  >
                    <Bot
                      className={cn(
                        'w-[18px] h-[18px]',
                        isGenerating && 'animate-pulse text-amber-500'
                      )}
                    />

                    {isGenerating && (
                      <span className="absolute top-1.5 right-1.5 w-1.5 h-1.5 rounded-full bg-amber-500 animate-ping" />
                    )}
                  </button>
                }
              />
              <TooltipContent>
                {isLeftOpen && activeLeftTab === 'agent'
                  ? '收起背后灵'
                  : '背后灵 (伴随式 AI 决斗推演与台本顾问)'}
              </TooltipContent>
            </Tooltip>
          </div>
        </div>

        <div className="mt-auto flex flex-col items-center gap-1 w-full">
          <Tooltip>
            <TooltipTrigger
              render={
                <button
                  type="button"
                  onClick={() => void window.api.openSettingsWindow()}
                  className="w-9 h-9 rounded-md flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted/70 transition-all"
                >
                  <Settings className="w-[18px] h-[18px]" />
                </button>
              }
            />
            <TooltipContent>设置 (打开全局设置窗口：外观、路径与目录、背后灵)</TooltipContent>
          </Tooltip>
        </div>
      </div>

      {isLeftOpen && (
        <div
          style={{ width: leftWidth }}
          className="h-full flex flex-col shrink-0 overflow-hidden relative border-r border-border bg-card/40 transition-[width] duration-75"
        >
          <Tooltip>
            <TooltipTrigger
              render={
                <div
                  onMouseDown={handleResizeMouseDown}
                  className="absolute right-0 top-0 bottom-0 w-1 cursor-col-resize hover:w-1.5 hover:bg-primary/60 active:bg-primary transition-all z-30"
                />
              }
            />
            <TooltipContent>拖拽调整左侧栏宽度</TooltipContent>
          </Tooltip>

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
