import type { EngineStepEvent } from '../types/duelEngine'

export const HAND_SHUFFLE_NOTE = '手牌切洗'

export function hasHandShuffle(events: EngineStepEvent[]): boolean {
  return events.some((event) => event.kind === 'shuffle-hand')
}

export function isHandShuffleNote(text: string | undefined): boolean {
  return text?.includes(HAND_SHUFFLE_NOTE) ?? false
}

export function withHandShuffleNote(description: string, events: EngineStepEvent[]): string {
  if (!hasHandShuffle(events) || isHandShuffleNote(description)) return description
  return `${description}（${HAND_SHUFFLE_NOTE}）`
}
