import type { StateCreator } from 'zustand'
import { DuelPhase, DuelPuzzleState } from '@shared/index'
import type { DuelStore } from './types'

export interface PreviewReturn {
  state: DuelPuzzleState
  currentTurn: number
  currentPhase: DuelPhase
  currentChain: number
  activeTurnPlayer: 0 | 1
}

export interface PreviewSlice {
  previewReturn: PreviewReturn | null
  exitPreview: () => void
  commitPreview: () => void
}

export const createPreviewSlice: StateCreator<DuelStore, [], [], PreviewSlice> = (set, get) => ({
  previewReturn: null,

  exitPreview: () => {
    const previewReturn = get().previewReturn
    if (!previewReturn) {
      set((prev) => (prev.currentStepIndex === null ? prev : { currentStepIndex: null }))
      return
    }
    get().pauseUndoTracking()
    try {
      set(() => ({
        previewReturn: null,
        currentStepIndex: null,
        state: previewReturn.state,
        currentTurn: previewReturn.currentTurn,
        currentPhase: previewReturn.currentPhase,
        currentChain: previewReturn.currentChain,
        activeTurnPlayer: previewReturn.activeTurnPlayer
      }))
    } finally {
      get().resumeUndoTracking()
    }
  },

  commitPreview: () =>
    set((prev) =>
      prev.previewReturn === null && prev.currentStepIndex === null
        ? prev
        : { previewReturn: null, currentStepIndex: null }
    )
})
