import type { StateCreator } from 'zustand'
import {
  CardLocation,
  CardPosition,
  DuelPhase,
  DuelStep,
  FieldCard,
  LightweightCardSnapshot,
  PlayerState
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
  nextPhase: () => void
  nextTurn: () => void
  setActiveTurnPlayer: (player: 0 | 1) => void
  setTurnPlayer: (player: 0 | 1) => void

  addStep: (step: Omit<DuelStep, 'id'>) => void
  insertStep: (step: DuelStep) => void
  updateStep: (stepId: string, patch: Partial<DuelStep>) => void
  deleteStep: (stepId: string) => void
  moveStep: (stepId: string, direction: 'up' | 'down') => void
  clearSteps: () => void

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

export function createStepId(): string {
  return `step_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`
}

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
  nextPhase: () =>
    set((prev) => {
      const phases: DuelPhase[] = ['DP', 'SP', 'M1', 'BP', 'M2', 'EP']
      const curIdx = phases.indexOf(prev.currentPhase)

      if (curIdx < phases.length - 1) {
        return {
          currentPhase: phases[curIdx + 1],
          currentChain: 0
        }
      }

      const nextTurn = prev.currentTurn + 1
      const nextActive = (prev.activeTurnPlayer === 0 ? 1 : 0) as 0 | 1
      return {
        currentTurn: nextTurn,
        currentPhase: 'DP',
        currentChain: 0,
        activeTurnPlayer: nextActive,
        state: {
          ...prev.state,
          turnPlayer: nextActive
        }
      }
    }),
  nextTurn: () =>
    set((prev) => {
      const nextTurn = prev.currentTurn + 1
      const nextActive = (prev.activeTurnPlayer === 0 ? 1 : 0) as 0 | 1
      return {
        currentTurn: nextTurn,
        currentPhase: 'DP',
        currentChain: 0,
        activeTurnPlayer: nextActive,
        state: {
          ...prev.state,
          turnPlayer: nextActive
        }
      }
    }),
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

  addStep: (stepData) =>
    set((prev) => {
      const newStep: DuelStep = {
        ...stepData,
        id: createStepId()
      }
      const existing = prev.state.steps || []
      return {
        state: {
          ...prev.state,
          steps: [...existing, newStep]
        }
      }
    }),

  insertStep: (step) =>
    set((prev) => {
      const existing = prev.state.steps || []
      if (existing.some((s) => s.id === step.id)) return prev
      return {
        state: {
          ...prev.state,
          steps: [...existing, step]
        }
      }
    }),

  updateStep: (stepId, patch) =>
    set((prev) => {
      const existing = prev.state.steps || []
      return {
        state: {
          ...prev.state,
          steps: existing.map((s) => (s.id === stepId ? { ...s, ...patch } : s))
        }
      }
    }),

  deleteStep: (stepId) =>
    set((prev) => {
      const existing = prev.state.steps || []
      return {
        state: {
          ...prev.state,
          steps: existing.filter((s) => s.id !== stepId)
        }
      }
    }),

  moveStep: (stepId, direction) =>
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
      return {
        state: {
          ...prev.state,
          steps: existing
        }
      }
    }),

  clearSteps: () =>
    set((prev) => ({
      state: {
        ...prev.state,
        steps: []
      },
      currentStepIndex: null
    })),

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
