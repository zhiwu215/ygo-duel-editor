import type { StateCreator, StoreApi } from 'zustand'
import type { TemporalState } from 'zundo'
import { DuelPuzzleState } from '@shared/index'
import type { DuelStore } from './types'

interface UndoSnapshot {
  state: DuelPuzzleState
  duelStarted: boolean
}

export interface UndoSlice {
  pauseUndoTracking: () => void
  resumeUndoTracking: () => void
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

  clearUndoHistory: (): void => temporalOf(store).getState().clear(),

  withSingleUndoStep: (apply: () => void): void => {
    if (!temporalOf(store).getState().isTracking) {
      apply()
      return
    }
    const previousState = get().state
    const previousStarted = get().duelStarted
    const snapshot: UndoSnapshot = {
      state: structuredClone(previousState),
      duelStarted: previousStarted
    }
    temporalOf(store).getState().pause()
    try {
      apply()
    } finally {
      const temporal = temporalOf(store).getState()
      temporal.resume()
      if (get().state !== previousState || get().duelStarted !== previousStarted) {
        ;(temporal as unknown as { _handleSet: HandleSet })._handleSet(snapshot, undefined, {
          state: get().state,
          duelStarted: get().duelStarted
        })
      }
    }
  }
})
