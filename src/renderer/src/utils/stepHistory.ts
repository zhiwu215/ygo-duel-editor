import type { DuelPuzzleState, DuelStep } from '@shared/index'

function hasTimelineLink(step: DuelStep): boolean {
  return Boolean(step.actId || step.startActId || step.endActId || step.afterActId)
}

export function isDetachedEngineStep(step: DuelStep): boolean {
  return step.origin === 'engine' && !hasTimelineLink(step)
}

export function stripDetachedEngineSteps(state: DuelPuzzleState): DuelPuzzleState {
  const steps = state.steps
  if (!steps || steps.length === 0) return state
  const next = steps.filter((step) => !isDetachedEngineStep(step))
  return next.length === steps.length ? state : { ...state, steps: next }
}

export function detachStepsFromTimeline(steps: DuelStep[]): DuelStep[] {
  return steps.map((step) => {
    if (!hasTimelineLink(step)) return step
    const next: DuelStep = { ...step }
    delete next.actId
    delete next.startActId
    delete next.endActId
    delete next.afterActId
    return next
  })
}
