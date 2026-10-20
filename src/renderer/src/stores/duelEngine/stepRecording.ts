import {
  Answer,
  CardLocation,
  CardPosition,
  DuelActionType,
  DuelStep,
  EngineBoardState,
  EngineDiffResult,
  EngineTimelineNode,
  LOCATION_NAMES,
  RequestCard,
  createLightweightSnapshot
} from '@shared/index'
import { resolveCardName } from '../../utils/cardNames'
import { useDuelStore } from '../useDuelStore'
import { mapPhaseToDuelPhase } from './boardReconcile'
import { getEditorId } from './identityMap'
import { findHostStep, hasEngineStep, recordEngineStep, storeEngineStep } from './stepRecords'

type EngineStepAction =
  | 'SUMMON'
  | 'SPSUMMON'
  | 'MSET'
  | 'SSET'
  | 'ACTIVATE'
  | 'REPOS'
  | 'ATTACK'
  | 'BP'
  | 'M2'
  | 'EP'
  | 'CHAIN'

const ENGINE_STEP_TYPES: Partial<Record<EngineStepAction, DuelActionType>> = {
  SUMMON: 'NORMAL_SUMMON',
  SPSUMMON: 'SPECIAL_SUMMON',
  MSET: 'SET_MONSTER',
  SSET: 'SET_SPELL_TRAP',
  ACTIVATE: 'ACTIVATE',
  REPOS: 'CHANGE_POS',
  ATTACK: 'ATTACK',
  BP: 'PHASE_CHANGE',
  M2: 'PHASE_CHANGE',
  EP: 'PHASE_CHANGE',
  CHAIN: 'CHAIN'
}

function humanizeEngineLog(text: string): string {
  return text.replace(/^Player 0: /, '我方：').replace(/^Player 1: /, '对方：')
}

function answerCardOf(answer: Answer): RequestCard | undefined {
  if (answer.kind === 'idle' || answer.kind === 'battle') return answer.card
  if (answer.kind === 'chain') return answer.card ?? undefined
  return undefined
}

function answerToEngineStepAction(answer: Answer): EngineStepAction | undefined {
  if (answer.kind === 'idle') {
    const map: Partial<Record<string, EngineStepAction>> = {
      SUMMON: 'SUMMON',
      SPSUMMON: 'SPSUMMON',
      MSET: 'MSET',
      SSET: 'SSET',
      REPOS: 'REPOS',
      ACTIVATE: 'ACTIVATE',
      TO_BP: 'BP',
      TO_EP: 'EP'
    }
    return map[answer.cmd]
  }
  if (answer.kind === 'battle') {
    const map: Partial<Record<string, EngineStepAction>> = {
      ATTACK: 'ATTACK',
      ACTIVATE: 'ACTIVATE',
      TO_M2: 'M2',
      TO_EP: 'EP'
    }
    return map[answer.cmd]
  }
  if (answer.kind === 'chain') return answer.card ? 'CHAIN' : undefined
  return undefined
}

function hasBoardChange(diff: EngineDiffResult): boolean {
  return (
    diff.movedCards.length > 0 ||
    diff.addedCards.length > 0 ||
    diff.removedCards.length > 0 ||
    diff.positionChanges.length > 0 ||
    diff.lpChanges.length > 0 ||
    diff.counterChanges.length > 0 ||
    diff.overlayChanges.length > 0
  )
}

function patchPlacementStep(
  answer: Extract<Answer, { kind: 'place' }>,
  node: EngineTimelineNode,
  timeline: EngineTimelineNode[]
): void {
  const place = answer.places[0]
  if (!place) return
  const host = findHostStep(node, timeline)
  if (!host) return
  storeEngineStep(host.id, node.id, {
    ...host.step,
    toLocation: place.location,
    toSequence: place.sequence,
    boardAfter: createLightweightSnapshot(useDuelStore.getState().state.cards)
  })
}

function patchCompletedStep(
  node: EngineTimelineNode,
  diff: EngineDiffResult,
  timeline: EngineTimelineNode[]
): void {
  if (!hasBoardChange(diff)) return
  const host = findHostStep(node, timeline)
  if (!host) return
  const moved = host.step.cardCode
    ? diff.movedCards.find((m) => m.code === host.step.cardCode)
    : undefined
  storeEngineStep(host.id, node.id, {
    ...host.step,
    toLocation: moved?.toLocation ?? host.step.toLocation,
    toSequence: moved?.toSequence ?? host.step.toSequence,
    boardAfter: createLightweightSnapshot(useDuelStore.getState().state.cards)
  })
}

function patchTargetStep(
  selected: RequestCard[],
  node: EngineTimelineNode,
  timeline: EngineTimelineNode[],
  boardState: EngineBoardState | null
): void {
  if (selected.length === 0) return
  const host = findHostStep(node, timeline)
  if (!host) return
  const stored = host.step
  const first = selected[0]
  const engineId = boardState?.allCards.find(
    (c) =>
      c.code === first.code &&
      c.controller === first.controller &&
      c.location === first.location &&
      c.sequence === first.sequence
  )?.instanceId
  const names = selected.map((c) => resolveCardName(c.code))

  storeEngineStep(host.id, null, {
    ...stored,
    targetInstanceId:
      (engineId ? getEditorId(engineId) : undefined) ?? engineId ?? stored.targetInstanceId,
    targetCardName: names.join('、'),
    targetPlayer: first.controller
  })
}

