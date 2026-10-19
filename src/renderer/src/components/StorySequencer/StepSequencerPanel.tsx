import React, { useState } from 'react'
import { DuelStep, PHASE_NAMES } from '@shared/index'
import { useDuelStore } from '../../stores/useDuelStore'
import { useDuelEngineStore } from '../../stores/useDuelEngineStore'
import { alertDialog } from '../../stores/useDialogStore'
import { useStepPlayback } from '../../hooks/useStepPlayback'
import { Tooltip, TooltipTrigger, TooltipContent } from '../ui/tooltip'
import { Badge } from '../ui/badge'
import { Button } from '../ui/button'
import { StepList } from './StepList'
import { StepEditDialog } from './StepEditDialog'
import { ALL_PHASES } from './stepGrouping'
import { cn } from '../../lib/utils'
import {
  ArrowLeft,
  ArrowRight,
  BookOpen,
  Film,
  LogOut,
  PencilLine,
  Plus,
  RotateCcw
} from 'lucide-react'

export const StepSequencerPanel: React.FC = () => {
  const {
    state,
    currentStepIndex,
    currentTurn,
    currentPhase,
    currentChain,
    activeTurnPlayer,
    resetChain,
    insertPhaseChange,
    insertTurnChange,
    insertPhaseJump,
    setActiveTurnPlayer,
    openScreenplayWithStep
  } = useDuelStore()

  const replayInfo = useDuelEngineStore((s) => s.replayInfo)
  const engineLoading = useDuelEngineStore((s) => s.loading)
  const engineCurrentStepId = useDuelEngineStore((s) => s.currentStepId)
  const stopEngine = useDuelEngineStore((s) => s.stopEngine)
  const convertReplayToPuzzle = useDuelEngineStore((s) => s.convertReplayToPuzzle)

  const steps = state.steps || []
  const isReplay = replayInfo !== null
  const replayStepIndex = isReplay
    ? steps.findIndex((step) => step.actId && step.actId === engineCurrentStepId)
    : null

  const { handlePrevStep, handleNextStep, handleResetPlayback } = useStepPlayback()

  const [dialogOpen, setDialogOpen] = useState<boolean>(false)
  const [editingStepId, setEditingStepId] = useState<string | null>(null)

  const handleOpenAdd = (): void => {
    setEditingStepId(null)
    setDialogOpen(true)
  }

  const handleOpenEdit = (step: DuelStep): void => {
    setEditingStepId(step.id)
    setDialogOpen(true)
  }

  const handleConvert = (): void => {
    if (convertReplayToPuzzle()) {
      void alertDialog(
        '已将当前回放场面转为可编辑残局。\n\n默认按大师规则 2020 解析，如原对局规则不同请手动调整；可通过「另存为...」保存为工程。'
      )
    }
  }

  return (
    <div className="w-full h-full flex flex-col shrink-0 select-none overflow-hidden text-xs">
      <div className="p-2.5 border-b border-border/60 bg-muted/10 flex items-center justify-between shrink-0">
        <div className="flex flex-col">
          <span className="font-bold text-xs flex items-center gap-1.5 text-foreground">
            <Film className="w-3.5 h-3.5 text-muted-foreground" />
            <span>对局剧情编排</span>
          </span>
          <span className="text-[10px] text-muted-foreground">
            共 {steps.length} 步 · {new Set(steps.map((s) => s.turn)).size || 1} 回合
          </span>
        </div>

        {!isReplay && (
          <div className="flex items-center gap-1">
            <Tooltip>
              <TooltipTrigger
                render={
                  <Button
                    size="xs"
                    variant="outline"
                    onClick={() => openScreenplayWithStep()}
                    className="h-7 px-2 text-xs font-semibold gap-1 border-border text-foreground hover:bg-muted"
                  >
                    <BookOpen className="w-3.5 h-3.5" />
                    <span>台本</span>
                  </Button>
                }
              />
              <TooltipContent>打开大屏决斗台本工作台，沉浸式编写角色台词与剧情</TooltipContent>
            </Tooltip>

            <Button
              size="xs"
              variant="default"
              onClick={handleOpenAdd}
              className="h-7 px-2.5 text-xs font-semibold gap-1 shadow-sm"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>添加步骤</span>
            </Button>
          </div>
        )}
      </div>

      <div className="p-2 border-b border-border/60 bg-muted/20 flex flex-col gap-2 shrink-0 select-none">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5">
            <span className="font-extrabold text-xs text-foreground">第 {currentTurn} 回合</span>
            <Tooltip>
              <TooltipTrigger
                render={
                  <Badge
                    variant="outline"
                    onClick={
                      isReplay
                        ? undefined
                        : () => setActiveTurnPlayer(activeTurnPlayer === 0 ? 1 : 0)
                    }
                    className={cn(
                      'text-[10px] px-1.5 py-0 font-bold transition-colors',
                      !isReplay && 'cursor-pointer',
                      activeTurnPlayer === 0
                        ? 'border-blue-500/50 text-blue-400 bg-blue-500/10'
                        : 'border-rose-500/50 text-rose-400 bg-rose-500/10',
                      !isReplay &&
                        (activeTurnPlayer === 0 ? 'hover:bg-blue-500/20' : 'hover:bg-rose-500/20')
                    )}
                  >
                    {activeTurnPlayer === 0 ? '我方行动' : '对方行动'}
                  </Badge>
                }
              />
              {!isReplay && <TooltipContent>点击切换当前行动方 (我方 / 对方)</TooltipContent>}
            </Tooltip>
          </div>

          <div className="flex items-center gap-1">
            {!isReplay && currentChain > 0 ? (
              <div className="flex items-center gap-1 px-1.5 py-0.5 rounded bg-teal-500/20 border border-teal-500/40 text-[10px] font-bold text-teal-300">
                <span className="animate-pulse">⛓ Chain {currentChain}</span>
                <Tooltip>
                  <TooltipTrigger
                    render={
                      <button
                        type="button"
                        onClick={resetChain}
                        className="ml-0.5 text-[9px] px-1 py-0 bg-teal-500/30 hover:bg-teal-500/50 text-teal-200 rounded font-semibold cursor-pointer"
                      >
                        结算
                      </button>
                    }
                  />
                  <TooltipContent>结算并重置连锁序号</TooltipContent>
                </Tooltip>
              </div>
            ) : (
              <span className="text-[10px] text-muted-foreground/60 font-mono">C0 (无连锁)</span>
            )}
          </div>
        </div>

        <div className="flex items-center justify-between gap-1">
          {isReplay ? (
            <div className="flex-1 text-[10px] font-extrabold py-0.5 rounded bg-muted/30 border border-border/40 text-center text-foreground/90">
              {PHASE_NAMES[currentPhase]}
            </div>
          ) : (
            <>
              <div className="flex items-center gap-0.5 bg-background/80 p-0.5 rounded-md border border-border/70 flex-1">
                {ALL_PHASES.map((p) => {
                  const isActive = currentPhase === p
                  return (
                    <Tooltip key={p}>
                      <TooltipTrigger
                        render={
                          <button
                            type="button"
                            onClick={() => insertPhaseJump(p)}
                            className={cn(
                              'flex-1 text-[10px] font-extrabold py-0.5 rounded transition-all text-center cursor-pointer',
                              isActive
                                ? 'bg-primary text-primary-foreground shadow-xs'
                                : 'text-muted-foreground hover:text-foreground hover:bg-muted/50'
                            )}
                          >
                            {p}
                          </button>
                        }
                      />
                      <TooltipContent>{`切换到 ${PHASE_NAMES[p] || p}`}</TooltipContent>
                    </Tooltip>
                  )
                })}
              </div>

              <div className="flex items-center gap-0.5 shrink-0">
                <Tooltip>
                  <TooltipTrigger
                    render={
                      <Button
                        size="xs"
                        variant="outline"
                        onClick={insertPhaseChange}
                        className="h-6 px-1.5 text-[10px] font-bold gap-0.5 border-border"
                      >
                        <span>下阶段</span>
                        <ArrowRight className="w-2.5 h-2.5" />
                      </Button>
                    }
                  />
                  <TooltipContent>
                    推进到下一个决斗阶段 (DP → SP → M1 → BP → M2 → EP)
                  </TooltipContent>
                </Tooltip>
                <Tooltip>
                  <TooltipTrigger
                    render={
                      <Button
                        size="xs"
                        variant="secondary"
                        onClick={insertTurnChange}
                        className="h-6 px-1.5 text-[10px] font-bold text-foreground/90"
                      >
                        <span>下回合</span>
                      </Button>
                    }
                  />
                  <TooltipContent>回合结束，推进到下一回合并切换回合方</TooltipContent>
                </Tooltip>
              </div>
            </>
          )}
        </div>
      </div>

      <StepList steps={steps} onOpenAdd={handleOpenAdd} onEditStep={handleOpenEdit} />

      <div className="p-2 border-t border-border/60 bg-muted/20 flex items-center justify-between select-none shrink-0">
        <div className="flex items-center gap-1">
          <Tooltip>
            <TooltipTrigger
              render={
                <Button
                  size="icon-xs"
                  variant="ghost"
                  onClick={handleResetPlayback}
                  className="h-7 w-7 text-muted-foreground"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                </Button>
              }
            />
            <TooltipContent>复位至开场</TooltipContent>
          </Tooltip>

          <Tooltip>
            <TooltipTrigger
              render={
                <Button
                  size="icon-xs"
                  variant="ghost"
                  disabled={
                    steps.length === 0 ||
                    (isReplay ? (replayStepIndex ?? -1) <= 0 : currentStepIndex === 0)
                  }
                  onClick={handlePrevStep}
                  className="h-7 w-7 text-muted-foreground"
                >
                  <ArrowLeft className="w-3.5 h-3.5" />
                </Button>
              }
            />
            <TooltipContent>上一步</TooltipContent>
          </Tooltip>

          <Tooltip>
            <TooltipTrigger
              render={
                <Button
                  size="icon-xs"
                  variant="ghost"
                  disabled={
                    steps.length === 0 ||
                    (isReplay
                      ? replayStepIndex === steps.length - 1
                      : currentStepIndex === steps.length - 1)
                  }
                  onClick={handleNextStep}
                  className="h-7 w-7 text-muted-foreground"
                >
                  <ArrowRight className="w-3.5 h-3.5" />
                </Button>
              }
            />
            <TooltipContent>下一步</TooltipContent>
          </Tooltip>
        </div>

        <span className="text-[11px] font-mono font-medium text-muted-foreground">
          {isReplay
            ? (replayStepIndex ?? -1) >= 0
              ? `第 ${(replayStepIndex ?? 0) + 1} / ${steps.length} 步`
              : '初始局面'
            : currentStepIndex !== null
              ? `第 ${currentStepIndex + 1} / ${steps.length} 步`
              : '初始局面'}
        </span>
      </div>

      {isReplay && (
        <div className="p-2 border-t border-violet-500/30 bg-violet-500/5 flex items-center gap-2 select-none shrink-0">
          <Button
            size="xs"
            variant="outline"
            disabled={engineLoading}
            onClick={stopEngine}
            className="flex-1 h-7 text-xs font-semibold gap-1 border-border text-foreground hover:bg-muted"
          >
            <LogOut className="w-3.5 h-3.5" />
            <span>退出回放</span>
          </Button>
          <Button
            size="xs"
            variant="default"
            disabled={engineLoading}
            onClick={handleConvert}
            className="flex-1 h-7 text-xs font-semibold gap-1 shadow-sm"
          >
            <PencilLine className="w-3.5 h-3.5" />
            <span>编辑</span>
          </Button>
        </div>
      )}

      {dialogOpen && (
        <StepEditDialog editingStepId={editingStepId} onClose={() => setDialogOpen(false)} />
      )}
    </div>
  )
}
