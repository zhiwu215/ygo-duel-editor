import { JSX } from 'react'
import { BookOpen, Bot, FolderKanban, Settings } from 'lucide-react'
import { useDuelStore } from '../../stores/useDuelStore'
import { useAgentStore } from '../../stores/useAgentStore'
import { CardDetailPanel } from '../CardDetail/CardDetailPanel'
import { BehindSpiritPanel } from '../BehindSpirit/BehindSpiritPanel'
import { DuelDocumentLibraryPanel } from './DuelDocumentLibraryPanel'
import { cn } from '../../lib/utils'

export function LeftSidebar(): JSX.Element {
  const { activeLeftTab, isLeftOpen, toggleLeftTab } = useDuelStore()

  const { isGenerating } = useAgentStore()

  const handleArchivesClick = (): void => {
    toggleLeftTab('archives')
  }

  const handleCardClick = (): void => {
    toggleLeftTab('card')
  }

  const handleAgentClick = (): void => {
    toggleLeftTab('agent')
  }

  return (
    <aside className="h-full flex shrink-0 select-none overflow-hidden">
      <div className="w-12 h-full border-r border-border bg-muted/40 dark:bg-neutral-900/80 flex flex-col items-center justify-start py-2 shrink-0 select-none z-10">
        <div className="flex flex-col items-center gap-1 w-full">
          <div className="w-full flex justify-center relative">
            {isLeftOpen && activeLeftTab === 'archives' && (
              <span className="absolute left-0 top-1 bottom-1 w-[2.5px] bg-primary rounded-r" />
            )}
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
          </div>

          <div className="w-full flex justify-center relative">
            {isLeftOpen && activeLeftTab === 'card' && (
              <span className="absolute left-0 top-1 bottom-1 w-[2.5px] bg-primary rounded-r" />
            )}
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
          </div>

          <div className="w-full flex justify-center relative">
            {isLeftOpen && activeLeftTab === 'agent' && (
              <span className="absolute left-0 top-1 bottom-1 w-[2.5px] bg-primary rounded-r" />
            )}
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
                className={cn('w-[18px] h-[18px]', isGenerating && 'animate-pulse text-amber-500')}
              />

              {isGenerating && (
                <span className="absolute top-1.5 right-1.5 w-1.5 h-1.5 rounded-full bg-amber-500 animate-ping" />
              )}
            </button>
          </div>
        </div>

        <div className="mt-auto flex flex-col items-center gap-1 w-full">
          <button
            type="button"
            onClick={() => void window.api.openSettingsWindow()}
            className="w-9 h-9 rounded-md flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted/70 transition-all"
          >
            <Settings className="w-[18px] h-[18px]" />
          </button>
        </div>
      </div>

      {isLeftOpen && (
        <div className="w-[340px] h-full flex flex-col shrink-0 overflow-hidden border-r border-border bg-card/40">
          {activeLeftTab === 'archives' ? (
            <DuelDocumentLibraryPanel />
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
