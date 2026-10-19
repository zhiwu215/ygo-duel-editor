import type { StateCreator } from 'zustand'
import { DuelPuzzleState, createInitialDuelState } from '@shared/index'
import type { DuelStore } from './types'

export interface StateBaseSlice {
  state: DuelPuzzleState
}

export const createStateBaseSlice: StateCreator<DuelStore, [], [], StateBaseSlice> = () => ({
  state: createInitialDuelState(5)
})
