import type { StateCreator } from 'zustand'
import {
  DuelPhase,
  DuelStep,
  DuelPuzzleState,
  LightweightCardSnapshot,
  ManualOp,
  PlayerState,
  createLightweightSnapshot,
  createStepId,
  resolveOpeningCards,
  resolveOpeningSnapshot,
  restoreCardsFromSnapshot,
  replayManualSteps
} from '@shared/index'
import { useDuelEngineStore } from '../useDuelEngineStore'
import {
  resolveOpeningScene,
  SCENE_STEP_INDEX,
  sceneSignature,
  type OpeningScene
} from '../../utils/openingScene'
import { isDuelStarted } from '../../utils/duelStart'
import { applyLpToDuelists, createLpFlash } from './lpSlice'
import { insertCardIntoInitialBoard } from './initialBoardInsertion'
import { pickNarrativeStepPatch } from './stepPatch'
import type { DuelStore } from './types'

interface SceneReturnSnapshot {
  state: DuelPuzzleState
  currentTurn: number
  currentPhase: DuelPhase
  currentChain: number
  activeTurnPlayer: 0 | 1
  currentStepIndex: number | null
}

let sceneEntrySignature: string | null = null
let sceneReturnSnapshot: SceneReturnSnapshot | null = null

export interface StepsSlice {
  activeRightTab: 'search' | 'steps'
  currentStepIndex: number | null
  selectedStepId: string | null

  currentTurn: number
  currentPhase: DuelPhase
  currentChain: number
  activeTurnPlayer: 0 | 1
  duelStarted: boolean
  sceneEditing: boolean

  setActiveRightTab: (tab: 'search' | 'steps') => void
  setCurrentStepIndex: (index: number | null) => void
  setSelectedStepId: (id: string | null) => void
  openScreenplayWithStep: (stepId?: string | null) => void

  setCurrentTurn: (turn: number) => void
  setCurrentPhase: (phase: DuelPhase) => void
  setCurrentChain: (chain: number) => void
  resetChain: () => void
  setTurnPlayer: (player: 0 | 1) => void
  setDuelStarted: (started: boolean) => void
  insertPhaseJump: (target: DuelPhase) => void

  addStep: (step: Omit<DuelStep, 'id'>) => void
  insertStep: (step: DuelStep) => void
  updateStep: (stepId: string, patch: Partial<DuelStep>) => void
  deleteStep: (stepId: string) => void
  moveStep: (stepId: string, direction: 'up' | 'down') => void

  insertPhaseChange: () => void
  insertTurnChange: () => void

  previewStepBoard: (stepIndex: number | null) => void
  previewTimelineStart: () => void
  enterSceneMode: () => boolean
  exitSceneMode: () => boolean
  isSceneDirty: () => boolean
}

function scenePatch(prev: DuelStore, scene: OpeningScene): Partial<DuelStore> {
  const cards = restoreCardsFromSnapshot(prev.state.cards, scene.cards)
  const players: [PlayerState, PlayerState] = [
    { ...prev.state.players[0], lp: scene.lp[0] },
    { ...prev.state.players[1], lp: scene.lp[1] }
  ]
  const duelists = applyLpToDuelists(
    applyLpToDuelists(prev.state.duelists, 0, scene.lp[0], prev.state.matchConfig),
    1,
    scene.lp[1],
    prev.state.matchConfig
  )
  return {
    currentStepIndex: SCENE_STEP_INDEX,
    currentTurn: scene.turn,
    currentPhase: scene.phase,
    currentChain: 0,
    activeTurnPlayer: scene.turnPlayer,
    lpFlash: null,
    state: { ...prev.state, cards, players, duelists }
  }
}

function sceneOf(prev: DuelStore): OpeningScene {
  return {
    cards: createLightweightSnapshot(prev.state.cards),
    lp: [prev.state.players[0]?.lp ?? 8000, prev.state.players[1]?.lp ?? 8000],
    turn: prev.currentTurn,
    phase: prev.currentPhase,
    turnPlayer: prev.activeTurnPlayer
  }
}

