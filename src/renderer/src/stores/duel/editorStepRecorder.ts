import {
  CardLocation,
  DuelActionType,
  DuelStep,
  LightweightCardSnapshot,
  ManualOp,
  createLightweightSnapshot,
  createStepId
} from '@shared/index'
import { useDuelEngineStore } from '../useDuelEngineStore'
import { isManualCapturePaused } from './manualCaptureGate'
import { useDuelStore } from './index'

export interface EditorStepInput {
  actionType: DuelActionType
  controller?: 0 | 1
  instanceId?: string
  cardCode?: number
  cardName?: string
  fromLocation?: number
  fromSequence?: number
  toLocation?: number
  toSequence?: number
  fromController?: 0 | 1
  toController?: 0 | 1
  fromPosition?: number
  toPosition?: number
  targetInstanceId?: string
  targetCardName?: string
  targetPlayer?: 0 | 1
  description: string
  op?: ManualOp
  ops?: ManualOp[]
  lpChange?: { player: 0 | 1; oldLp: number; newLp: number }
  boardAfter?: LightweightCardSnapshot[]
}

export interface StepLabel {
  actionType: DuelActionType
  description?: string
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
    instanceId: input.instanceId,
    cardCode: input.cardCode,
    cardName: input.cardName,
    fromLocation: input.fromLocation,
    fromSequence: input.fromSequence,
    toLocation: input.toLocation,
    toSequence: input.toSequence,
    fromController: input.fromController,
    toController: input.toController,
    fromPosition: input.fromPosition,
    toPosition: input.toPosition,
    targetInstanceId: input.targetInstanceId,
    targetCardName: input.targetCardName,
    targetPlayer: input.targetPlayer,
    description: input.description,
    manualOps: input.ops ?? (input.op ? [input.op] : undefined),
    lpChange: input.lpChange,
    boardAfter: input.boardAfter ?? createLightweightSnapshot(duel.state.cards)
  }

  const selected = duel.currentStepIndex
  const total = (duel.state.steps || []).length
  if (selected !== null) {
    if (selected < total - 1) {
      duel.insertStep(step)
    } else {
      duel.addStep(step)
    }
    duel.previewStepBoard(selected + 1)
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
