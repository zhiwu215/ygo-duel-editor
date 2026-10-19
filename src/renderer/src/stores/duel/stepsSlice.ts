import type { StateCreator } from 'zustand'
import {
  CardLocation,
  CardPosition,
  DuelPhase,
  DuelStep,
  DuelPuzzleState,
  FieldCard,
  LightweightCardSnapshot,
  PlayerState,
  createStepId,
  replayManualSteps
} from '@shared/index'
import { useDuelEngineStore } from '../useDuelEngineStore'
import type { DuelStore } from './types'

export interface StepsSlice {
  activeRightTab: 'search' | 'steps'
  currentStepIndex: number | null
  selectedStepId: string | null

  currentTurn: number
  currentPhase: DuelPhase
  currentChain: number
  activeTurnPlayer: 0 | 1

  setActiveRightTab: (tab: 'search' | 'steps') => void
  setCurrentStepIndex: (index: number | null) => void
  setSelectedStepId: (id: string | null) => void
  openScreenplayWithStep: (stepId?: string | null) => void

  setCurrentTurn: (turn: number) => void
  setCurrentPhase: (phase: DuelPhase) => void
  setCurrentChain: (chain: number) => void
  resetChain: () => void
  setActiveTurnPlayer: (player: 0 | 1) => void
  setTurnPlayer: (player: 0 | 1) => void
  insertPhaseJump: (target: DuelPhase) => void

  addStep: (step: Omit<DuelStep, 'id'>) => void
  insertStep: (step: DuelStep) => void
  updateStep: (stepId: string, patch: Partial<DuelStep>) => void
  deleteStep: (stepId: string) => void
  moveStep: (stepId: string, direction: 'up' | 'down') => void

  insertPhaseChange: () => void
  insertTurnChange: () => void

  previewStepBoard: (stepIndex: number | null) => void
  resetToOpeningBoard: () => void
}

function restoreCardsFromSnapshot(
  currentCards: FieldCard[],
  snapshot: LightweightCardSnapshot[]
): FieldCard[] {
  const cardMap = new Map(currentCards.map((c) => [c.instanceId, c]))
  return snapshot.map((s) => {
    const existing = cardMap.get(s.instanceId)
    return {
      instanceId: s.instanceId,
      code: s.code,
      card: existing?.card,
      controller: s.controller,
      owner: s.owner ?? s.controller,
      location: s.location,
      sequence: s.sequence,
      position: s.position,
      overlayMaterials: [...(s.overlayMaterials || [])],
      duelistId: s.duelistId,
      customAtk: s.customAtk,
      customDef: s.customDef
    }
  })
}

