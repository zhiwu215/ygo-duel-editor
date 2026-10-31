import React, { useMemo } from 'react'
import { DuelStep } from '@shared/index'
import { useDuelStore } from '../../stores/useDuelStore'
import { useDuelEngineStore } from '../../stores/useDuelEngineStore'
import { useStepPlayback } from '../../hooks/useStepPlayback'
import { useCleanupBlankReplaySteps } from '../../hooks/useCleanupBlankReplaySteps'
import { Button } from '../ui/button'
import { Film, PlayCircle, X } from 'lucide-react'
import { cn } from '../../lib/utils'
import { StepPhaseHeader } from './StepPhaseHeader'
import { StepTurnHeader } from './StepTurnHeader'
import { StepLogRows } from './StepLogRows'
import { StepHoverActions } from './StepHoverActions'
import { buildStepLogItems } from './stepLogItems'
import { SCENE_STEP_INDEX } from '../../utils/openingScene'

interface StepListProps {
  steps: DuelStep[]
}

export const StepList: React.FC<StepListProps> = ({ steps }) => {
  const currentStepIndex = useDuelStore((state) => state.currentStepIndex)
  const sceneEditing = useDuelStore((state) => state.sceneEditing)
  const previewReturn = useDuelStore((state) => state.previewReturn)
  const exitPreview = useDuelStore((state) => state.exitPreview)
  const setHoveredInstanceId = useDuelStore((state) => state.setHoveredInstanceId)
  const { handleStepClick, handleRestartFromStep } = useStepPlayback()
  const engineActive = useDuelEngineStore((s) => s.isInitialized)
  const engineTimeline = useDuelEngineStore((s) => s.timeline)
  const engineCurrentStepId = useDuelEngineStore((s) => s.currentStepId)
  const isReplay = useDuelEngineStore((s) => s.replayInfo !== null)
  const duelists = useDuelStore((s) => s.state.duelists)
  const initialLp = useDuelStore((s) => s.state.initialLp)
  const sharedLp = useDuelStore((s) => s.state.matchConfig?.sharedLp)

  useCleanupBlankReplaySteps(steps)

  const items = useMemo(() => buildStepLogItems(steps, initialLp), [steps, initialLp])
  const stepsWithRows = useMemo(() => {
    const set = new Set<string>()
    items.forEach((item) => {
      if (item.kind === 'step') set.add(item.step.id)
    })
    return set
  }, [items])
  const firstSegmentKeys = useMemo(() => {
    const seen = new Set<string>()
    const keys = new Set<string>()
    items.forEach((item) => {
      if (item.kind !== 'step' || seen.has(item.step.id)) return
      seen.add(item.step.id)
      keys.add(item.key)
    })
    return keys
  }, [items])

  const engineIndexById = useMemo(() => {
    const map = new Map<string, number>()
    engineTimeline.forEach((node, index) => map.set(node.id, index))
    return map
  }, [engineTimeline])

  const engineCursor = useMemo(() => {
    if (!engineActive || !engineCurrentStepId) return -1
    return engineIndexById.get(engineCurrentStepId) ?? -1
  }, [engineActive, engineCurrentStepId, engineIndexById])

  const futureStepCount = useMemo(() => {
    if (engineCursor < 0) return 0
    return steps.filter((step) => {
      const startId = step.startActId ?? step.actId
      const start = startId ? engineIndexById.get(startId) : undefined
      return start !== undefined && start > engineCursor
    }).length
  }, [steps, engineCursor, engineIndexById])

  const previewIndex = currentStepIndex
  const previewStep = previewIndex !== null ? steps[previewIndex] : undefined
  const isPreviewing = previewReturn !== null && previewIndex !== null && Boolean(previewStep)

  const stepState = (step: DuelStep, index: number): { current: boolean; future: boolean } => {
    if (engineActive && engineCursor >= 0) {
      const endId = step.endActId ?? step.actId
      const startId = step.startActId ?? step.actId
      const end = endId ? engineIndexById.get(endId) : undefined
      const start = startId ? engineIndexById.get(startId) : undefined
      return {
        current:
          start !== undefined && end !== undefined && engineCursor >= start && engineCursor <= end,
        future: start !== undefined && start > engineCursor
      }
    }
    return { current: currentStepIndex === index, future: false }
  }

  return (
    <div className="flex-1 min-h-0 overflow-y-auto">
      <div className="p-2 flex flex-col gap-2 select-text">
        {sceneEditing ? (
          <div className="flex flex-col gap-1.5 px-2 py-1.5 rounded-md border border-amber-500/40 bg-amber-500/5 text-[10px] leading-relaxed text-amber-600 dark:text-amber-400">
            <span>
              布景编辑中：摆放、移动或删除卡片不会记录步骤。修改布景或从布景启动引擎会清空原有步骤，作为新的起点；仅查看后完成布景不受影响。
            </span>
          </div>
        ) : isPreviewing ? (
          <div className="flex flex-col gap-1.5 px-2 py-1.5 rounded-md border border-sky-500/40 bg-sky-500/5 text-[10px] leading-relaxed text-sky-600 dark:text-sky-400">
            <span>
              正在预览第 {previewIndex! + 1}{' '}
              步的场面（引擎当前局面没有改变；做任何引擎操作会自动退出预览）。
            </span>
            <div className="flex items-center gap-1.5">
              <Button
                size="xs"
                variant="ghost"
                onClick={() => exitPreview()}
                className="h-6 px-2 text-[10px]"
              >
                <X className="w-3 h-3" />
                <span>退出预览</span>
              </Button>
              <Button
                size="xs"
                variant="outline"
                onClick={() => handleRestartFromStep(previewIndex!, previewStep!)}
                className="h-6 px-2 text-[10px]"
              >
                <PlayCircle className="w-3 h-3" />
                <span>以这一步继续编排</span>
              </Button>
            </div>
          </div>
        ) : (
          !isReplay &&
          futureStepCount > 0 && (
            <div className="px-2 py-1.5 rounded-md border border-dashed border-amber-500/40 bg-amber-500/5 text-[10px] leading-relaxed text-amber-600 dark:text-amber-400">
              已回退到当前步：之后 {futureStepCount} 步保留在列表里，点击可前进；
              若直接在此处展开新操作，它们会被丢弃。
            </div>
          )
        )}

        {steps.length === 0 ? (
          <div
            className={cn(
              'flex-1 h-full flex flex-col items-center justify-center p-6 text-center text-muted-foreground text-xs select-none',
              sceneEditing && 'opacity-55'
            )}
          >
            <Film className="w-10 h-10 text-muted-foreground/30 mb-2.5 animate-pulse" />
            <p className="font-semibold text-foreground/80">
              {isReplay
                ? '该回放没有可显示的步骤'
                : sceneEditing
                  ? '布景编辑中，暂无编排步骤'
                  : '暂无编排动作步骤'}
            </p>
          </div>
        ) : (
          <div
            className={cn(
              'flex flex-col overflow-hidden rounded-md border border-border/60 bg-card/30',
              sceneEditing && 'pointer-events-none select-none opacity-55'
            )}
          >
            {!engineActive &&
              !isReplay &&
              !sceneEditing &&
              currentStepIndex === SCENE_STEP_INDEX && (
                <div className="flex h-[30px] items-center justify-center border-b border-border/60 bg-muted/30 px-2 text-[11px] font-bold text-foreground/80">
                  初始局面 · 所有操作之前
                </div>
              )}

            {items.map((item) => {
              if (item.kind === 'turn') {
                const { current, future } = stepState(item.step, item.index)
                return (
                  <div
                    key={item.key}
                    className={cn(
                      'group/step relative cursor-pointer border-l-2 transition-colors',
                      current ? 'border-primary' : 'border-transparent',
                      future && 'opacity-50 hover:opacity-100'
                    )}
                    onClick={() => handleStepClick(item.index, item.step)}
                  >
                    <StepTurnHeader
                      turn={item.turn}
                      turnPlayer={item.turnPlayer}
                      lp={item.lp}
                      duelists={duelists}
                      sharedLp={sharedLp}
                    />
                    {!isReplay && !stepsWithRows.has(item.step.id) && (
                      <StepHoverActions
                        step={item.step}
                        index={item.index}
                        stepsLength={steps.length}
                        canReorder={!engineActive}
                      />
                    )}
                  </div>
                )
              }
              if (item.kind === 'phase') {
                const { current, future } = stepState(item.step, item.index)
                return (
                  <div
                    key={item.key}
                    className={cn(
                      'group/step relative cursor-pointer border-l-2 transition-colors',
                      current ? 'border-primary' : 'border-transparent',
                      future && 'opacity-50 hover:opacity-100'
                    )}
                    onClick={() => handleStepClick(item.index, item.step)}
                  >
                    <StepPhaseHeader phase={item.phase} />
                    {!isReplay && !stepsWithRows.has(item.step.id) && (
                      <StepHoverActions
                        step={item.step}
                        index={item.index}
                        stepsLength={steps.length}
                        canReorder={!engineActive}
                      />
                    )}
                  </div>
                )
              }
              const { current, future } = stepState(item.step, item.index)
              return (
                <div
                  key={item.key}
                  className={cn(
                    'group/step relative transition-colors',
                    current && 'bg-primary/[0.07] ring-1 ring-inset ring-primary/20',
                    future && 'opacity-50 hover:opacity-100'
                  )}
                  onMouseEnter={() =>
                    setHoveredInstanceId(item.step.targetInstanceId ?? item.step.instanceId ?? null)
                  }
                  onMouseLeave={() => setHoveredInstanceId(null)}
                >
                  <div
                    className="cursor-pointer"
                    onClick={() => handleStepClick(item.index, item.step)}
                  >
                    <StepLogRows rows={item.rows} duelists={duelists} />
                  </div>
                  {!isReplay && firstSegmentKeys.has(item.key) && (
                    <StepHoverActions
                      step={item.step}
                      index={item.index}
                      stepsLength={steps.length}
                      canReorder={!engineActive}
                    />
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
