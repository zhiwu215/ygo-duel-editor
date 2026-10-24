import React, { useState } from 'react'
import { DuelStep, DuelPhase, PHASE_NAMES } from '@shared/index'
import type { Answer } from '@shared/engine/protocol'
import { useDuelStore } from '../../stores/useDuelStore'
import { useDuelEngineStore } from '../../stores/useDuelEngineStore'
import { useStepPlayback } from '../../hooks/useStepPlayback'
import { useReplayPlayback } from '../../hooks/useReplayPlayback'
import { phaseJumpCommand, phaseAdvanceCommand, turnEndCommand } from '../../utils/phaseFlow'
import { Button } from '../ui/button'
import { StepList } from './StepList'
import { StepEditDialog } from './StepEditDialog'
import { ALL_PHASES } from './stepGrouping'
import { formatReplayVersus } from '../../utils/replayMatch'
import { cn } from '../../lib/utils'
import { ArrowLeft, ArrowRight, LogOut, Pause, PencilLine, Play, RotateCcw } from 'lucide-react'

const EMPTY_STEPS: DuelStep[] = []

export const StepSequencerPanel: React.FC = () => {
  const steps = useDuelStore((state) => state.state.steps) ?? EMPTY_STEPS
  const currentStepIndex = useDuelStore((state) => state.currentStepIndex)
  const currentPhase = useDuelStore((state) => state.currentPhase)
  const currentChain = useDuelStore((state) => state.currentChain)
  const resetChain = useDuelStore((state) => state.resetChain)
  const insertPhaseChange = useDuelStore((state) => state.insertPhaseChange)
  const insertTurnChange = useDuelStore((state) => state.insertTurnChange)
  const insertPhaseJump = useDuelStore((state) => state.insertPhaseJump)

  const replayInfo = useDuelEngineStore((s) => s.replayInfo)
  const engineLoading = useDuelEngineStore((s) => s.loading)
  const engineCurrentStepId = useDuelEngineStore((s) => s.currentStepId)
  const stopEngine = useDuelEngineStore((s) => s.stopEngine)
  const convertReplayToPuzzle = useDuelEngineStore((s) => s.convertReplayToPuzzle)
  const isEngine = useDuelEngineStore((s) => s.isInitialized)
  const pendingRequest = useDuelEngineStore((s) => s.pendingRequest)
  const submitEngineAnswer = useDuelEngineStore((s) => s.submitAnswer)

  const advanceCommand = isEngine ? phaseAdvanceCommand(pendingRequest) : null
  const turnEndCmd = isEngine ? turnEndCommand(pendingRequest) : null
  const enginePhaseCommand = (target: DuelPhase): Answer | null =>
    isEngine ? phaseJumpCommand(target, pendingRequest) : null

  const submitEngine = (command: Answer): void => {
    void submitEngineAnswer(command)
  }

  const isReplay = replayInfo !== null
  const replayStepIndex = isReplay
    ? steps.findIndex((step) => step.actId && step.actId === engineCurrentStepId)
    : null
  const currentReplayStep =
    replayStepIndex !== null && replayStepIndex >= 0 ? steps[replayStepIndex] : undefined
  const replayStartStep = isReplay ? steps[0] : undefined
  const displayPhase = currentReplayStep?.phase ?? replayStartStep?.phase ?? currentPhase

  const { handlePrevStep, handleNextStep, handleResetPlayback } = useStepPlayback()
  const { playing, speed, speeds, atEnd, setSpeed, toggle, pause } = useReplayPlayback({
    enabled: isReplay,
    stepIndex: replayStepIndex,
    stepCount: steps.length,
    onNext: handleNextStep,
    onPrev: handlePrevStep,
    onReset: handleResetPlayback
  })
  const goPrev = (): void => {
    pause()
    handlePrevStep()
  }
  const goNext = (): void => {
    pause()
    handleNextStep()
  }
  const goReset = (): void => {
    pause()
    handleResetPlayback()
  }

  const [editingStepId, setEditingStepId] = useState<string | null>(null)

  const handleOpenEdit = (step: DuelStep): void => {
    setEditingStepId(step.id)
  }

  const handleConvert = (): void => {
    pause()
    convertReplayToPuzzle()
  }

  return (
    <div className="w-full h-full flex flex-col shrink-0 select-none overflow-hidden text-xs">
      <div className="p-2.5 border-b border-border/60 bg-muted/10 flex items-center justify-between shrink-0">
        <div className="flex min-w-0 flex-col">
          <span className="text-[10px] text-muted-foreground">
            共 {steps.length} 步 · {new Set(steps.map((s) => s.turn)).size || 1} 回合
          </span>
          {isEngine && !isReplay && (
            <span className="mt-0.5 text-[9px] text-muted-foreground/70">
              引擎接管中，动作自动记录（台词仍可编辑）
            </span>
          )}
          {isReplay && replayInfo && (
            <span className="mt-0.5 truncate text-[9px] text-muted-foreground/70">
              {formatReplayVersus(replayInfo)}
            </span>
          )}
        </div>

        <div className="flex items-center gap-1">
          {!isReplay && currentChain > 0 && (
            <div className="flex items-center gap-1 px-1.5 py-0.5 rounded bg-teal-500/20 border border-teal-500/40 text-[10px] font-bold text-teal-600 dark:text-teal-300">
              <span className="animate-pulse">⛓ Chain {currentChain}</span>
              <button
                type="button"
                onClick={resetChain}
                className="ml-0.5 text-[9px] px-1 py-0 bg-teal-500/30 hover:bg-teal-500/50 text-teal-700 dark:text-teal-200 rounded font-semibold cursor-pointer"
              >
                结算
              </button>
            </div>
          )}
        </div>
      </div>

      <div className="p-2 border-b border-border/60 bg-muted/20 flex flex-col gap-2 shrink-0 select-none">
        <div className="flex items-center justify-between gap-1">
          {isReplay ? (
            <div className="flex-1 text-[10px] font-extrabold py-0.5 rounded bg-muted/30 border border-border/40 text-center text-foreground/90">
              {PHASE_NAMES[displayPhase]}
            </div>
          ) : (
            <>
              <div className="flex items-center gap-0.5 bg-background/80 p-0.5 rounded-md border border-border/70 flex-1">
                {ALL_PHASES.map((p) => {
                  const isActive = currentPhase === p
                  const command = enginePhaseCommand(p)
                  const engineDisabled = isEngine && !command
                  return (
                    <button
                      key={p}
                      type="button"
                      disabled={engineDisabled}
                      onClick={() => {
                        if (isEngine) {
                          if (command) submitEngine(command)
                          return
                        }
                        insertPhaseJump(p)
                      }}
                      className={cn(
                        'flex-1 text-[10px] font-extrabold py-0.5 rounded transition-all text-center',
                        engineDisabled ? 'cursor-not-allowed opacity-40' : 'cursor-pointer',
                        isActive
                          ? 'bg-primary text-primary-foreground shadow-xs'
                          : 'text-muted-foreground hover:text-foreground hover:bg-muted/50'
                      )}
                    >
                      {p}
                    </button>
                  )
                })}
              </div>

              <div className="flex items-center gap-0.5 shrink-0">
                <Button
                  size="xs"
                  variant="outline"
                  disabled={isEngine && (!advanceCommand || engineLoading)}
                  onClick={() => {
                    if (isEngine) {
                      if (advanceCommand) submitEngine(advanceCommand)
                      return
                    }
                    insertPhaseChange()
                  }}
                  className="h-6 px-1.5 text-[10px] font-bold gap-0.5 border-border"
                >
                  <span>下阶段</span>
                  <ArrowRight className="w-2.5 h-2.5" />
                </Button>
                <Button
                  size="xs"
                  variant="secondary"
                  disabled={isEngine && (!turnEndCmd || engineLoading)}
                  onClick={() => {
                    if (isEngine) {
                      if (turnEndCmd) submitEngine(turnEndCmd)
                      return
                    }
                    insertTurnChange()
                  }}
                  className="h-6 px-1.5 text-[10px] font-bold text-foreground/90"
                >
                  <span>下回合</span>
                </Button>
              </div>
            </>
          )}
        </div>
      </div>

      <StepList steps={steps} onEditStep={handleOpenEdit} />

      <div className="p-2 border-t border-border/60 bg-muted/20 flex items-center justify-between select-none shrink-0">
        <div className="flex items-center gap-1">
          <Button
            size="icon-xs"
            variant="ghost"
            onClick={goReset}
            className="h-7 w-7 text-muted-foreground"
            aria-label="回到初始局面"
          >
            <RotateCcw className="w-3.5 h-3.5" />
          </Button>

          {isReplay && (
            <Button
              size="icon-xs"
              variant={playing ? 'secondary' : 'ghost'}
              disabled={steps.length === 0}
              onClick={toggle}
              className={cn(
                'h-7 w-7',
                playing ? 'text-emerald-500 dark:text-emerald-400' : 'text-muted-foreground'
              )}
              aria-label={playing ? '暂停自动播放' : atEnd ? '从头播放' : '自动播放'}
              aria-keyshortcuts="Space"
            >
              {playing ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
            </Button>
          )}

          <Button
            size="icon-xs"
            variant="ghost"
            disabled={
              steps.length === 0 ||
              (isReplay ? (replayStepIndex ?? -1) <= 0 : currentStepIndex === 0)
            }
            onClick={goPrev}
            className="h-7 w-7 text-muted-foreground"
            aria-label="上一步"
            aria-keyshortcuts="ArrowLeft"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
          </Button>

          <Button
            size="icon-xs"
            variant="ghost"
            disabled={
              steps.length === 0 ||
              (isReplay
                ? replayStepIndex === steps.length - 1
                : currentStepIndex === steps.length - 1)
            }
            onClick={goNext}
            className="h-7 w-7 text-muted-foreground"
            aria-label="下一步"
            aria-keyshortcuts="ArrowRight"
          >
            <ArrowRight className="w-3.5 h-3.5" />
          </Button>

          {isReplay && (
            <select
              value={speed}
              onChange={(event) => setSpeed(Number(event.target.value))}
              aria-label="播放速度"
              title="播放速度"
              className="h-7 rounded-md border border-border/60 bg-background px-1 text-[10px] font-medium text-muted-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring/30"
            >
              {speeds.map((value) => (
                <option key={value} value={value}>
                  {value}×
                </option>
              ))}
            </select>
          )}
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
            onClick={() => {
              pause()
              stopEngine()
            }}
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

      {!isEngine && editingStepId && (
        <StepEditDialog stepId={editingStepId} onClose={() => setEditingStepId(null)} />
      )}
    </div>
  )
}
