import type { StateCreator } from 'zustand'
import {
  CardLocation,
  DuelPuzzleState,
  DuelSourceRef,
  DuelType,
  MasterRule,
  createDefaultDuelists,
  createInitialDuelState,
  createStandardTagDuelists,
  flipViewTopSeat,
  isStandardTag,
  normalizeDuelState,
  normalizeMatchConfig
} from '@shared/index'
import { isDuelStarted } from '../../utils/duelStart'
import { dropBlankEventSteps } from '../../utils/stepSanitize'
import type { DuelStore } from './types'

export interface SessionSlice {
  currentProjectPath: string | null
  setCurrentProjectPath: (filePath: string | null) => void

  loadProjectAndStart: (state: DuelPuzzleState) => void
  loadState: (newState: DuelPuzzleState) => void
  resetDuel: () => void
  toggleViewSide: () => void

  setMasterRule: (rule: MasterRule) => void
  setDuelType: (type: DuelType) => void
  setSeries: (series: string) => void
  setTitle: (title: string) => void
  setHint: (hint: string) => void
  setSourceRef: (sourceRef?: DuelSourceRef) => void
}

export const createSessionSlice: StateCreator<DuelStore, [], [], SessionSlice> = (set, get) => ({
  currentProjectPath: null,
  setCurrentProjectPath: (filePath) => set({ currentProjectPath: filePath }),

  loadProjectAndStart: (newState) => {
    const normalized = normalizeDuelState(newState)
    const state = { ...normalized, steps: dropBlankEventSteps(normalized.steps ?? []) }
    set({
      state,
      currentTurn: 1,
      currentPhase: 'DP',
      currentChain: 0,
      activeTurnPlayer: state.turnPlayer ?? 0,
      duelStarted: isDuelStarted(state),
      previewReturn: null,
      currentStepIndex: null,
      sceneEditing: false,
      selectedStepId: null,
      selectedCardId: null,
      expandedDuelistId: null,
      activeDuelistIds: [null, null],
      hoveredCard: null
    })
    get().clearUndoHistory()
  },

  loadState: (newState) => {
    const normalized = normalizeDuelState(newState)
    const state = { ...normalized, steps: dropBlankEventSteps(normalized.steps ?? []) }
    set(() => ({
      state,
      currentProjectPath: null,
      sceneEditing: false,
      activeTurnPlayer: state.turnPlayer ?? 0,
      duelStarted: isDuelStarted(state),
      selectedCardId: null,
      expandedDuelistId: null,
      activeDuelistIds: [null, null]
    }))
  },

  resetDuel: () => {
    set((prev) => {
      const baseState = createInitialDuelState(prev.state.masterRule, prev.state.duelType || 'full')
      if (prev.state.matchConfig) {
        const matchConfig = normalizeMatchConfig(prev.state.matchConfig)
        baseState.matchConfig = matchConfig
        baseState.duelists = isStandardTag(matchConfig)
          ? createStandardTagDuelists()
          : createDefaultDuelists(matchConfig.team0Count, matchConfig.team1Count)
      }
      return {
        state: baseState,
        currentProjectPath: null,
        sceneEditing: false,
        duelStarted: false,
        currentTurn: 1,
        currentPhase: 'DP',
        currentChain: 0,
        activeTurnPlayer: baseState.turnPlayer ?? 0,
        currentStepIndex: null,
        selectedStepId: null,
        previewReturn: null,
        selectedCardId: null,
        activeStatPopoverCardId: null,
        statPopoverPosition: null,
        hoveredCard: null,
        expandedDuelistId: null,
        activeDuelistIds: [null, null]
      }
    })
    get().clearUndoHistory()
  },

  toggleViewSide: () => {
    get().pauseUndoTracking()
    try {
      set((prev) => ({
        state: { ...prev.state, viewTopSeat: flipViewTopSeat(prev.state) },
        selectedCardId: null,
        expandedDuelistId: null
      }))
    } finally {
      get().resumeUndoTracking()
    }
  },

  setMasterRule: (rule) =>
    set((prev) => {
      let newCards = [...prev.state.cards]
      if (rule <= 3) {
        newCards = newCards.filter(
          (c) => !(c.location === CardLocation.MZONE && (c.sequence === 5 || c.sequence === 6))
        )
      }
      return {
        state: { ...prev.state, masterRule: rule, cards: newCards }
      }
    }),

  setDuelType: (duelType) =>
    set((prev) => ({
      state: { ...prev.state, duelType }
    })),

  setSeries: (series) =>
    set((prev) => ({
      state: { ...prev.state, series }
    })),

  setTitle: (title) =>
    set((prev) => ({
      state: { ...prev.state, title }
    })),

  setHint: (hint) =>
    set((prev) => ({
      state: { ...prev.state, hint }
    })),

  setSourceRef: (sourceRef) =>
    set((prev) => ({
      state: { ...prev.state, sourceRef }
    }))
})