export { createStepId } from '@shared/index'

interface DerivationSource {
  state: DuelPuzzleState
  currentTurn: number
  currentPhase: DuelPhase
  activeTurnPlayer: 0 | 1
}

interface DerivationPatch {
  state: DuelPuzzleState
  currentTurn: number
  currentPhase: DuelPhase
  activeTurnPlayer: 0 | 1
}

function openingPhaseOf(steps: DuelStep[]): DuelPhase {
  const first = steps[0]
  const isMarker = first.actionType === 'PHASE_CHANGE' || first.actionType === 'TURN_CHANGE'
  return isMarker ? 'DP' : first.phase
}

function initialLpOf(next: DerivationSource): [number, number] {
  return [
    next.state.initialLp?.[0] ?? next.state.players[0]?.lp ?? 8000,
    next.state.initialLp?.[1] ?? next.state.players[1]?.lp ?? 8000
  ]
}

function derivePatch(next: DerivationSource): DerivationPatch | null {
  const steps = next.state.steps || []
  if (steps.length === 0) return null
  const initial = next.state.initialBoardSnapshot
  const hasInitial = Boolean(initial && initial.length > 0)

  const startPhase: DuelPhase = openingPhaseOf(steps)
  const startLp = initialLpOf(next)
  const derived = replayManualSteps(
    hasInitial && initial ? initial : [],
    steps,
    startLp,
    next.state.turnPlayer,
    startPhase
  )

  const positionOf = (index: number): DuelStep => derived.steps[index]
  const mergedSteps = steps.map((s, i) => {
    const d = positionOf(i)
    return s.turn === d.turn && s.turnPlayer === d.turnPlayer && s.phase === d.phase
      ? s
      : { ...s, turn: d.turn, turnPlayer: d.turnPlayer, phase: d.phase }
  })

  const tail = positionOf(steps.length - 1)

  return {
    state: {
      ...next.state,
      steps: hasInitial ? derived.steps : mergedSteps,
      players: hasInitial
        ? [
            { ...next.state.players[0], lp: derived.lp[0] },
            { ...next.state.players[1], lp: derived.lp[1] }
          ]
        : next.state.players
    },
    currentTurn: tail.turn,
    currentPhase: tail.phase,
    activeTurnPlayer: tail.turnPlayer
  }
}

function anchorLpAt(steps: DuelStep[], from: number, finalLp: [number, number]): [number, number] {
  const lp: [number, number] = [finalLp[0], finalLp[1]]
  for (let i = steps.length - 1; i >= from; i--) {
    const lpChange = steps[i].lpChange
    if (lpChange) lp[lpChange.player] = lpChange.oldLp
  }
  return lp
}

function deriveDeletionPatch(prev: DerivationSource, deletedIdx: number): DerivationPatch | null {
  const steps = prev.state.steps || []
  if (steps.length === 0) return null
  const anchorIdx = deletedIdx - 1
  const anchor = anchorIdx >= 0 ? steps[anchorIdx] : undefined
  const initial = prev.state.initialBoardSnapshot
  const hasInitial = Boolean(initial && initial.length > 0)

  let board: LightweightCardSnapshot[]
  let suffixFrom: number
  let startLp: [number, number]
  let startTurn = 1
  let startTurnPlayer: 0 | 1 = prev.state.turnPlayer
  let startPhase: DuelPhase

  if (anchor?.boardAfter && anchor.boardAfter.length > 0) {
    board = anchor.boardAfter
    suffixFrom = anchorIdx + 1
    startTurn = anchor.turn
    startPhase = anchor.phase
    startTurnPlayer = anchor.turnPlayer
    startLp = anchorLpAt(steps, suffixFrom, [
      prev.state.players[0]?.lp ?? 8000,
      prev.state.players[1]?.lp ?? 8000
    ])
  } else if (hasInitial && initial) {
    board = initial
    suffixFrom = 0
    startPhase = openingPhaseOf(steps)
    startLp = initialLpOf(prev)
  } else {
    const fallback = replayManualSteps(
      [],
      steps,
      initialLpOf(prev),
      prev.state.turnPlayer,
      openingPhaseOf(steps)
    )
    const mergedSteps = steps.map((s, i) => {
      const d = fallback.steps[i]
      return s.turn === d.turn && s.turnPlayer === d.turnPlayer && s.phase === d.phase
        ? s
        : { ...s, turn: d.turn, turnPlayer: d.turnPlayer, phase: d.phase }
    })
    const tail = fallback.steps[steps.length - 1]
    return {
      state: { ...prev.state, steps: mergedSteps },
      currentTurn: tail.turn,
      currentPhase: tail.phase,
      activeTurnPlayer: tail.turnPlayer
    }
  }

  const derived = replayManualSteps(
    board,
    steps.slice(suffixFrom),
    startLp,
    startTurnPlayer,
    startPhase,
    startTurn
  )
  const mergedSteps = [...steps.slice(0, suffixFrom), ...derived.steps]
  const tail = derived.steps[derived.steps.length - 1] ?? steps[anchorIdx]

  return {
    state: {
      ...prev.state,
      steps: mergedSteps,
      players: [
        { ...prev.state.players[0], lp: derived.lp[0] },
        { ...prev.state.players[1], lp: derived.lp[1] }
      ]
    },
    currentTurn: tail.turn,
    currentPhase: tail.phase,
    activeTurnPlayer: tail.turnPlayer
  }
}