function insertDeckTop(
  cards: FieldCard[],
  extra: FieldCard,
  defaultDuelistId: string
): FieldCard[] {
  const duelistId = extra.duelistId || defaultDuelistId
  const shifted = cards.map((c) =>
    c.controller === extra.controller &&
    c.location === CardLocation.DECK &&
    (c.duelistId || defaultDuelistId) === duelistId
      ? { ...c, sequence: c.sequence + 1 }
      : c
  )
  return [
    ...shifted,
    {
      ...extra,
      location: CardLocation.DECK,
      sequence: 0,
      position: CardPosition.FACEDOWN,
      overlayMaterials: [],
      duelistId
    }
  ]
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

function derivePatch(next: DerivationSource): DerivationPatch | null {
  const steps = next.state.steps || []
  if (steps.length === 0) return null
  const initial = next.state.initialBoardSnapshot
  if (!initial || initial.length === 0) return null

  const startLp: [number, number] = [
    next.state.initialLp?.[0] ?? next.state.players[0]?.lp ?? 8000,
    next.state.initialLp?.[1] ?? next.state.players[1]?.lp ?? 8000
  ]
  const derived = replayManualSteps(initial, steps, startLp, next.state.turnPlayer)

  const players: [PlayerState, PlayerState] = [
    { ...next.state.players[0], lp: derived.lp[0] },
    { ...next.state.players[1], lp: derived.lp[1] }
  ]
  const tail = derived.steps[derived.steps.length - 1]

  return {
    state: { ...next.state, steps: derived.steps, players },
    currentTurn: tail.turn,
    currentPhase: tail.phase,
    activeTurnPlayer: tail.turnPlayer
  }
}

function withDerivation(nextState: DerivationSource): Partial<DuelStore> {
  const patch = derivePatch(nextState)
  if (!patch) {
    return { state: nextState.state }
  }
  return patch
}

function refreshPreviewIfActive(get: () => DuelStore): void {
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

export const createStepsSlice: StateCreator<DuelStore, [], [], StepsSlice> = (set, get) => ({
  activeRightTab: 'search',
  currentStepIndex: null,
  isScreenplayOpen: false,
  selectedStepId: null,

  currentTurn: 1,
  currentPhase: 'M1',
  currentChain: 0,
  activeTurnPlayer: 0,

  setActiveRightTab: (tab) => set({ activeRightTab: tab }),
  setCurrentStepIndex: (index) => set({ currentStepIndex: index }),
  setSelectedStepId: (id) => set({ selectedStepId: id }),
  openScreenplayWithStep: (stepId) => {
    set((prev) => ({
      selectedStepId:
        stepId !== undefined ? stepId : prev.selectedStepId || prev.state.steps?.[0]?.id || null
    }))
    void window.api.openScreenplayWindow()
  },

  setCurrentTurn: (turn) => set({ currentTurn: turn }),
  setCurrentPhase: (phase) => set({ currentPhase: phase }),
  setCurrentChain: (chain) => set({ currentChain: chain }),
  resetChain: () => set((prev) => (prev.currentChain === 0 ? prev : { currentChain: 0 })),
  setActiveTurnPlayer: (player) =>
    set((prev) => ({
      activeTurnPlayer: player,
      state: {
        ...prev.state,
        turnPlayer: player
      }
    })),

  setTurnPlayer: (player) =>
    set((prev) => ({
      activeTurnPlayer: player,
      state: { ...prev.state, turnPlayer: player }
    })),

  addStep: (stepData) => {
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
    set((prev) => {
      const existing = prev.state.steps || []
      if (existing.some((s) => s.id === step.id)) return prev
      const nextState: DerivationSource = {
        ...prev,
        state: {
          ...prev.state,
          steps: [...existing, step]
        }
      }
      return withDerivation(nextState)
    })
    refreshPreviewIfActive(get)
  },

  updateStep: (stepId, patch) => {
    set((prev) => {
      const existing = prev.state.steps || []
      const nextState: DerivationSource = {
        ...prev,
        state: {
          ...prev.state,
          steps: existing.map((s) => (s.id === stepId ? { ...s, ...patch } : s))
        }
      }
      return withDerivation(nextState)
    })
    refreshPreviewIfActive(get)
  },

  deleteStep: (stepId) => {
    set((prev) => {
      const existing = prev.state.steps || []
      const nextState: DerivationSource = {
        ...prev,
        state: {
          ...prev.state,
          steps: existing.filter((s) => s.id !== stepId)
        }
      }
      return withDerivation(nextState)
    })
    refreshPreviewIfActive(get)
  },

  moveStep: (stepId, direction) => {
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
    set((prev) => {
      const steps = prev.state.steps || []
      const insertIndex = prev.currentStepIndex === null ? steps.length : prev.currentStepIndex + 1
      const pos = derivedPositionAt(prev, insertIndex)
      const isTurnRoll = pos.phase === 'EP'
      const marker: DuelStep = {
        id: createStepId(),
        turn: pos.turn,
        turnPlayer: isTurnRoll ? ((pos.turnPlayer === 0 ? 1 : 0) as 0 | 1) : pos.turnPlayer,
        phase: isTurnRoll ? 'DP' : (PHASE_ORDER[PHASE_ORDER.indexOf(pos.phase) + 1] ?? 'DP'),
        actionPlayer: isTurnRoll ? ((pos.turnPlayer === 0 ? 1 : 0) as 0 | 1) : pos.turnPlayer,
        actionType: isTurnRoll ? 'TURN_CHANGE' : 'PHASE_CHANGE',
        description: isTurnRoll ? '回合结束，进入下一回合' : '阶段推进'
      }
      const nextSteps = [...steps]
      nextSteps.splice(insertIndex, 0, marker)
      return withDerivation({ ...prev, state: { ...prev.state, steps: nextSteps } })
    })
    refreshPreviewIfActive(get)
  },

  insertTurnChange: () => {
    if (useDuelEngineStore.getState().isInitialized) return
    set((prev) => {
      const steps = prev.state.steps || []
      const insertIndex = prev.currentStepIndex === null ? steps.length : prev.currentStepIndex + 1
      const pos = derivedPositionAt(prev, insertIndex)
      const marker: DuelStep = {
        id: createStepId(),
        turn: pos.turn,
        turnPlayer: pos.turnPlayer,
        phase: pos.phase,
        actionPlayer: (pos.turnPlayer === 0 ? 1 : 0) as 0 | 1,
        actionType: 'TURN_CHANGE',
        description: '回合结束，进入下一回合'
      }
      const nextSteps = [...steps]
      nextSteps.splice(insertIndex, 0, marker)
      return withDerivation({ ...prev, state: { ...prev.state, steps: nextSteps } })
    })
    refreshPreviewIfActive(get)
  },

  insertPhaseJump: (target: DuelPhase) => {
    if (useDuelEngineStore.getState().isInitialized) return
    set((prev) => {
      const steps = prev.state.steps || []
      const insertIndex = prev.currentStepIndex === null ? steps.length : prev.currentStepIndex + 1
      const pos = derivedPositionAt(prev, insertIndex)
      const marker: DuelStep = {
        id: createStepId(),
        turn: pos.turn,
        turnPlayer: pos.turnPlayer,
        phase: target,
        actionPlayer: pos.turnPlayer,
        actionType: 'PHASE_CHANGE',
        description: '阶段推进'
      }
      const nextSteps = [...steps]
      nextSteps.splice(insertIndex, 0, marker)
      return withDerivation({ ...prev, state: { ...prev.state, steps: nextSteps } })
    })
    refreshPreviewIfActive(get)
  },

  previewStepBoard: (stepIndex) => {
    const engineRunning = useDuelEngineStore.getState().isInitialized
    if (engineRunning) get().pauseUndoTracking()
    try {
      set((prev) => {
        const steps = prev.state.steps || []
        const targetStep = stepIndex === null ? undefined : steps[stepIndex]
        const snapshot =
          stepIndex === null ? prev.state.initialBoardSnapshot : targetStep?.boardAfter
        if (!snapshot || snapshot.length === 0) {
          return {
            currentStepIndex: stepIndex === null ? null : stepIndex,
            previewReturn: prev.previewReturn
          }
        }

        const restoredCards: FieldCard[] = restoreCardsFromSnapshot(prev.state.cards, snapshot)

        const previewReturn =
          engineRunning && prev.previewReturn === null
            ? {
                state: structuredClone(prev.state),
                currentTurn: prev.currentTurn,
                currentPhase: prev.currentPhase,
                currentChain: prev.currentChain,
                activeTurnPlayer: prev.activeTurnPlayer
              }
            : prev.previewReturn

        if (!targetStep) {
          return {
            currentStepIndex: null,
            previewReturn,
            state: { ...prev.state, cards: restoredCards }
          }
        }

        const lpChange = targetStep.lpChange
        let nextPlayers = prev.state.players
        if (lpChange) {
          const players: [PlayerState, PlayerState] = [...prev.state.players]
          const target = players[lpChange.player]
          if (target) {
            players[lpChange.player] = { ...target, lp: lpChange.newLp }
          }
          nextPlayers = players
        }

        return {
          currentStepIndex: stepIndex,
          previewReturn,
          currentTurn: targetStep.turn,
          currentPhase: targetStep.phase,
          currentChain: targetStep.chainIndex ?? 0,
          activeTurnPlayer: targetStep.turnPlayer,
          state: { ...prev.state, cards: restoredCards, players: nextPlayers }
        }
      })
    } finally {
      if (engineRunning) get().resumeUndoTracking()
    }
  },

  resetToOpeningBoard: () =>
    set((prev) => {
      const snapshot = prev.state.initialBoardSnapshot ?? []
      const restoredCards = restoreCardsFromSnapshot(prev.state.cards, snapshot)
      const restoredIds = new Set(restoredCards.map((c) => c.instanceId))
      const extras = prev.state.cards.filter((c) => !restoredIds.has(c.instanceId))

      const teamDuelistId = (controller: 0 | 1): string => {
        const teamDuelists = (prev.state.duelists || []).filter((d) => d.team === controller)
        return teamDuelists[0]?.id || `duelist_${controller}_0`
      }
      let finalCards = restoredCards
      for (const extra of extras) {
        finalCards = insertDeckTop(finalCards, extra, teamDuelistId(extra.controller))
      }

      const firstPlayer = ((prev.state.steps || [])[0]?.turnPlayer ?? 0) as 0 | 1
      return {
        currentStepIndex: null,
        currentTurn: 1,
        currentPhase: 'DP',
        currentChain: 0,
        activeTurnPlayer: firstPlayer,
        state: { ...prev.state, steps: [], cards: finalCards, turnPlayer: firstPlayer }
      }
    })
})
