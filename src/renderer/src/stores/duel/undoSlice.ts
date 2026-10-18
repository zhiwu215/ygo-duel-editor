import type { StateCreator, StoreApi } from 'zustand'
import type { TemporalState } from 'zundo'
import { DuelPuzzleState } from '@shared/index'
import type { DuelStore } from './types'

export interface UndoSlice {
  pauseUndoTracking: () => void
  resumeUndoTracking: () => void
  resumeAndPushUndo: (snapshot: DuelPuzzleState) => void
  clearUndoHistory: () => void
}

type TemporalApi = StoreApi<TemporalState<{ state: DuelPuzzleState }>>

function temporalOf(store: unknown): TemporalApi {
  return (store as { temporal: TemporalApi }).temporal
}

export const createUndoSlice: StateCreator<DuelStore, [], [], UndoSlice> = (_set, get, store) => ({
  pauseUndoTracking: (): void => temporalOf(store).getState().pause(),

  resumeUndoTracking: (): void => temporalOf(store).getState().resume(),

  clearUndoHistory: (): void => temporalOf(store).getState().clear(),

  resumeAndPushUndo: (snapshot: DuelPuzzleState): void => {
    const temporal = temporalOf(store).getState()
    temporal.resume()
    const handleSet = (
      temporal as unknown as {
        _handleSet: (
          pastState: { state: DuelPuzzleState },
          replace: undefined,
          currentState: { state: DuelPuzzleState }
        ) => void
      }
    )._handleSet
    handleSet({ state: snapshot }, undefined, { state: get().state })
  }
})
