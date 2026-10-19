import { CardLocation, DuelActionType, DuelStep, createLightweightSnapshot } from '@shared/index'
import { useDuelEngineStore } from '../useDuelEngineStore'
import { isManualCapturePaused } from './manualCaptureGate'
import { createStepId } from './stepsSlice'
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
  const step: DuelStep = {
    id: createStepId(),
    turn: duel.currentTurn,
    turnPlayer: duel.activeTurnPlayer,
    phase: duel.currentPhase,
    actionPlayer: input.controller ?? duel.activeTurnPlayer,
    actionType: input.actionType,
    cardName: input.cardName,
    description: input.description,
    boardAfter: createLightweightSnapshot(duel.state.cards)
  }

  const selected = duel.currentStepIndex
  const total = (duel.state.steps || []).length
  if (selected !== null && selected < total - 1) {
    duel.insertStep(step)
    duel.setCurrentStepIndex(selected + 1)
  } else {
    duel.addStep(step)
  }
}

export function moveActionType(toLocation: number): DuelActionType {
  if (toLocation === CardLocation.GRAVE) return 'TO_GRAVE'
  if (toLocation === CardLocation.REMOVED) return 'BANISH'
  if (toLocation === CardLocation.HAND) return 'TO_HAND'
  if (toLocation === CardLocation.DECK || toLocation === CardLocation.EXTRA) return 'TO_DECK'
  return 'PLACE'
}
