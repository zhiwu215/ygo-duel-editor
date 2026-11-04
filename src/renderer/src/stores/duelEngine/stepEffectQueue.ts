import type { EngineTimelineNode, TossKind } from '@shared/index'

export interface ShuffleHandEffect {
  id: number
  kind: 'shuffle-hand'
  player: 0 | 1
  duelistId?: string
}

export interface TossEffect {
  id: number
  kind: 'toss'
  type: TossKind
  results: number[]
}

export type StepEffect = ShuffleHandEffect | TossEffect

const SHUFFLE_HAND_DURATION_MS = 1000
const TOSS_DURATION_MS = 1600

export function stepEffectDurationMs(effect: StepEffect): number {
  return effect.kind === 'shuffle-hand' ? SHUFFLE_HAND_DURATION_MS : TOSS_DURATION_MS
}

let stepEffectSeq = 0

export function stepEffectsOfNode(node: EngineTimelineNode | null | undefined): StepEffect[] {
  if (!node) return []
  const activeDuelist = node.boardState.activeDuelist
  return node.events.flatMap((event): StepEffect[] => {
    if (event.kind === 'shuffle-hand') {
      return [
        {
          id: ++stepEffectSeq,
          kind: 'shuffle-hand',
          player: event.player,
          duelistId: activeDuelist?.[event.player] || undefined
        }
      ]
    }
    if (event.kind === 'toss') {
      return [{ id: ++stepEffectSeq, kind: 'toss', type: event.type, results: [...event.results] }]
    }
    return []
  })
}
