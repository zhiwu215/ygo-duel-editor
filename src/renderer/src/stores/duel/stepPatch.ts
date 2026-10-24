import type { DuelStep } from '@shared/index'

const NARRATIVE_STEP_FIELDS = new Set<keyof DuelStep>(['texts', 'description'])

export function pickNarrativeStepPatch(patch: Partial<DuelStep>): Partial<DuelStep> | null {
  const entries = Object.entries(patch).filter(([key]) =>
    NARRATIVE_STEP_FIELDS.has(key as keyof DuelStep)
  )
  if (entries.length === 0) return null
  return Object.fromEntries(entries) as Partial<DuelStep>
}
