import type { StateCreator } from 'zustand'
import type { DeckEditorStore } from './types'
import { shuffle } from '../../utils/deckSort'

export interface TestHandSlice {
  testHandCards: number[] | null

  drawTestHand: () => number[]
  closeTestHand: () => void
}

export const createTestHandSlice: StateCreator<DeckEditorStore, [], [], TestHandSlice> = (
  set,
  get
) => ({
  testHandCards: null,

  drawTestHand: (): number[] => {
    const { deck } = get()
    if (deck.main.length === 0) return []

    const pool = shuffle(deck.main)

    const hand = pool.slice(0, Math.min(5, pool.length))
    set({ testHandCards: hand })
    return hand
  },

  closeTestHand: (): void => {
    set({ testHandCards: null })
  }
})
