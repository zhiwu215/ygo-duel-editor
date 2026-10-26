import type { StateCreator, StoreApi } from 'zustand'
import type { TemporalState } from 'zundo'
import { DuelPhase, DuelPuzzleState } from '@shared/index'
import type { DuelStore } from './types'

interface UndoSnapshot {
  state: DuelPuzzleState
  duelStarted: boolean
  currentTurn: number
  currentPhase: DuelPhase
  currentChain: number
  activeTurnPlayer: 0 | 1
  currentStepIndex: number | null
}

export interface UndoSlice {
  pauseUndoTracking: () => void
  resumeUndoTracking: () => void
  isUndoTracking: () => boolean
  withSingleUndoStep: (apply: () => void) => void
  clearUndoHistory: () => void
}

type TemporalApi = StoreApi<TemporalState<UndoSnapshot>>
type HandleSet = (pastState: UndoSnapshot, replace: undefined, currentState: UndoSnapshot) => void

function temporalOf(store: unknown): TemporalApi {
  return (store as { temporal: TemporalApi }).temporal
}

export const createUndoSlice: StateCreator<DuelStore, [], [], UndoSlice> = (_set, get, store) => ({
  pauseUndoTracking: (): void => temporalOf(store).getState().pause(),

  resumeUndoTracking: (): void => temporalOf(store).getState().resume(),

  isUndoTracking: (): boolean => temporalOf(store).getState().isTracking,

  clearUndoHistory: (): void => temporalOf(store).getState().clear(),

  withSingleUndoStep: (apply: () => void): void => {
    if (!temporalOf(store).getState().isTracking) {
      apply()
      return
    }
    const previous = get()
    const snapshot: UndoSnapshot = {
      state: structuredClone(previous.state),
      duelStarted: previous.duelStarted,
      currentTurn: previous.currentTurn,
      currentPhase: previous.currentPhase,
      currentChain: previous.currentChain,
      activeTurnPlayer: previous.activeTurnPlayer,
      currentStepIndex: previous.currentStepIndex
    }
    temporalOf(store).getState().pause()
    try {
      apply()
    } finally {
      const temporal = temporalOf(store).getState()
      temporal.resume()
      const current = get()
      const changed =
        current.state !== previous.state ||
        current.duelStarted !== previous.duelStarted ||
        current.currentTurn !== previous.currentTurn ||
        current.currentPhase !== previous.currentPhase ||
        current.currentChain !== previous.currentChain ||
        current.activeTurnPlayer !== previous.activeTurnPlayer
      if (changed) {
        ;(temporal as unknown as { _handleSet: HandleSet })._handleSet(snapshot, undefined, {
          state: current.state,
          duelStarted: current.duelStarted,
          currentTurn: current.currentTurn,
          currentPhase: current.currentPhase,
          currentChain: current.currentChain,
          activeTurnPlayer: current.activeTurnPlayer,
          currentStepIndex: current.currentStepIndex
        })
      }
    }
  }
})