function withDerivation(nextState: DerivationSource): Partial<DuelStore> {
  if (useDuelEngineStore.getState().isInitialized) {
    return { state: nextState.state }
  }
  const patch = derivePatch(nextState)
  if (!patch) {
    return { state: nextState.state }
  }
  return patch
}

export function insertCardAtPlayhead(
  state: DuelPuzzleState,
  card: LightweightCardSnapshot,
  playhead: number | null
): DuelPuzzleState {
  const steps = state.steps || []
  const initial = state.initialBoardSnapshot
  if (steps.length === 0 || playhead === SCENE_STEP_INDEX) {
    if (!initial || initial.length === 0) return state
    return { ...state, initialBoardSnapshot: insertCardIntoInitialBoard(initial, card) }
  }

  const index = Math.min(Math.max(playhead ?? steps.length - 1, 0), steps.length - 1)
  const op: ManualOp = {
    type: 'add',
    instanceId: card.instanceId,
    code: card.code,
    controller: card.controller,
    location: card.location,
    sequence: card.sequence,
    position: card.position,
    duelistId: card.duelistId
  }
  const nextSteps = steps.map((step, stepIndex) => {
    if (stepIndex !== index) return step
    if (step.origin === 'replay' || step.origin === 'engine') {
      return { ...step, boardAfter: [...(step.boardAfter ?? []), card] }
    }
    return { ...step, manualOps: [...(step.manualOps ?? []), op] }
  })
  return { ...state, steps: nextSteps }
}

export function rederiveBoardSteps(prev: DuelStore, state: DuelPuzzleState): DuelPuzzleState {
  const next = withDerivation({ ...prev, state })
  if (!next.state) return state
  return {
    ...state,
    initialBoardSnapshot: next.state.initialBoardSnapshot,
    steps: next.state.steps
  }
}

function refreshPreviewIfActive(get: () => DuelStore): void {
  if (get().sceneEditing) return
  const index = get().currentStepIndex
  if (index !== null) get().previewStepBoard(index)
}

function derivedPositionAt(
  prev: DerivationSource,
  index: number
): { turn: number; phase: DuelPhase; turnPlayer: 0 | 1 } {
  const steps = prev.state.steps || []
  if (index <= 0 || steps.length === 0) {
    return { turn: prev.currentTurn, phase: prev.currentPhase, turnPlayer: prev.activeTurnPlayer }
  }
  const anchor = steps[Math.min(index, steps.length) - 1]
  return { turn: anchor.turn, phase: anchor.phase, turnPlayer: anchor.turnPlayer }
}

const PHASE_ORDER: DuelPhase[] = ['DP', 'SP', 'M1', 'BP', 'M2', 'EP']

