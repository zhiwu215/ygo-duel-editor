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
    if (useDuelEngineStore.getState().isInitialized) {
      void useDuelEngineStore.getState().undo()
    } else {
      if (currentStepIndex === null) {
        previewStepBoard(steps.length - 1)
      } else if (currentStepIndex > 0) {
        previewStepBoard(currentStepIndex - 1)
      }
    }
  }

  const handleNextStep = (): void => {
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
    if (useDuelEngineStore.getState().isInitialized) {
      const first = useDuelEngineStore.getState().timeline[0]
      if (first) void useDuelEngineStore.getState().jumpToStep(first.id)
      return
    }
    useDuelStore.getState().resetToOpeningBoard()
  }

  const handleStepClick = (index: number, step: DuelStep): void => {
    const engine = useDuelEngineStore.getState()
    if (engine.loading) return
    const actId = step.actId
    if (engine.isInitialized && actId && engine.timeline.some((n) => n.id === actId)) {
      if (actId === engine.currentStepId) return
      void engine.jumpToStep(actId)
      return
    }
    previewStepBoard(index)
  }

  const handleRestartFromStep = (index: number, step: DuelStep): void => {
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
    void confirmDialog({
      title: engine.isInitialized ? '以这一步为起点继续编排' : '以这一步为起点开始编排',
      description: engine.isInitialized
        ? `将以「${label}」的场面重建引擎会话，当前操作流结束（步骤列表保留，可继续添加新操作）。${mergedHint}`
        : `将以「${label}」的场面启动引擎，之后的操作会作为新步骤记录。${mergedHint}`
    }).then((ok) => {
      if (!ok) return
      previewStepBoard(index)
      void useDuelEngineStore.getState().startEngine({ allowMergedMatch: mergedMatch })
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
