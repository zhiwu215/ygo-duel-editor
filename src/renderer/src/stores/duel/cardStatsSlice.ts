import type { StateCreator } from 'zustand'
import { allocateCustomCounterId } from '@shared/index'
import type { DuelStore } from './types'

export interface CardStatsSlice {
  setCardCounter: (instanceId: string, counterType: number, count: number) => void
  removeCardCounter: (instanceId: string, counterType: number) => void

  registerCustomCounter: (name: string) => number
  setCardCustomStats: (instanceId: string, customAtk?: number, customDef?: number) => void
}

export const createCardStatsSlice: StateCreator<DuelStore, [], [], CardStatsSlice> = (
  set,
  get
) => ({
  setCardCounter: (instanceId, counterType, count) =>
    set((prev) => ({
      state: {
        ...prev.state,
        cards: prev.state.cards.map((c) => {
          if (c.instanceId === instanceId) {
            const newCounters = { ...(c.counters || {}) }
            if (count <= 0) {
              delete newCounters[counterType]
            } else {
              newCounters[counterType] = count
            }
            return { ...c, counters: newCounters }
          }
          return c
        })
      }
    })),

  removeCardCounter: (instanceId, counterType) =>
    set((prev) => ({
      state: {
        ...prev.state,
        cards: prev.state.cards.map((c) => {
          if (c.instanceId === instanceId && c.counters) {
            const newCounters = { ...c.counters }
            delete newCounters[counterType]
            return { ...c, counters: newCounters }
          }
          return c
        })
      }
    })),

  registerCustomCounter: (name) => {
    const trimmed = name.trim()
    const existing = get().state.customCounters || {}
    const found = Object.entries(existing).find(([, n]) => n === trimmed)
    if (found) return Number(found[0])

    const id = allocateCustomCounterId(existing)
    set((prev) => ({
      state: {
        ...prev.state,
        customCounters: { ...(prev.state.customCounters || {}), [id]: trimmed }
      }
    }))
    return id
  },

  setCardCustomStats: (instanceId, customAtk, customDef) =>
    set((prev) => ({
      state: {
        ...prev.state,
        cards: prev.state.cards.map((c) => {
          if (c.instanceId === instanceId) {
            return { ...c, customAtk, customDef }
          }
          return c
        })
      }
    }))
})