type MarkerPosition = { turn: number; phase: DuelPhase; turnPlayer: 0 | 1 }

function insertMarkerAtPlayhead(
  get: () => DuelStore,
  set: (updater: (prev: DuelStore) => Partial<DuelStore>) => void,
  buildMarker: (pos: MarkerPosition) => DuelStep
): void {
  const before = get()
  const insertIndex =
    before.currentStepIndex === null
      ? (before.state.steps || []).length
      : before.currentStepIndex + 1
  set((prev) => {
    const nextSteps = [...(prev.state.steps || [])]
    nextSteps.splice(insertIndex, 0, buildMarker(derivedPositionAt(prev, insertIndex)))
    return withDerivation({ ...prev, state: { ...prev.state, steps: nextSteps } })
  })
  if (before.currentStepIndex !== null) get().previewStepBoard(insertIndex)
}

export const createStepsSlice: StateCreator<DuelStore, [], [], StepsSlice> = (set, get) => ({
  activeRightTab: 'search',
  currentStepIndex: null,
  selectedStepId: null,

  currentTurn: 1,
  currentPhase: 'DP',
  currentChain: 0,
  activeTurnPlayer: 0,
  duelStarted: false,
  sceneEditing: false,

  setActiveRightTab: (tab) => set({ activeRightTab: tab }),
  setCurrentStepIndex: (index) => {
    if (get().sceneEditing && index !== SCENE_STEP_INDEX) return
    set({ currentStepIndex: index })
  },
  setSelectedStepId: (id) => set({ selectedStepId: id }),
  openScreenplayWithStep: (stepId) => {
    if (get().sceneEditing) return
    const selected =
      stepId !== undefined ? stepId : get().selectedStepId || get().state.steps?.[0]?.id || null
    set({
      selectedStepId: selected,
      documentPanelMode: 'editor',
      activeLeftTab: 'archives',
      isLeftOpen: true
    })
    if (!selected) return
    const index = (get().state.steps || []).findIndex((step) => step.id === selected)
    if (index < 0) return
    set({ currentStepIndex: index })
    get().previewStepBoard(index)
  },

  setCurrentTurn: (turn) => set({ currentTurn: turn }),
  setCurrentPhase: (phase) => set({ currentPhase: phase }),
  setCurrentChain: (chain) => set({ currentChain: chain }),
  resetChain: () => set((prev) => (prev.currentChain === 0 ? prev : { currentChain: 0 })),

  setTurnPlayer: (player) =>
    set((prev) => ({
      activeTurnPlayer: player,
      state: { ...prev.state, turnPlayer: player }
    })),

  setDuelStarted: (started) => set({ duelStarted: started }),

  addStep: (stepData) => {
    if (get().sceneEditing) return
    set((prev) => {
      const newStep: DuelStep = {
        ...stepData,
        id: createStepId()
      }
      const existing = prev.state.steps || []
      const nextState: DerivationSource = {
        ...prev,
        state: {
          ...prev.state,
          steps: [...existing, newStep]
        }
      }
      return withDerivation(nextState)
    })
    refreshPreviewIfActive(get)
  },

  insertStep: (step) => {
    if (useDuelEngineStore.getState().isInitialized) return
    if (get().sceneEditing) return
    set((prev) => {
      const existing = prev.state.steps || []
      if (existing.some((s) => s.id === step.id)) return prev
      const at = prev.currentStepIndex === null ? existing.length : prev.currentStepIndex + 1
      const nextSteps = [...existing]
      nextSteps.splice(at, 0, step)
      const nextState: DerivationSource = {
        ...prev,
        state: {
          ...prev.state,
          steps: nextSteps
        }
      }
      return withDerivation(nextState)
    })
  },

  updateStep: (stepId, patch) => {
    const engineActive = useDuelEngineStore.getState().isInitialized
    const nextPatch = engineActive ? pickNarrativeStepPatch(patch) : patch
    if (!nextPatch) return
    const demote = !engineActive && Object.keys(nextPatch).some((key) => key !== 'texts')
    set((prev) => {
      const existing = prev.state.steps || []
      const steps = existing.map((s) =>
        s.id === stepId
          ? {
              ...s,
              ...nextPatch,
              ...(demote && s.origin !== 'manual' ? { origin: 'manual' as const } : {})
            }
          : s
      )
      if (prev.sceneEditing) {
        return { state: { ...prev.state, steps } }
      }
      return withDerivation({ ...prev, state: { ...prev.state, steps } })
    })
    refreshPreviewIfActive(get)
  },

  deleteStep: (stepId) => {
    if (useDuelEngineStore.getState().isInitialized) return
    if (get().sceneEditing) return
    const prevSteps = get().state.steps || []
    const deletedIdx = prevSteps.findIndex((s) => s.id === stepId)
    if (deletedIdx === -1) return
    const prevPlayhead = get().currentStepIndex
    set((prev) => {
      const remaining = (prev.state.steps || []).filter((s) => s.id !== stepId)
      const source: DerivationSource = { ...prev, state: { ...prev.state, steps: remaining } }
      return deriveDeletionPatch(source, deletedIdx) ?? { state: source.state }
    })
    const remaining = get().state.steps || []
    if (remaining.length === 0) {
      get().previewStepBoard(null)
      set((prev) =>
        prev.currentTurn === 1 && prev.currentPhase === 'DP' && prev.currentChain === 0
          ? prev
          : { currentTurn: 1, currentPhase: 'DP', currentChain: 0 }
      )
      return
    }
    const target =
      prevPlayhead === null
        ? remaining.length - 1
        : deletedIdx < prevPlayhead
          ? Math.max(0, prevPlayhead - 1)
          : Math.min(prevPlayhead, remaining.length - 1)
    get().previewStepBoard(target)
  },

  moveStep: (stepId, direction) => {
    if (useDuelEngineStore.getState().isInitialized) return
    if (get().sceneEditing) return
    set((prev) => {
      const existing = [...(prev.state.steps || [])]
      const idx = existing.findIndex((s) => s.id === stepId)
      if (idx === -1) return prev
      if (direction === 'up' && idx > 0) {
        const temp = existing[idx - 1]
        existing[idx - 1] = existing[idx]
        existing[idx] = temp
      } else if (direction === 'down' && idx < existing.length - 1) {
        const temp = existing[idx + 1]
        existing[idx + 1] = existing[idx]
        existing[idx] = temp
      }
      return withDerivation({ ...prev, state: { ...prev.state, steps: existing } })
    })
    refreshPreviewIfActive(get)
  },

  insertPhaseChange: () => {
    if (useDuelEngineStore.getState().isInitialized) return
    if (get().sceneEditing) return
    insertMarkerAtPlayhead(get, set, (pos) => {
      const isTurnRoll = pos.phase === 'EP'
      const flip = (pos.turnPlayer === 0 ? 1 : 0) as 0 | 1
      return {
        id: createStepId(),
        turn: pos.turn,
        turnPlayer: isTurnRoll ? flip : pos.turnPlayer,
        phase: isTurnRoll ? 'DP' : (PHASE_ORDER[PHASE_ORDER.indexOf(pos.phase) + 1] ?? 'DP'),
        actionPlayer: isTurnRoll ? flip : pos.turnPlayer,
        actionType: isTurnRoll ? 'TURN_CHANGE' : 'PHASE_CHANGE',
        description: isTurnRoll ? '回合结束，进入下一回合' : '阶段推进'
      }
    })
  },

  insertTurnChange: () => {
    if (useDuelEngineStore.getState().isInitialized) return
    if (get().sceneEditing) return
    insertMarkerAtPlayhead(get, set, (pos) => ({
      id: createStepId(),
      turn: pos.turn,
      turnPlayer: pos.turnPlayer,
      phase: pos.phase,
      actionPlayer: (pos.turnPlayer === 0 ? 1 : 0) as 0 | 1,
      actionType: 'TURN_CHANGE',
      description: '回合结束，进入下一回合'
    }))
  },

  insertPhaseJump: (target: DuelPhase) => {
    if (useDuelEngineStore.getState().isInitialized) return
    if (get().sceneEditing) return
    insertMarkerAtPlayhead(get, set, (pos) => ({
      id: createStepId(),
      turn: pos.turn,
      turnPlayer: pos.turnPlayer,
      phase: target,
      actionPlayer: pos.turnPlayer,
      actionType: 'PHASE_CHANGE',
      description: '阶段推进'
    }))
  },

  previewStepBoard: (stepIndex) => {
    if (get().sceneEditing) return
    const engineRunning = useDuelEngineStore.getState().isInitialized
    const wasTracking = get().isUndoTracking()
    if (wasTracking) get().pauseUndoTracking()
    try {
      set((prev) => {
        const steps = prev.state.steps || []
        const targetStep = stepIndex === null ? undefined : steps[stepIndex]
        const snapshot =
          stepIndex === null ? resolveOpeningSnapshot(prev.state) : targetStep?.boardAfter

        const previewReturn =
          (engineRunning || Boolean(useDuelEngineStore.getState().suspendedDoc)) &&
          prev.previewReturn === null
            ? {
                state: structuredClone(prev.state),
                currentTurn: prev.currentTurn,
                currentPhase: prev.currentPhase,
                currentChain: prev.currentChain,
                activeTurnPlayer: prev.activeTurnPlayer
              }
            : prev.previewReturn

        if (stepIndex === null || !targetStep) {
          if (!snapshot || snapshot.length === 0) {
            return {
              currentStepIndex: stepIndex === null ? null : stepIndex,
              previewReturn: prev.previewReturn
            }
          }
          return {
            currentStepIndex: null,
            previewReturn,
            state: { ...prev.state, cards: restoreCardsFromSnapshot(prev.state.cards, snapshot) }
          }
        }

        const lpChange = targetStep.lpChange
        let nextPlayers = prev.state.players
        let nextDuelists = prev.state.duelists
        let lpFlash = prev.lpFlash
        if (lpChange) {
          const players: [PlayerState, PlayerState] = [...prev.state.players]
          const target = players[lpChange.player]
          if (target) {
            players[lpChange.player] = { ...target, lp: lpChange.newLp }
            if (target.lp !== lpChange.newLp) {
              lpFlash = createLpFlash(lpChange.player, lpChange.newLp - target.lp)
            }
          }
          nextPlayers = players
          nextDuelists = applyLpToDuelists(
            prev.state.duelists,
            lpChange.player,
            lpChange.newLp,
            prev.state.matchConfig
          )
        }

        return {
          currentStepIndex: stepIndex,
          previewReturn,
          currentTurn: targetStep.turn,
          currentPhase: targetStep.phase,
          currentChain: targetStep.chainIndex ?? 0,
          activeTurnPlayer: targetStep.turnPlayer,
          lpFlash,
          state: {
            ...prev.state,
            cards:
              snapshot && snapshot.length > 0
                ? restoreCardsFromSnapshot(prev.state.cards, snapshot)
                : prev.state.cards,
            players: nextPlayers,
            duelists: nextDuelists
          }
        }
      })
    } finally {
      if (wasTracking) get().resumeUndoTracking()
    }
  },

  enterSceneMode: () => {
    if (get().sceneEditing) return true
    if (useDuelEngineStore.getState().isInitialized) return false
    const current = get()
    const baseState = current.previewReturn?.state ?? current.state
    const scene = resolveOpeningScene(baseState)
    const hasActionStep = (baseState.steps ?? []).some(
      (step) => step.actionType !== 'PHASE_CHANGE' && step.actionType !== 'TURN_CHANGE'
    )
    if (!scene && hasActionStep) return false
    sceneReturnSnapshot = {
      state: structuredClone(baseState),
      currentTurn: current.previewReturn?.currentTurn ?? current.currentTurn,
      currentPhase: current.previewReturn?.currentPhase ?? current.currentPhase,
      currentChain: current.previewReturn?.currentChain ?? current.currentChain,
      activeTurnPlayer: current.previewReturn?.activeTurnPlayer ?? current.activeTurnPlayer,
      currentStepIndex: current.currentStepIndex
    }
    if (current.previewReturn) {
      current.exitPreview()
    }
    get().pauseUndoTracking()
    try {
      if (scene) {
        set((prev) => ({ ...scenePatch(prev, scene), sceneEditing: true }))
      } else {
        set({ sceneEditing: true, currentStepIndex: SCENE_STEP_INDEX })
      }
    } finally {
      get().resumeUndoTracking()
    }
    sceneEntrySignature = sceneSignature(sceneOf(get()))
    return true
  },

  exitSceneMode: () => {
    if (!get().sceneEditing) return false
    const current = get()
    const scene = sceneOf(current)
    const changed = sceneEntrySignature !== null && sceneSignature(scene) !== sceneEntrySignature
    sceneEntrySignature = null
    const snapshotToRestore = !changed ? sceneReturnSnapshot : null
    sceneReturnSnapshot = null
    get().pauseUndoTracking()
    try {
      if (snapshotToRestore) {
        set((prev) => ({
          ...prev,
          sceneEditing: false,
          state: snapshotToRestore.state,
          currentTurn: snapshotToRestore.currentTurn,
          currentPhase: snapshotToRestore.currentPhase,
          currentChain: snapshotToRestore.currentChain,
          activeTurnPlayer: snapshotToRestore.activeTurnPlayer,
          currentStepIndex: snapshotToRestore.currentStepIndex
        }))
      } else {
        set((prev) => {
          const nextState = {
            ...prev.state,
            initialBoardSnapshot: scene.cards,
            initialLp: scene.lp,
            ...(changed ? { steps: [] } : {})
          }
          const derived = withDerivation({ ...prev, state: nextState })
          const next = { ...prev, ...derived }
          return {
            ...derived,
            ...scenePatch(next, scene),
            sceneEditing: false,
            ...(changed
              ? {
                  selectedStepId: null,
                  duelStarted: isDuelStarted({ cards: nextState.cards, steps: [] })
                }
              : {})
          }
        })
      }
    } finally {
      get().resumeUndoTracking()
    }
    if (changed) useDuelEngineStore.getState().setSuspendedDoc(null)
    get().clearUndoHistory()
    return true
  },

  isSceneDirty: () =>
    get().sceneEditing &&
    sceneEntrySignature !== null &&
    sceneSignature(sceneOf(get())) !== sceneEntrySignature,

  previewTimelineStart: () => {
    if (get().sceneEditing) return
    if (useDuelEngineStore.getState().isInitialized) return
    set((prev) => {
      const steps = prev.state.steps || []
      const [lp0, lp1] = prev.state.initialLp ?? [
        prev.state.players[0]?.lp ?? 8000,
        prev.state.players[1]?.lp ?? 8000
      ]
      const players: [PlayerState, PlayerState] = [
        { ...prev.state.players[0], lp: lp0 },
        { ...prev.state.players[1], lp: lp1 }
      ]
      const duelists = applyLpToDuelists(
        applyLpToDuelists(prev.state.duelists, 0, lp0, prev.state.matchConfig),
        1,
        lp1,
        prev.state.matchConfig
      )
      const activeTurnPlayer = (steps[0]?.turnPlayer ?? prev.state.turnPlayer ?? 0) as 0 | 1
      const previewReturn =
        (useDuelEngineStore.getState().isInitialized ||
          Boolean(useDuelEngineStore.getState().suspendedDoc)) &&
        prev.previewReturn === null
          ? {
              state: structuredClone(prev.state),
              currentTurn: prev.currentTurn,
              currentPhase: prev.currentPhase,
              currentChain: prev.currentChain,
              activeTurnPlayer: prev.activeTurnPlayer
            }
          : prev.previewReturn
      return {
        currentStepIndex: SCENE_STEP_INDEX,
        currentTurn: 1,
        currentPhase: 'DP',
        currentChain: 0,
        activeTurnPlayer,
        previewReturn,
        lpFlash: null,
        state: { ...prev.state, cards: resolveOpeningCards(prev.state), players, duelists }
      }
    })
  }
})
