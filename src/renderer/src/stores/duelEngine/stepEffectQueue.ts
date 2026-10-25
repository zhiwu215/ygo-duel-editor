import type { EngineStepEvent, EngineTimelineNode } from '@shared/index'

export interface ShuffleHandEffect {
  id: number
  kind: 'shuffle-hand'
  player: 0 | 1
  duelistId?: string
}

export type StepEffect = ShuffleHandEffect

export const STEP_EFFECT_DURATION_MS = 1000

let stepEffectSeq = 0

export function stepEffectsOfNode(node: EngineTimelineNode | null | undefined): StepEffect[] {
  if (!node) return []
  const activeDuelist = node.boardState.activeDuelist
  return node.events
    .filter(
      (event): event is Extract<EngineStepEvent, { kind: 'shuffle-hand' }> =>
        event.kind === 'shuffle-hand'
    )
    .map((event) => ({
      id: ++stepEffectSeq,
      kind: 'shuffle-hand' as const,
      player: event.player,
      duelistId: activeDuelist?.[event.player] || undefined
    }))
}
