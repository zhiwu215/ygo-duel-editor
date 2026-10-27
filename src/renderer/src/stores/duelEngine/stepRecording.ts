import {
  Answer,
  CardLocation,
  CardPosition,
  CardUtils,
  DuelActionType,
  DuelLogCardRef,
  DuelLogEvent,
  DuelStep,
  EngineBoardState,
  EngineDiffResult,
  EngineTimelineNode,
  LOCATION_NAMES,
  RequestCard,
  createLightweightSnapshot,
  createStepId,
  withHandShuffleNote
} from '@shared/index'
import { resolveCardName } from '../../utils/cardNames'
import { useDuelStore } from '../useDuelStore'
import { mapPhaseToDuelPhase } from './boardReconcile'
import { getEditorId } from './identityMap'
import { findHostStep, hasEngineStep, recordEngineStep, storeEngineStep } from './stepRecords'

const DISCARD_DESC_HINT = 501
const TARGET_DESC_HINT = 551

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

const SPECIAL_SUMMON_TYPES: Record<string, DuelActionType> = {
  fusion: 'FUSION_SUMMON',
  synchro: 'SYNCHRO_SUMMON',
  xyz: 'XYZ_SUMMON',
  link: 'LINK_SUMMON',
  ritual: 'RITUAL_SUMMON'
}

function humanizeEngineLog(text: string): string {
  return text
    .replace(/^Player 0: /, '我方：')
    .replace(/^Player 1: /, '对方：')
    .replace(/\s*\[\s*\]\s*$/, '')
}

