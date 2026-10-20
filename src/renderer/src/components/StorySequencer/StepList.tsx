import React, { useMemo, useState } from 'react'
import { DuelStep } from '@shared/index'
import { useDuelStore } from '../../stores/useDuelStore'
import { useDuelEngineStore } from '../../stores/useDuelEngineStore'
import { useStepPlayback } from '../../hooks/useStepPlayback'
import { ScrollArea } from '../ui/scroll-area'
import { Button } from '../ui/button'
import { Film, PlayCircle, X } from 'lucide-react'
import { cn } from '../../lib/utils'
import { StepGroupHeader } from './StepGroupHeader'
import { StepPhaseHeader } from './StepPhaseHeader'
import { StepTurnHeader } from './StepTurnHeader'
import { StepCard } from './StepCard'
import { buildStepList, getAttackDamageText, resolveStepCardName } from './stepGrouping'
import { resolveTeamLabel } from '../../utils/duelistNames'

interface StepListProps {
  steps: DuelStep[]
  onEditStep: (step: DuelStep) => void
}

export const StepList: React.FC<StepListProps> = ({ steps, onEditStep }) => {
  const { currentStepIndex, previewReturn, exitPreview } = useDuelStore()
  const { handleStepClick, handleRestartFromStep } = useStepPlayback()
  const engineActive = useDuelEngineStore((s) => s.isInitialized)
  const engineTimeline = useDuelEngineStore((s) => s.timeline)
  const engineCurrentStepId = useDuelEngineStore((s) => s.currentStepId)
  const isReplay = useDuelEngineStore((s) => s.replayInfo !== null)
  const duelists = useDuelStore((s) => s.state.duelists)
  const initialLp = useDuelStore((s) => s.state.initialLp)

  const stepList = useMemo(() => buildStepList(steps, initialLp), [steps, initialLp])

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
    return stepList.reduce((count, item) => {
      if (item.kind !== 'group') return count
      return (
        count +
        item.group.entries.filter(({ step }) => {
          const stepIndex = step.actId ? engineIndexById.get(step.actId) : undefined
          return stepIndex !== undefined && stepIndex > engineCursor
        }).length
      )
    }, 0)
  }, [stepList, engineCursor, engineIndexById])

  const previewIndex = currentStepIndex
  const previewStep = previewIndex !== null ? steps[previewIndex] : undefined
  const isPreviewing = previewReturn !== null && previewIndex !== null && Boolean(previewStep)

  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(() => new Set())

  const toggleGroup = (key: string): void => {
    setExpandedGroups((prev) => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })
  }

  const isCurrentStepOf = (step: DuelStep, index: number): boolean => {
    if (engineCursor < 0) return currentStepIndex === index
    const stepIndex = step.actId ? engineIndexById.get(step.actId) : undefined
    return stepIndex === engineCursor
  }

  const renderStepCard = (step: DuelStep, index: number): React.JSX.Element => {
    const stepEngineIndex = step.actId ? engineIndexById.get(step.actId) : undefined
    const isFutureStep =
      engineCursor >= 0 && stepEngineIndex !== undefined && stepEngineIndex > engineCursor
    const isCurrentPlaying =
      engineCursor >= 0 ? stepEngineIndex === engineCursor : currentStepIndex === index
    return (
      <StepCard
        key={step.id}
        step={step}
        index={index}
        stepsLength={steps.length}
        isCurrentPlaying={isCurrentPlaying}
        isFutureStep={isFutureStep}
        stepEngineIndex={stepEngineIndex}
        onEdit={onEditStep}
        onRestart={handleRestartFromStep}
        onClick={handleStepClick}
      />
    )
  }

  return (
    <ScrollArea className="flex-1 min-h-0">
      <div className="p-2 flex flex-col gap-2 select-text">
        {isPreviewing ? (
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
              已回退到当前步：之后 {futureStepCount} 步保留在列表里（虚线「未来步」），点击可前进；
              若直接在此处展开新操作，它们会被丢弃。
            </div>
          )
        )}
        {steps.length === 0 ? (
          <div className="flex-1 h-full flex flex-col items-center justify-center p-6 text-center text-muted-foreground text-xs select-none">
            <Film className="w-10 h-10 text-muted-foreground/30 mb-2.5 animate-pulse" />
            <p className="font-semibold text-foreground/80">
              {isReplay ? '该回放没有可显示的步骤' : '暂无编排动作步骤'}
            </p>
          </div>
        ) : (
          stepList.map((item) => {
            if (item.kind === 'turn') {
              return (
                <StepTurnHeader
                  key={item.key}
                  turn={item.turn}
                  turnPlayer={item.turnPlayer}
                  lp={item.lp}
                  duelists={duelists}
                />
              )
            }

            if (item.kind === 'phase') {
              return (
                <StepPhaseHeader key={item.key} phase={item.phase} turnPlayer={item.turnPlayer} />
              )
            }

            const { group } = item
            const firstEntry = group.entries[0]

            if (group.kind === 'single') {
              return renderStepCard(firstEntry.step, firstEntry.index)
            }

            const expanded = expandedGroups.has(group.key)
            const names = group.entries.map(({ step }) => resolveStepCardName(step))
            const isCurrentPlaying = group.entries.some(({ step, index }) =>
              isCurrentStepOf(step, index)
            )
            const damageText =
              group.kind === 'attack'
                ? getAttackDamageText(firstEntry.step, group.entries[1]?.step)
                : undefined

            return (
              <div key={group.key} className="flex flex-col gap-1.5">
                <StepGroupHeader
                  summary={{
                    kind: group.kind,
                    player: firstEntry.step.actionPlayer,
                    playerName: resolveTeamLabel(
                      { duelists },
                      firstEntry.step.actionPlayer,
                      firstEntry.step.turn
                    ),
                    cardCode: firstEntry.step.cardCode,
                    cardName: names[0],
                    actionType: firstEntry.step.actionType,
                    names,
                    cardCodes: group.entries.map(({ step }) => step.cardCode),
                    chainNumber: firstEntry.step.chainIndex,
                    damageText,
                    count: group.entries.length,
                    expanded,
                    isCurrentPlaying,
                    onToggle: () => toggleGroup(group.key)
                  }}
                />
                {expanded && (
                  <div
                    className={cn(
                      'flex flex-col gap-2 pl-2 ml-1 border-l',
                      group.kind === 'chain' ? 'border-teal-500/30' : 'border-border/60'
                    )}
                  >
                    {group.entries.map(({ step, index }) => renderStepCard(step, index))}
                  </div>
                )}
              </div>
            )
          })
        )}
      </div>
    </ScrollArea>
  )
}
