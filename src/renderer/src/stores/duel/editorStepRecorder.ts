import {
  CardLocation,
  CardPosition,
  DuelActionType,
  DuelStep,
  LightweightCardSnapshot,
  ManualOp,
  createLightweightSnapshot,
  createStepId
} from '@shared/index'
import { useDuelEngineStore } from '../useDuelEngineStore'
import { useDuelStore } from './index'

export interface EditorStepInput {
  actionType: DuelActionType
  controller?: 0 | 1
  duelistId?: string
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
  const duel = useDuelStore.getState()
  const actionPlayer = input.controller ?? duel.activeTurnPlayer
  const viewerDuelistId = duel.activeDuelistIds[actionPlayer]
  const teamDuelists = (duel.state.duelists || []).filter((d) => d.team === actionPlayer)
  const actionDuelist =
    (input.duelistId
      ? teamDuelists.find((duelist) => duelist.id === input.duelistId)
      : undefined) ??
    teamDuelists.find((duelist) => duelist.id === viewerDuelistId) ??
    teamDuelists[0]
  const step: DuelStep = {
    id: createStepId(),
    turn: duel.currentTurn,
    turnPlayer: duel.activeTurnPlayer,
    phase: duel.currentPhase,
    actionPlayer,
    actionDuelistId: input.duelistId ?? actionDuelist?.id,
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
    origin: 'manual',
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

export function resolveMoveStepLabel(
  fromLocation: number | undefined,
  toLocation: number,
  toPosition: number,
  name?: string
): StepLabel | null {
  if (fromLocation !== CardLocation.HAND) return null
  const label = name ? `【${name}】` : '卡片'
  if (toLocation === CardLocation.MZONE) {
    if (toPosition === CardPosition.FACEDOWN_DEFENSE) {
      return { actionType: 'SET_MONSTER', description: `盖放${label}` }
    }
    if (toPosition === CardPosition.FACEUP_DEFENSE) {
      return { actionType: 'NORMAL_SUMMON', description: `召唤${label}（守备）` }
    }
    return { actionType: 'NORMAL_SUMMON', description: `召唤${label}` }
  }
  if (toLocation === CardLocation.SZONE) {
    if (toPosition === CardPosition.FACEDOWN) {
      return { actionType: 'SET_SPELL_TRAP', description: `盖放${label}` }
    }
    return { actionType: 'ACTIVATE', description: `发动${label}` }
  }
  if (toLocation === CardLocation.PZONE) {
    return { actionType: 'SET_PENDULUM', description: `设置${label}` }
  }
  if (toLocation === CardLocation.FZONE) {
    return { actionType: 'ACTIVATE_FIELD', description: `发动场地${label}` }
  }
  return null
}
