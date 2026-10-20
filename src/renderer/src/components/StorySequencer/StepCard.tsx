import React from 'react'
import { ACTION_TYPE_COLORS, DuelStep } from '@shared/index'
import { useDuelStore } from '../../stores/useDuelStore'
import { useDuelEngineStore } from '../../stores/useDuelEngineStore'
import { CardImage } from '../ui/CardImage'
import { Tooltip, TooltipTrigger, TooltipContent } from '../ui/tooltip'
import { Button } from '../ui/button'
import {
  BookOpen,
  ChevronDown,
  ChevronUp,
  Crosshair,
  Layers,
  MessageSquare,
  PlayCircle,
  Trash2,
  ArrowRight
} from 'lucide-react'
import { cn } from '../../lib/utils'
import { duelActionLabel, getLocationDisplayName, resolveStepCardName } from './stepGrouping'

interface StepCardProps {
  step: DuelStep
  index: number
  stepsLength: number
  isCurrentPlaying: boolean
  isFutureStep: boolean
  stepEngineIndex: number | undefined
  onEdit: (step: DuelStep) => void
  onRestart: (index: number, step: DuelStep) => void
  onClick: (index: number, step: DuelStep) => void
}

export const StepCard: React.FC<StepCardProps> = ({
  step,
  index,
  stepsLength,
  isCurrentPlaying,
  isFutureStep,
  stepEngineIndex,
  onEdit,
  onRestart,
  onClick
}: StepCardProps) => {
  const { setHoveredInstanceId, moveStep, deleteStep, openScreenplayWithStep } = useDuelStore()
  const engineActive = useDuelEngineStore((s) => s.isInitialized)
  const isReplay = useDuelEngineStore((s) => s.replayInfo !== null)
  const colorTheme = ACTION_TYPE_COLORS[step.actionType] || ACTION_TYPE_COLORS.NORMAL_SUMMON
  const actionLabel = duelActionLabel(step)
  const hasBoardSnapshot = Boolean(step.boardAfter && step.boardAfter.length > 0)
  const playableFromHere = hasBoardSnapshot && stepEngineIndex === undefined
  const displayCardName = resolveStepCardName(step)
  const fromName = getLocationDisplayName(step.fromLocation, step.fromSequence)
  const toName = getLocationDisplayName(step.toLocation, step.toSequence)

  return (
    <div className="flex flex-col gap-1.5">
      <div
        onClick={() => onClick(index, step)}
        onMouseEnter={() => {
          setHoveredInstanceId(step.targetInstanceId ?? step.instanceId ?? null)
        }}
        onMouseLeave={() => setHoveredInstanceId(null)}
        title={isFutureStep ? '未来步：点击前进到这一步' : undefined}
        className={cn(
          'group relative flex flex-col gap-1.5 p-2 rounded-lg border transition-all cursor-pointer select-none',
          isCurrentPlaying
            ? 'border-primary/60 ring-2 ring-primary/25 bg-card/90 shadow-md'
            : isFutureStep
              ? 'border-dashed border-border/70 bg-muted/10 opacity-55 hover:opacity-100 hover:border-primary/40'
              : step.actionPlayer === 0
                ? 'border-blue-500/30 bg-muted/20 hover:border-blue-500/60 hover:bg-muted/30'
                : 'border-rose-500/30 bg-muted/20 hover:border-rose-500/60 hover:bg-muted/30'
        )}
      >
        <div className="flex items-center gap-2">
          {step.cardCode ? (
            <div className="w-9 h-[52px] rounded overflow-hidden border border-border/80 bg-black/60 shrink-0 shadow-sm relative">
              <CardImage
                code={step.cardCode}
                small
                alt={displayCardName}
                className="w-full h-full object-cover"
              />
            </div>
          ) : (
            <div className="w-9 h-[52px] rounded border border-dashed border-border/70 flex items-center justify-center shrink-0 text-muted-foreground/50">
              <Layers className="w-4 h-4" />
            </div>
          )}

          <div className="flex-1 min-w-0 flex flex-col gap-0.5">
            <div className="flex items-center justify-between gap-1">
              <div className="flex items-center gap-1 truncate">
                <span
                  className={cn(
                    'text-[10px] font-bold px-1 rounded truncate',
                    step.actionPlayer === 0
                      ? 'text-blue-400 bg-blue-500/10'
                      : 'text-rose-400 bg-rose-500/10'
                  )}
                >
                  {step.actionPlayer === 0 ? '我方' : '对方'}
                </span>
                <Tooltip>
                  <TooltipTrigger
                    render={
                      <span className="font-bold text-xs text-foreground truncate">
                        {displayCardName}
                      </span>
                    }
                  />
                  <TooltipContent>{displayCardName}</TooltipContent>
                </Tooltip>
              </div>

              <span
                className={cn(
                  'text-[10px] font-bold px-1.5 py-0.5 rounded border shrink-0',
                  colorTheme.bg,
                  colorTheme.text,
                  colorTheme.border
                )}
              >
                {actionLabel}
              </span>
            </div>

            <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground font-mono mt-0.5">
              {fromName && toName && (
                <span className="flex items-center gap-1 truncate">
                  <span>{fromName}</span>
                  <ArrowRight className="w-2.5 h-2.5 text-muted-foreground/60" />
                  <span className="text-foreground/90 font-semibold">{toName}</span>
                </span>
              )}
              {step.chainIndex && step.chainIndex > 0 && (
                <span className="bg-teal-500/20 text-teal-400 font-bold px-1 rounded ml-auto">
                  C{step.chainIndex}
                </span>
              )}
              {isFutureStep && (
                <span
                  className={cn(
                    'text-[9px] font-bold px-1 rounded border border-dashed border-muted-foreground/40 text-muted-foreground',
                    !step.chainIndex || step.chainIndex <= 0 ? 'ml-auto' : ''
                  )}
                >
                  未来步
                </span>
              )}
            </div>

            {step.targetCardName && (
              <div className="flex items-center gap-1 text-[10px] text-muted-foreground mt-0.5">
                <Crosshair className="w-2.5 h-2.5 shrink-0 text-cyan-400/80" />
                <span className="truncate">
                  目标：
                  <span className="text-foreground/90 font-semibold">{step.targetCardName}</span>
                </span>
              </div>
            )}
          </div>
        </div>

        {(step.dialogue || step.speaker || step.innerThoughts) && (
          <Tooltip>
            <TooltipTrigger
              render={
                <div
                  onClick={(e) => {
                    e.stopPropagation()
                    openScreenplayWithStep(step.id)
                  }}

                  className="mt-0.5 p-1.5 rounded bg-background/80 hover:bg-background border border-border/50 hover:border-foreground/30 cursor-pointer text-[11px] leading-relaxed flex flex-col gap-0.5 transition-colors"
                >
                  {step.speaker && (
                    <span className="font-bold text-[10px] text-foreground">
                      【{step.speaker}】:
                    </span>
                  )}
                  {step.dialogue && (
                    <span className="text-foreground/90 italic">“{step.dialogue}”</span>
                  )}
                  {step.innerThoughts && (
                    <span className="text-sky-400/90 text-[10px] italic">
                      （心理：{step.innerThoughts}）
                    </span>
                  )}
                </div>
              }
            />
            <TooltipContent>点击进入大屏决斗台本工作台精修台词与剧情</TooltipContent>
          </Tooltip>
        )}

        {!isReplay && (
          <div className="absolute top-1.5 right-1.5 opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-0.5 bg-background/90 backdrop-blur-xs p-0.5 rounded border border-border shadow-sm">
            {hasBoardSnapshot && playableFromHere && (
              <Tooltip>
                <TooltipTrigger
                  render={
                    <Button
                      size="icon-xs"
                      variant="ghost"
                      onClick={(e) => {
                        e.stopPropagation()
                        onRestart(index, step)
                      }}
                      className="h-5 w-5 text-emerald-500 hover:text-emerald-400"
                    >
                      <PlayCircle className="w-3 h-3" />
                    </Button>
                  }
                />
                <TooltipContent>
                  {engineActive
                    ? '以这一步的场面重开引擎，从这里继续编排'
                    : '以这一步的场面启动引擎，从这里继续编排'}
                </TooltipContent>
              </Tooltip>
            )}
            <Tooltip>
              <TooltipTrigger
                render={
                  <Button
                    size="icon-xs"
                    variant="ghost"
                    onClick={(e) => {
                      e.stopPropagation()
                      openScreenplayWithStep(step.id)
                    }}

                    className="h-5 w-5 text-muted-foreground hover:text-foreground"
                  >
                    <BookOpen className="w-3 h-3" />
                  </Button>
                }
              />
              <TooltipContent>在决斗台本工作台中精修台词与剧情</TooltipContent>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger
                render={
                  <Button
                    size="icon-xs"
                    variant="ghost"
                    disabled={index === 0}
                    onClick={(e) => {
                      e.stopPropagation()
                      moveStep(step.id, 'up')
                    }}

                    className="h-5 w-5"
                  >
                    <ChevronUp className="w-3 h-3" />
                  </Button>
                }
              />
              <TooltipContent>上移此步骤</TooltipContent>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger
                render={
                  <Button
                    size="icon-xs"
                    variant="ghost"
                    disabled={index === stepsLength - 1}
                    onClick={(e) => {
                      e.stopPropagation()
                      moveStep(step.id, 'down')
                    }}

                    className="h-5 w-5"
                  >
                    <ChevronDown className="w-3 h-3" />
                  </Button>
                }
              />
              <TooltipContent>下移此步骤</TooltipContent>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger
                render={
                  <Button
                    size="icon-xs"
                    variant="ghost"
                    onClick={(e) => {
                      e.stopPropagation()
                      onEdit(step)
                    }}

                    className="h-5 w-5 text-blue-500 hover:text-blue-400"
                  >
                    <MessageSquare className="w-3 h-3" />
                  </Button>
                }
              />
              <TooltipContent>编辑此步骤</TooltipContent>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger
                render={
                  <Button
                    size="icon-xs"
                    variant="ghost"
                    onClick={(e) => {
                      e.stopPropagation()
                      deleteStep(step.id)
                    }}

                    className="h-5 w-5 text-muted-foreground hover:text-destructive"
                  >
                    <Trash2 className="w-3 h-3" />
                  </Button>
                }
              />
              <TooltipContent>删除此步骤</TooltipContent>
            </Tooltip>
          </div>
        )}
      </div>
    </div>
  )
}
