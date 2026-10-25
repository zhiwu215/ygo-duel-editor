import type { DuelStep } from '@shared/index'

function hasTimelineLink(step: DuelStep): boolean {
  return Boolean(step.actId || step.startActId || step.endActId || step.afterActId)
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