function activeDuelistIdOf(node: EngineTimelineNode, team: 0 | 1): string | undefined {
  return node.boardState.activeDuelist?.[team]
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

function matchesCard(card: DuelLogCardRef, request: RequestCard): boolean {
  return card.code === request.code && card.controller === request.controller
}

function eventToSnapshot(
  event: DuelLogEvent
): { card: DuelLogCardRef; from?: DuelLogCardRef } | null {
  if (event.kind === 'summon' || event.kind === 'set' || event.kind === 'activate') {
    return { card: event.card, from: event.from }
  }
  if (event.kind === 'move') return { card: event.move.card, from: event.move.from }
  return null
}

function findActionEvent(
  events: DuelLogEvent[],
  request: RequestCard | undefined
): DuelLogEvent | undefined {
  if (!request) return undefined
  for (const event of events) {
    const snapshot = eventToSnapshot(event)
    if (snapshot && matchesCard(snapshot.card, request)) return event
  }
  return undefined
}

function setActionType(card: DuelLogCardRef): DuelActionType {
  const type = useDuelStore.getState().state.cards.find((item) => item.code === card.code)
    ?.card?.type
  return type && CardUtils.isMonster(type) ? 'SET_MONSTER' : 'SET_SPELL_TRAP'
}

function isFieldZoneCard(card: DuelLogCardRef): boolean {
  return (
    card.location === CardLocation.FZONE ||
    (card.location === CardLocation.SZONE && card.sequence === 5)
  )
}

function mergeLogEvents(
  base: DuelLogEvent[] | undefined,
  extra: DuelLogEvent[] | undefined
): DuelLogEvent[] | undefined {
  if (!extra || extra.length === 0) return base
  return [...(base ?? []), ...extra]
}

function lpChangeFromEvents(
  events: DuelLogEvent[],
  board: EngineBoardState | null
): DuelStep['lpChange'] | undefined {
  if (!board) return undefined
  const changed = events.filter(
    (event) =>
      event.kind === 'damage' ||
      event.kind === 'recover' ||
      (event.kind === 'lp-update' && event.delta !== 0)
  )
  if (changed.length === 0) return undefined
  const last = changed[changed.length - 1]
  if (last.kind === 'damage') {
    const newLp = board.players[last.player].lp
    return { player: last.player, oldLp: newLp + last.value, newLp }
  }
  if (last.kind === 'recover') {
    const newLp = board.players[last.player].lp
    return { player: last.player, oldLp: newLp - last.value, newLp }
  }
  if (last.kind === 'lp-update') {
    return { player: last.player, oldLp: last.lp - last.delta, newLp: last.lp }
  }
  return undefined
}

function appendNodeLogs(host: { id: string; step: DuelStep }, node: EngineTimelineNode): DuelStep {
  return {
    ...host.step,
    logEvents: mergeLogEvents(host.step.logEvents, node.logEvents),
    boardAfter: createLightweightSnapshot(useDuelStore.getState().state.cards)
  }
}

function summonKindActionType(kind: string): DuelActionType {
  if (kind === 'normal') return 'NORMAL_SUMMON'
  if (kind === 'flip') return 'FLIP_SUMMON'
  return SPECIAL_SUMMON_TYPES[kind] ?? 'SPECIAL_SUMMON'
}

function isSummonAction(type: DuelActionType): boolean {
  return (
    type === 'NORMAL_SUMMON' ||
    type === 'SPECIAL_SUMMON' ||
    type === 'FLIP_SUMMON' ||
    type === 'XYZ_SUMMON' ||
    type === 'FUSION_SUMMON' ||
    type === 'SYNCHRO_SUMMON' ||
    type === 'LINK_SUMMON' ||
    type === 'RITUAL_SUMMON'
  )
}

function summaryPatch(step: DuelStep, events: DuelLogEvent[]): Partial<DuelStep> {
  if (!step.cardCode) return {}
  for (const event of events) {
    const snapshot = eventToSnapshot(event)
    if (!snapshot || snapshot.card.code !== step.cardCode) continue
    if (event.kind === 'summon') {
      if (!isSummonAction(step.actionType)) continue
      return {
        actionType: summonKindActionType(event.summonKind),
        fromLocation: snapshot.from?.location ?? step.fromLocation,
        fromSequence: snapshot.from?.sequence ?? step.fromSequence,
        fromController: snapshot.from?.controller ?? step.fromController,
        toLocation: snapshot.card.location,
        toSequence: snapshot.card.sequence,
        toController: snapshot.card.controller,
        toPosition: snapshot.card.position
      }
    }
    if (event.kind === 'set') {
      if (step.actionType !== 'SET_MONSTER' && step.actionType !== 'SET_SPELL_TRAP') continue
      return {
        actionType: setActionType(event.card),
        fromLocation: snapshot.from?.location ?? step.fromLocation,
        fromSequence: snapshot.from?.sequence ?? step.fromSequence,
        fromController: snapshot.from?.controller ?? step.fromController,
        toLocation: snapshot.card.location,
        toSequence: snapshot.card.sequence,
        toController: snapshot.card.controller,
        toPosition: snapshot.card.position
      }
    }
    if (event.kind === 'activate') {
      if (
        step.actionType !== 'ACTIVATE' &&
        step.actionType !== 'ACTIVATE_FIELD' &&
        step.actionType !== 'CHAIN' &&
        step.actionType !== 'SET_PENDULUM'
      ) {
        continue
      }
      return {
        actionType:
          step.actionType === 'ACTIVATE' && isFieldZoneCard(snapshot.card)
            ? 'ACTIVATE_FIELD'
            : step.actionType,
        fromLocation: snapshot.from?.location ?? step.fromLocation,
        fromSequence: snapshot.from?.sequence ?? step.fromSequence,
        fromController: snapshot.from?.controller ?? step.fromController,
        toLocation: snapshot.card.location,
        toSequence: snapshot.card.sequence,
        toController: snapshot.card.controller,
        toPosition: snapshot.card.position
      }
    }
  }
  return {}
}

function patchHostStep(
  host: { id: string; step: DuelStep },
  node: EngineTimelineNode,
  patch: Partial<DuelStep>
): void {
  const next = appendNodeLogs(host, node)
  const summary = summaryPatch(host.step, node.logEvents ?? [])
  storeEngineStep(host.id, null, {
    ...next,
    ...summary,
    ...patch,
    description: withHandShuffleNote(next.description ?? '', node.events),
    endActId: node.id
  })
}

function targetCardsOf(events: DuelLogEvent[], selected: RequestCard[]): DuelLogCardRef[] {
  for (let i = events.length - 1; i >= 0; i--) {
    const event = events[i]
    if (event.kind === 'target') return event.cards
  }
  return selected.map((card) => ({
    code: card.code,
    name: resolveCardName(card.code),
    controller: card.controller,
    location: card.location,
    sequence: card.sequence
  }))
}

function targetPatch(
  node: EngineTimelineNode,
  selected: RequestCard[],
  board: EngineBoardState | null,
  descHint?: number
): Partial<DuelStep> {
  const events = node.logEvents ?? []
  if (descHint !== TARGET_DESC_HINT && !events.some((event) => event.kind === 'target')) {
    return {}
  }
  const cards = targetCardsOf(events, selected)
  if (cards.length === 0) return {}
  const names = cards.map((card) => card.name ?? resolveCardName(card.code))
  const first = cards[0]
  const engineId = board?.allCards.find(
    (card) =>
      card.code === first.code &&
      card.controller === first.controller &&
      card.location === first.location &&
      card.sequence === first.sequence
  )?.instanceId
  return {
    targetInstanceId: (engineId ? getEditorId(engineId) : undefined) ?? engineId,
    targetCardName: names.join('、'),
    targetPlayer: first.controller
  }
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

function recordMoveSteps(
  node: EngineTimelineNode,
  diff: EngineDiffResult,
  actContext?: StepActContext
): void {
  if (hasEngineStep(node.id)) return
  const moves = diff.movedCards.filter(
    (move) => !(move.fromController === move.toController && move.fromLocation === move.toLocation)
  )
  if (moves.length === 0) return
  moves.forEach((move, index) => {
    const duelStoreState = useDuelStore.getState()
    const cardName = resolveCardName(move.code)
    const step: Omit<DuelStep, 'id'> = {
      turn: actContext?.turn ?? duelStoreState.currentTurn,
      turnPlayer: actContext?.turnPlayer ?? duelStoreState.activeTurnPlayer,
      phase: actContext ? mapPhaseToDuelPhase(actContext.phase) : duelStoreState.currentPhase,
      actionPlayer: move.toController,
      actionDuelistId: activeDuelistIdOf(node, move.toController),
      actionType: moveToActionType(move.toLocation, move.newPosition),
      cardCode: move.code,
      cardName,
      fromLocation: move.fromLocation,
      fromSequence: move.fromSequence,
      toLocation: move.toLocation,
      toSequence: move.toSequence,
      fromController: move.fromController,
      toController: move.toController,
      description: `将「${cardName}」移至${LOCATION_NAMES[move.toLocation] ?? '区域'}`,
      logEvents: index === 0 ? node.logEvents : undefined,
      origin: 'engine',
      boardAfter: createLightweightSnapshot(duelStoreState.state.cards)
    }
    if (index === 0) {
      step.actId = node.id
      step.startActId = node.id
      step.endActId = node.id
    }
    duelStoreState.addStep(step)
    const added = useDuelStore.getState().state.steps?.at(-1)
    if (added && index === 0) recordEngineStep(node.id, added)
  })
}

function recordDiscardSteps(
  selected: RequestCard[],
  node: EngineTimelineNode,
  actContext?: StepActContext
): void {
  if (selected.length === 0) return
  selected.forEach((card, index) => {
    const duelStoreState = useDuelStore.getState()
    const cardName = resolveCardName(card.code)
    const step: Omit<DuelStep, 'id'> = {
      turn: actContext?.turn ?? duelStoreState.currentTurn,
      turnPlayer: actContext?.turnPlayer ?? duelStoreState.activeTurnPlayer,
      phase: actContext ? mapPhaseToDuelPhase(actContext.phase) : duelStoreState.currentPhase,
      actionPlayer: card.controller,
      actionDuelistId: activeDuelistIdOf(node, card.controller),
      actionType: 'TO_GRAVE',
      cardCode: card.code,
      cardName,
      fromLocation: card.location,
      fromSequence: card.sequence,
      toLocation: CardLocation.GRAVE,
      fromController: card.controller,
      toController: card.controller,
      description: `将「${cardName}」丢弃至${LOCATION_NAMES[CardLocation.GRAVE] ?? '墓地'}`,
      logEvents: index === 0 ? node.logEvents : undefined,
      origin: 'engine',
      boardAfter: createLightweightSnapshot(duelStoreState.state.cards)
    }
    if (index === 0) {
      step.actId = node.id
      step.startActId = node.id
      step.endActId = node.id
    }
    duelStoreState.addStep(step)
    const added = useDuelStore.getState().state.steps?.at(-1)
    if (added && index === 0) recordEngineStep(node.id, added)
  })
}

function buildActionStep(
  node: EngineTimelineNode,
  actContext: StepActContext | undefined,
  actionType: DuelActionType,
  card: RequestCard | undefined,
  events: DuelLogEvent[],
  board: EngineBoardState | null
): Omit<DuelStep, 'id'> {
  const duelStoreState = useDuelStore.getState()
  const actionEvent = findActionEvent(events, card)
  const snapshot = actionEvent ? eventToSnapshot(actionEvent) : null
  const resolvedCardCode = snapshot?.card.code ?? card?.code
  const resolvedCardName = resolvedCardCode ? resolveCardName(resolvedCardCode) : undefined
  const refinedType =
    actionEvent?.kind === 'summon'
      ? summonKindActionType(actionEvent.summonKind)
      : actionEvent?.kind === 'set'
        ? setActionType(actionEvent.card)
        : actionEvent?.kind === 'activate' && actionType === 'ACTIVATE'
          ? isFieldZoneCard(actionEvent.card)
            ? 'ACTIVATE_FIELD'
            : undefined
          : undefined
  const chainEvent = events.find(
    (event): event is Extract<DuelLogEvent, { kind: 'activate' }> =>
      event.kind === 'activate' && card !== undefined && event.card.code === card.code
  )
  const directAttack = actionEvent?.kind === 'attack' && actionEvent.direct

  return {
    turn: actContext?.turn ?? duelStoreState.currentTurn,
    turnPlayer: actContext?.turnPlayer ?? duelStoreState.activeTurnPlayer,
    phase: actContext ? mapPhaseToDuelPhase(actContext.phase) : duelStoreState.currentPhase,
    actionPlayer: node.player,
    actionDuelistId: activeDuelistIdOf(node, node.player),
    actionType: refinedType ?? actionType,
    actId: node.id,
    startActId: node.id,
    endActId: node.id,
    cardCode: resolvedCardCode,
    cardName: resolvedCardName,
    fromLocation: snapshot?.from?.location ?? card?.location,
    fromSequence: snapshot?.from?.sequence ?? card?.sequence,
    toLocation: snapshot?.card.location ?? card?.location,
    toSequence: snapshot?.card.sequence ?? card?.sequence,
    fromController: snapshot?.from?.controller ?? card?.controller,
    toController: snapshot?.card.controller ?? card?.controller,
    fromPosition: snapshot?.from?.position ?? undefined,
    toPosition: snapshot?.card.position ?? undefined,
    chainIndex: chainEvent && chainEvent.chainCount > 1 ? chainEvent.chainCount : undefined,
    targetPlayer: directAttack ? (node.player === 0 ? 1 : 0) : undefined,
    description: humanizeEngineLog(node.title),
    logEvents: node.logEvents,
    lpChange: lpChangeFromEvents(events, board),
    origin: 'engine',
    boardAfter: createLightweightSnapshot(duelStoreState.state.cards)
  }
}

export interface StepActContext {
  turn: number
  turnPlayer: 0 | 1
  phase: number
}

export function recordOpeningStep(node: EngineTimelineNode, boardState: EngineBoardState): void {
  const events = node.logEvents ?? []
  const draw = events.find(
    (event): event is Extract<DuelLogEvent, { kind: 'draw' }> => event.kind === 'draw'
  )
  if (!draw) return
  const steps = useDuelStore.getState().state.steps || []
  if (steps.some((step) => step.actId === node.id)) return
  const first = draw.cards[0]
  const step: DuelStep = {
    id: createStepId(),
    turn: boardState.turn,
    turnPlayer: boardState.turnPlayer,
    phase: 'DP',
    actionPlayer: draw.player,
    actionDuelistId: boardState.activeDuelist?.[draw.player],
    actionType: 'DRAW',
    cardCode: first?.code || undefined,
    cardName: first?.code ? first.name || resolveCardName(first.code) : undefined,
    description: `抽卡 ×${draw.cards.length || 1}`,
    logEvents: [draw],
    origin: 'engine',
    actId: node.id,
    boardAfter: createLightweightSnapshot(useDuelStore.getState().state.cards)
  }
  useDuelStore.setState((prev) => ({
    ...prev,
    currentStepIndex: null,
    selectedStepId: null,
    state: {
      ...prev.state,
      steps: [step, ...(prev.state.steps || [])]
    }
  }))
}

export function appendEngineStepFromAnswer(
  answer: Answer,
  node: EngineTimelineNode,
  diff: EngineDiffResult,
  timeline: EngineTimelineNode[],
  boardState: EngineBoardState | null,
  actContext?: StepActContext,
  descHint?: number
): void {
  const events = node.logEvents ?? []
  const lpChange = lpChangeFromEvents(events, boardState)

  if (answer.kind === 'card') {
    const host = findHostStep(node, timeline)
    if (host) {
      patchHostStep(host, node, {
        ...targetPatch(node, answer.cards ?? [], boardState, descHint),
        ...(lpChange ? { lpChange } : {})
      })
      return
    }
    if (descHint === DISCARD_DESC_HINT && answer.cards && answer.cards.length > 0) {
      recordDiscardSteps(answer.cards, node, actContext)
      return
    }
    recordMoveSteps(node, diff, actContext)
    return
  }

  const actionKey = answerToEngineStepAction(answer)
  const actionType = actionKey ? ENGINE_STEP_TYPES[actionKey] : undefined
  if (!actionType) {
    const host = findHostStep(node, timeline)
    if (host && (events.length > 0 || hasBoardChange(diff))) {
      patchHostStep(host, node, lpChange ? { lpChange } : {})
      return
    }
    recordMoveSteps(node, diff, actContext)
    return
  }
  if (hasEngineStep(node.id)) return

  const card = answerCardOf(answer)
  const step = buildActionStep(node, actContext, actionType, card, events, boardState)
  useDuelStore.getState().addStep(step)
  const added = useDuelStore.getState().state.steps?.at(-1)
  if (added) recordEngineStep(node.id, added)
}
