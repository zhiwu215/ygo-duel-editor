import {
  CardLocation,
  DuelPhase,
  DuelPuzzleState,
  DuelStep,
  LightweightCardSnapshot,
  defaultPositionForLocation,
  resolveOpeningSnapshot
} from '@shared/index'

export const SCENE_STEP_INDEX = -1

export interface OpeningScene {
  cards: LightweightCardSnapshot[]
  lp: [number, number]
  turn: number
  phase: DuelPhase
  turnPlayer: 0 | 1
}

function isPileZone(location: number): boolean {
  return (
    location === CardLocation.HAND ||
    location === CardLocation.GRAVE ||
    location === CardLocation.DECK ||
    location === CardLocation.EXTRA ||
    location === CardLocation.REMOVED
  )
}

function cloneBoard(cards: LightweightCardSnapshot[]): LightweightCardSnapshot[] {
  return cards.map((card) => ({ ...card, overlayMaterials: [...card.overlayMaterials] }))
}

function restoreCardTo(
  board: LightweightCardSnapshot[],
  card: LightweightCardSnapshot,
  location: number,
  sequence: number | undefined,
  controller: 0 | 1 | undefined,
  position: number | undefined
): void {
  const rest = board.filter((item) => item !== card)
  const nextController = controller ?? card.controller
  const nextSequence = sequence ?? 0
  const sameZone = card.location === location
  if (isPileZone(location)) {
    for (const other of rest) {
      if (
        other.controller === nextController &&
        other.location === location &&
        other.sequence >= nextSequence &&
        (other.duelistId ?? null) === (card.duelistId ?? null)
      ) {
        other.sequence += 1
      }
    }
  }
  card.location = location
  card.sequence = nextSequence
  card.controller = nextController
  card.owner = nextController
  card.position = position ?? (sameZone ? card.position : defaultPositionForLocation(location))
  rest.push(card)
  board.length = 0
  board.push(...rest)
}

function reverseStepBoard(step: DuelStep): LightweightCardSnapshot[] | null {
  if (!step.boardAfter || step.boardAfter.length === 0) return null
  const board = cloneBoard(step.boardAfter)
  const ops = step.manualOps ?? []

  if (ops.length > 0) {
    if (ops.length > 1) return null
    const op = ops[0]
    if (op.type === 'lp') return board
    if (op.type === 'remove') return null
    if (op.type === 'add') {
      const index = board.findIndex((item) => item.instanceId === op.instanceId)
      if (index < 0) return null
      board.splice(index, 1)
      return board
    }
    if (op.type === 'position') {
      const card = board.find((item) => item.instanceId === op.instanceId)
      if (!card) return null
      card.position = step.fromPosition ?? card.position
      return board
    }
    const card = board.find((item) => item.instanceId === op.instanceId)
    if (!card || step.fromLocation === undefined) return null
    restoreCardTo(
      board,
      card,
      step.fromLocation,
      step.fromSequence,
      step.fromController,
      step.fromPosition
    )
    return board
  }

  if (step.actionType === 'PHASE_CHANGE' || step.actionType === 'TURN_CHANGE') return board

  const card = step.instanceId
    ? board.find((item) => item.instanceId === step.instanceId)
    : undefined
  if (card && step.fromLocation !== undefined && step.toLocation !== undefined) {
    if (step.fromLocation === step.toLocation) {
      card.position = step.fromPosition ?? card.position
      return board
    }
    restoreCardTo(
      board,
      card,
      step.fromLocation,
      step.fromSequence,
      step.fromController,
      step.fromPosition
    )
    return board
  }

  if (step.actionType === 'DRAW' && step.cardCode) {
    const drawn = board.find(
      (item) =>
        item.code === step.cardCode &&
        item.location === CardLocation.HAND &&
        item.controller === step.actionPlayer
    )
    if (!drawn) return null
    restoreCardTo(
      board,
      drawn,
      CardLocation.DECK,
      step.fromSequence ?? 0,
      step.fromController ?? step.actionPlayer,
      step.fromPosition
    )
    return board
  }

  return null
}

function resolveSceneLp(state: DuelPuzzleState, first: DuelStep): [number, number] {
  const lp: [number, number] = state.initialLp
    ? [state.initialLp[0], state.initialLp[1]]
    : [state.players[0]?.lp ?? 8000, state.players[1]?.lp ?? 8000]
  if (first.lpChange) lp[first.lpChange.player] = first.lpChange.oldLp
  return lp
}

function snapshotMatchesStep(snapshot: LightweightCardSnapshot[], step: DuelStep): boolean {
  if (step.actionType === 'PHASE_CHANGE' || step.actionType === 'TURN_CHANGE') return true
  const ops = step.manualOps
  const op = ops && ops.length === 1 ? ops[0] : undefined
  if (op?.type === 'add' || op?.type === 'lp') return true
  const location = step.fromLocation
  if (location === undefined) return true
  if (op?.type === 'position') {
    return snapshot.some((card) => card.instanceId === op.instanceId && card.location === location)
  }
  const instanceId = op?.type === 'move' ? op.instanceId : step.instanceId
  if (instanceId) {
    return snapshot.some((card) => card.instanceId === instanceId && card.location === location)
  }
  if (step.cardCode) {
    return snapshot.some((card) => card.code === step.cardCode && card.location === location)
  }
  return true
}

export function sceneSignature(scene: OpeningScene): string {
  const cards = [...scene.cards]
    .sort((left, right) =>
      left.instanceId < right.instanceId ? -1 : left.instanceId > right.instanceId ? 1 : 0
    )
    .map((card) => ({
      instanceId: card.instanceId,
      code: card.code,
      controller: card.controller,
      owner: card.owner ?? card.controller,
      location: card.location,
      sequence: card.sequence,
      position: card.position,
      overlayMaterials: card.overlayMaterials,
      duelistId: card.duelistId,
      customAtk: card.customAtk,
      customDef: card.customDef
    }))
  return JSON.stringify({
    cards,
    lp: scene.lp,
    turn: scene.turn,
    phase: scene.phase,
    turnPlayer: scene.turnPlayer
  })
}

export function resolveOpeningScene(state: DuelPuzzleState): OpeningScene | null {
  const steps = state.steps ?? []
  const first = steps[0]
  if (!first) {
    const snapshot = resolveOpeningSnapshot(state)
    if (!snapshot || snapshot.length === 0) return null
    return {
      cards: snapshot,
      lp: state.initialLp
        ? [state.initialLp[0], state.initialLp[1]]
        : [state.players[0]?.lp ?? 8000, state.players[1]?.lp ?? 8000],
      turn: 1,
      phase: 'DP',
      turnPlayer: state.turnPlayer
    }
  }

  const isMarker = first.actionType === 'PHASE_CHANGE' || first.actionType === 'TURN_CHANGE'
  const firstAction = steps.find(
    (step) => step.actionType !== 'PHASE_CHANGE' && step.actionType !== 'TURN_CHANGE'
  )
  const boardSource = firstAction ?? first
  const derived = firstAction ? reverseStepBoard(firstAction) : null
  const snapshot = resolveOpeningSnapshot(state)
  const preferSnapshot = snapshot ? snapshotMatchesStep(snapshot, boardSource) : false
  const cards = snapshot && preferSnapshot ? snapshot : (derived ?? snapshot)
  if (!cards) return null

  return {
    cards,
    lp: resolveSceneLp(state, boardSource),
    turn: firstAction ? firstAction.turn : first.turn,
    phase: firstAction ? firstAction.phase : isMarker ? 'DP' : first.phase,
    turnPlayer: firstAction ? firstAction.turnPlayer : first.turnPlayer
  }
}