function moveToActionType(toLocation: number, newPosition: number): DuelActionType {
  if (toLocation === CardLocation.HAND) return 'TO_HAND'
  if (toLocation === CardLocation.GRAVE) return 'TO_GRAVE'
  if (toLocation === CardLocation.REMOVED) return 'BANISH'
  if (toLocation === CardLocation.DECK || toLocation === CardLocation.EXTRA) return 'TO_DECK'
  if (toLocation === CardLocation.FZONE) return 'ACTIVATE_FIELD'
  if (toLocation === CardLocation.PZONE) return 'SET_PENDULUM'
  const facedown = (newPosition & CardPosition.FACEDOWN) !== 0
  if (toLocation === CardLocation.MZONE) return facedown ? 'SET_MONSTER' : 'SPECIAL_SUMMON'
  if (toLocation === CardLocation.SZONE) return facedown ? 'SET_SPELL_TRAP' : 'ACTIVATE'
  return 'PLACE'
}

function recordTargetMoveSteps(
  node: EngineTimelineNode,
  diff: EngineDiffResult,
  timeline: EngineTimelineNode[],
  actContext?: StepActContext
): void {
  if (hasEngineStep(node.id)) return
  const hostCardCode = findHostStep(node, timeline)?.step.cardCode
  const moves = diff.movedCards.filter(
    (m) =>
      m.code !== hostCardCode &&
      !(m.fromController === m.toController && m.fromLocation === m.toLocation)
  )
  if (moves.length === 0) return

  moves.forEach((m, index) => {
    const duelStoreState = useDuelStore.getState()
    const cardName = resolveCardName(m.code)
    const step: Omit<DuelStep, 'id'> = {
      turn: actContext?.turn ?? duelStoreState.currentTurn,
      turnPlayer: actContext?.turnPlayer ?? duelStoreState.activeTurnPlayer,
      phase: actContext ? mapPhaseToDuelPhase(actContext.phase) : duelStoreState.currentPhase,
      actionPlayer: m.toController,
      actionType: moveToActionType(m.toLocation, m.newPosition),
      cardCode: m.code,
      cardName,
      fromLocation: m.fromLocation,
      fromSequence: m.fromSequence,
      toLocation: m.toLocation,
      toSequence: m.toSequence,
      fromController: m.fromController,
      toController: m.toController,
      description: `将【${cardName}】移至${LOCATION_NAMES[m.toLocation] ?? '区域'}`,
      boardAfter: createLightweightSnapshot(useDuelStore.getState().state.cards)
    }
    if (index === 0) step.actId = node.id
    useDuelStore.getState().addStep(step)
    const added = useDuelStore.getState().state.steps?.at(-1)
    if (added && index === 0) recordEngineStep(node.id, added)
  })
}

export interface StepActContext {
  turn: number
  turnPlayer: 0 | 1
  phase: number
}

export function appendEngineStepFromAnswer(
  answer: Answer,
  node: EngineTimelineNode,
  diff: EngineDiffResult,
  timeline: EngineTimelineNode[],
  boardState: EngineBoardState | null,
  actContext?: StepActContext
): void {
  if (answer.kind === 'place') {
    patchPlacementStep(answer, node, timeline)
    return
  }

  if (answer.kind === 'card') {
    patchTargetStep(answer.cards ?? [], node, timeline, boardState)
    patchCompletedStep(node, diff, timeline)
    recordTargetMoveSteps(node, diff, timeline, actContext)
    return
  }

  const actionKey = answerToEngineStepAction(answer)
  const actionType = actionKey ? ENGINE_STEP_TYPES[actionKey] : undefined
  if (!actionType) {
    patchCompletedStep(node, diff, timeline)
    return
  }
  if (hasEngineStep(node.id)) return

  const card = answerCardOf(answer)
  const moved = card
    ? diff.movedCards.find(
        (m) =>
          m.code === card.code &&
          m.fromController === card.controller &&
          m.fromLocation === card.location &&
          m.fromSequence === card.sequence
      )
    : undefined
  const positionChange = card
    ? diff.positionChanges.find(
        (pc) =>
          pc.code === card.code &&
          pc.controller === card.controller &&
          pc.location === card.location &&
          pc.sequence === card.sequence
      )
    : undefined

  const duelStoreState = useDuelStore.getState()
  const step: Omit<DuelStep, 'id'> = {
    turn: actContext?.turn ?? duelStoreState.currentTurn,
    turnPlayer: actContext?.turnPlayer ?? duelStoreState.activeTurnPlayer,
    phase: actContext ? mapPhaseToDuelPhase(actContext.phase) : duelStoreState.currentPhase,
    actionPlayer: node.player,
    actionType,
    actId: node.id,
    cardCode: card?.code,
    cardName: card ? resolveCardName(card.code) : undefined,
    fromLocation: card?.location,
    fromSequence: card?.sequence,
    toLocation: moved?.toLocation ?? card?.location,
    toSequence: moved?.toSequence ?? card?.sequence,
    fromController: card?.controller,
    toController: moved?.toController ?? card?.controller,
    fromPosition: positionChange?.oldPosition,
    toPosition: positionChange?.newPosition,
    chainIndex: actionType === 'CHAIN' ? duelStoreState.currentChain + 1 : undefined,
    description: humanizeEngineLog(node.title),
    boardAfter: createLightweightSnapshot(duelStoreState.state.cards)
  }
  useDuelStore.getState().addStep(step)
  const added = useDuelStore.getState().state.steps?.at(-1)
  if (added) recordEngineStep(node.id, added)
}
