import {
  ACTION_TYPE_NAMES,
  DuelStep,
  findTagHandMismatches,
  formatTagHandMismatches,
  isEngineSupportedMatch,
  isStandardTag
} from '@shared/index'
import { useDuelStore } from '../stores/useDuelStore'
import { useDuelEngineStore } from '../stores/useDuelEngineStore'
import { clearEditorSteps } from '../stores/duelEngine/stepRecords'
import { alertDialog, confirmDialog } from '../stores/useDialogStore'

export function useStepPlayback(): {
  handlePrevStep: () => void
  handleNextStep: () => void
  handleResetPlayback: () => void
  handleStepClick: (index: number, step: DuelStep) => void
  handleRestartFromStep: (index: number, step: DuelStep) => void
} {
  const currentStepIndex = useDuelStore((s) => s.currentStepIndex)
  const stepsState = useDuelStore((s) => s.state.steps)
  const previewStepBoard = useDuelStore((s) => s.previewStepBoard)
  const steps = stepsState || []

  const handlePrevStep = (): void => {
    if (useDuelStore.getState().sceneEditing) return
    if (useDuelEngineStore.getState().isInitialized) {
      void useDuelEngineStore.getState().undo()
    } else {
      if (currentStepIndex === null) return
      if (currentStepIndex > 0) {
        previewStepBoard(currentStepIndex - 1)
      }
    }
  }

  const handleNextStep = (): void => {
    if (useDuelStore.getState().sceneEditing) return
    if (useDuelEngineStore.getState().isInitialized) {
      void useDuelEngineStore.getState().redo()
    } else {
      if (currentStepIndex === null) {
        previewStepBoard(0)
      } else if (currentStepIndex < steps.length - 1) {
        previewStepBoard(currentStepIndex + 1)
      }
    }
  }

  const handleResetPlayback = (): void => {
    if (useDuelStore.getState().sceneEditing) return
    const engine = useDuelEngineStore.getState()
    if (engine.loading) return
    if (engine.isInitialized) {
      if (engine.replayInfo) {
        const first = engine.timeline[0]
        if (first) void engine.jumpToStep(first.id)
        return
      }
      void (async () => {
        await engine.suspendEngine()
        useDuelStore.getState().previewTimelineStart()
      })()
      return
    }
    useDuelStore.getState().previewTimelineStart()
  }

  const handleStepClick = (index: number, step: DuelStep): void => {
    const engine = useDuelEngineStore.getState()
    if (engine.loading) return
    if (useDuelStore.getState().sceneEditing) return
    useDuelStore.getState().setSelectedStepId(step.id)
    useDuelStore.getState().setCurrentStepIndex(index)
    const actId = step.endActId ?? step.actId
    if (engine.isInitialized && actId && engine.timeline.some((n) => n.id === actId)) {
      if (actId === engine.currentStepId) return
      void engine.jumpToStep(actId)
      return
    }
    previewStepBoard(index)
  }

  const handleRestartFromStep = (index: number, step: DuelStep): void => {
    if (useDuelStore.getState().sceneEditing) return
    if (useDuelEngineStore.getState().replayInfo) return
    const state = useDuelStore.getState().state
    if (isStandardTag(state.matchConfig)) {
      const mismatches = findTagHandMismatches(state)
      if (mismatches.length > 0) {
        void alertDialog(formatTagHandMismatches())
        return
      }
    }
    const matchConfig = state.matchConfig
    const label = step.cardName || ACTION_TYPE_NAMES[step.actionType] || '这一步'
    const engine = useDuelEngineStore.getState()
    const mergedMatch = !isEngineSupportedMatch(matchConfig)
    const mergedHint = mergedMatch
      ? '\n\n当前为多人数模式：内置引擎会把同队角色合并成同一方，召唤/发动仍可校验，但手牌和目标会混在一起。'
      : ''
    const clearedHint =
      steps.length > 0 ? `当前 ${steps.length} 个步骤会被清空，作为新的起点。` : ''
    void confirmDialog({
      title: engine.isInitialized ? '以这一步为起点继续编排' : '以这一步为起点开始编排',
      description: engine.isInitialized
        ? `将以「${label}」的场面重建引擎会话，当前操作流结束。${clearedHint}${mergedHint}`
        : `将以「${label}」的场面启动引擎，引擎以该场面为新起点。${clearedHint}${mergedHint}`,
      confirmText: steps.length > 0 ? '清空并开始' : '开始',
      destructive: steps.length > 0
    }).then((ok) => {
      if (!ok) return
      previewStepBoard(index)
      clearEditorSteps()
      void useDuelEngineStore
        .getState()
        .startEngine({ allowMergedMatch: mergedMatch, resetOpening: true })
    })
  }

  return {
    handlePrevStep,
    handleNextStep,
    handleResetPlayback,
    handleStepClick,
    handleRestartFromStep
  }
}
