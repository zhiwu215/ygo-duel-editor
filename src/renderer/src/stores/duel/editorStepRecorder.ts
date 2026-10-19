import { CardLocation, DuelActionType, createLightweightSnapshot } from '@shared/index'
import { useDuelEngineStore } from '../useDuelEngineStore'
import { isManualCapturePaused } from './manualCaptureGate'
import { useDuelStore } from './index'

export interface EditorStepInput {
  actionType: DuelActionType
  controller?: 0 | 1
  cardName?: string
  description: string
}

export function recordEditorStep(input: EditorStepInput): void {
  if (useDuelEngineStore.getState().isInitialized) return
  if (isManualCapturePaused()) return
  const duel = useDuelStore.getState()
  duel.addStep({
    turn: duel.currentTurn,
    turnPlayer: duel.activeTurnPlayer,
    phase: duel.currentPhase,
    actionPlayer: input.controller ?? duel.activeTurnPlayer,
    actionType: input.actionType,
    cardName: input.cardName,
    description: input.description,
    boardAfter: createLightweightSnapshot(duel.state.cards)
  })
}

export function moveActionType(toLocation: number): DuelActionType {
  if (toLocation === CardLocation.GRAVE) return 'TO_GRAVE'
  if (toLocation === CardLocation.REMOVED) return 'BANISH'
  if (toLocation === CardLocation.HAND) return 'TO_HAND'
  if (toLocation === CardLocation.DECK || toLocation === CardLocation.EXTRA) return 'TO_DECK'
  return 'PLACE'
}
