import type { DuelStep, StepProvenance } from '../types/story'

export function isEngineAuthoredStep(step: DuelStep): boolean {
  return (
    step.origin === 'engine' ||
    step.origin === 'replay' ||
    (!step.origin && step.actId !== undefined)
  )
}

export function summarizeStepProvenance(steps: readonly DuelStep[] | undefined): StepProvenance {
  const list = steps ?? []
  const engineStepCount = list.filter(isEngineAuthoredStep).length
  return {
    stepCount: list.length,
    engineStepCount,
    manualStepCount: list.length - engineStepCount
  }
}
