import type { StateCreator } from 'zustand'
import {
  CardLocation,
  DuelPuzzleState,
  DuelSourceRef,
  DuelType,
  MasterRule,
  createDefaultDuelists,
  createInitialDuelState,
  normalizeDuelState,
  swapDuelSides
} from '@shared/index'
import { isDuelStarted } from '../../utils/duelStart'
import type { DuelStore } from './types'

export interface SessionSlice {
  currentProjectPath: string | null
  setCurrentProjectPath: (filePath: string | null) => void

  loadProjectAndStart: (state: DuelPuzzleState) => void
  loadState: (newState: DuelPuzzleState) => void
  resetDuel: () => void
  swapSides: () => void

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
    set({
      state: normalized,
      currentTurn: 1,
      currentPhase: 'DP',
      currentChain: 0,
      activeTurnPlayer: normalized.turnPlayer ?? 0,
      duelStarted: isDuelStarted(normalized),
      selectedCardId: null,
      expandedDuelistId: null,
      hoveredCard: null
    })
    get().clearUndoHistory()
  },

  loadState: (newState) =>
    set(() => ({
      state: normalizeDuelState(newState),
      currentProjectPath: null,
      duelStarted: isDuelStarted(newState),
      selectedCardId: null,
      expandedDuelistId: null
    })),

  resetDuel: () =>
    set((prev) => {
      const baseState = createInitialDuelState(prev.state.masterRule, prev.state.duelType || 'full')
      if (prev.state.matchConfig) {
        baseState.matchConfig = prev.state.matchConfig
        baseState.duelists = createDefaultDuelists(
          prev.state.matchConfig.team0Count,
          prev.state.matchConfig.team1Count
        )
      }
      return {
        state: baseState,
        currentProjectPath: null,
        duelStarted: false,
        selectedCardId: null,
        activeStatPopoverCardId: null,
        statPopoverPosition: null,
        hoveredCard: null,
        expandedDuelistId: null
      }
    }),

  swapSides: () =>
    set((prev) => ({
      state: swapDuelSides(prev.state),
      selectedCardId: null,
      expandedDuelistId: null
    })),

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
