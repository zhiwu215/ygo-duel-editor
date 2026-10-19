import React from 'react'
import { ACTION_TYPE_COLORS, ACTION_TYPE_NAMES, DuelStep, PHASE_SHORT_NAMES } from '@shared/index'
import { Tooltip, TooltipTrigger, TooltipContent } from '../ui/tooltip'
import { ScrollArea } from '../ui/scroll-area'
import { Button } from '../ui/button'
import { CardImage } from '../ui/CardImage'
import { Film, Plus, Layers, MessageSquare } from 'lucide-react'
import { cn } from '../../lib/utils'
import { stepCardName } from '../../utils/cardNames'
import { isFirstInPhase, isFirstInTurn } from './stepGrouping'

interface ScreenplayOutlineListProps {
  steps: DuelStep[]
  activeStep: DuelStep | undefined
  onSelectStep: (id: string) => void
  onInsertAfterCurrent: () => void
}

export const ScreenplayOutlineList: React.FC<ScreenplayOutlineListProps> = ({
  steps,
  activeStep,
  onSelectStep,
  onInsertAfterCurrent
}) => {
  return (
    <div className="w-[340px] h-full border-r border-border/70 bg-muted/15 flex flex-col shrink-0 overflow-hidden">
      <div className="p-2.5 border-b border-border/60 bg-muted/20 flex items-center justify-between shrink-0">
        <span className="font-semibold text-xs text-muted-foreground flex items-center gap-1.5">
          <Film className="w-3.5 h-3.5" />
          <span>对局动作大纲 ({steps.length})</span>
        </span>
        <Button
          size="xs"
          variant="outline"
          onClick={onInsertAfterCurrent}
          className="h-6 text-[11px] gap-1 font-medium"
        >
          <Plus className="w-3 h-3" />
          <span>加动作</span>
        </Button>
      </div>

      <ScrollArea className="flex-1 min-h-0">
        <div className="p-2 flex flex-col gap-1.5">
          {steps.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center p-6 text-center text-muted-foreground text-xs">
              <p className="font-semibold text-foreground/80">尚无任何动作节点</p>
              <p className="text-[11px] text-muted-foreground/60 mt-1">
                点击右上角「加动作」建立对局大纲
              </p>
            </div>
          ) : (
            steps.map((s, idx) => {
              const isSelected = activeStep?.id === s.id

              const hasScript = Boolean(s.dialogue || s.speaker || s.innerThoughts)
              const color = ACTION_TYPE_COLORS[s.actionType]
              const actName = ACTION_TYPE_NAMES[s.actionType] || s.actionType

              return (
                <div key={s.id} className="flex flex-col gap-1">
                  {isFirstInTurn(steps, idx) && (
                    <div className="flex items-center justify-between px-2 py-1 rounded bg-muted/50 border border-border/70 text-[11px] font-bold text-foreground mt-1">
                      <span>第 {s.turn} 回合</span>
                      <span className="text-[10px] font-normal text-muted-foreground">
                        {s.turnPlayer === 0 ? '我方回合' : '对方回合'}
                      </span>
                    </div>
                  )}
                  {isFirstInPhase(steps, idx) && (
                    <div className="text-[10px] text-muted-foreground font-semibold px-1 pt-0.5">
                      {PHASE_SHORT_NAMES[s.phase] || s.phase}
                    </div>
                  )}

                  <div
                    onClick={() => onSelectStep(s.id)}
                    className={cn(
                      'p-2 rounded-lg border transition-all cursor-pointer flex items-center gap-2 select-none',
                      isSelected
                        ? 'border-primary/50 bg-primary/8 shadow-sm ring-1 ring-primary/25'
                        : 'border-border/60 bg-card/60 hover:bg-muted/40 hover:border-border'
                    )}
                  >
                    <span className="font-mono text-[10px] font-bold text-muted-foreground shrink-0 w-4">
                      {idx + 1}
                    </span>

                    {s.cardCode ? (
                      <CardImage
                        code={s.cardCode}
                        small
                        alt={stepCardName(s)}
                        className="w-7 h-10 object-cover rounded border border-border/80 shrink-0"
                      />
                    ) : (
                      <div className="w-7 h-10 rounded border border-dashed border-border/80 flex items-center justify-center shrink-0 text-muted-foreground/60">
                        <Layers className="w-3.5 h-3.5" />
                      </div>
                    )}

                    <div className="flex-1 min-w-0 flex flex-col gap-0.5">
                      <div className="flex items-center justify-between gap-1">
                        <span
                          className={cn(
                            'text-[9px] font-bold px-1 rounded truncate',
                            s.actionPlayer === 0
                              ? 'text-blue-400 bg-blue-500/10'
                              : 'text-rose-400 bg-rose-500/10'
                          )}
                        >
                          {s.actionPlayer === 0 ? '我方' : '对方'}
                        </span>
                        <span
                          className={cn(
                            'text-[9px] font-bold px-1 py-0.2 rounded border truncate',
                            color.bg,
                            color.text,
                            color.border
                          )}
                        >
                          {actName}
                        </span>
                      </div>

                      <Tooltip>
                        <TooltipTrigger
                          render={
                            <span className="font-bold text-xs text-foreground truncate">
                              {stepCardName(s) || '动作事件'}
                            </span>
                          }
                        />
                        <TooltipContent>{stepCardName(s) || '未指定卡片'}</TooltipContent>
                      </Tooltip>

                      <div className="flex items-center gap-1 text-[10px] text-muted-foreground truncate">
                        {hasScript ? (
                          <span className="text-foreground flex items-center gap-1 truncate font-medium">
                            <MessageSquare className="w-2.5 h-2.5 shrink-0" />
                            <span className="truncate">{s.dialogue || s.speaker}</span>
                          </span>
                        ) : (
                          <span className="text-muted-foreground/50 italic text-[9px]">
                            待补充台词
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              )
            })
          )}
        </div>
      </ScrollArea>
    </div>
  )
}
