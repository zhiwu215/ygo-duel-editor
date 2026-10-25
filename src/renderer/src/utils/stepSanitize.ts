import type { DuelStep } from '@shared/index'
import { isReplayPromptText } from './replayPrompt'

export function isBlankEventStep(step: DuelStep): boolean {
  return (
    step.origin === 'replay' &&
    step.actionType === 'EVENT' &&
    (!step.description?.trim() || isReplayPromptText(step.description)) &&
    !step.targetCardName?.trim() &&
    !step.lpChange
  )
}

export function dropBlankEventSteps(steps: DuelStep[]): DuelStep[] {
  return steps.filter((step) => !isBlankEventStep(step))
}
