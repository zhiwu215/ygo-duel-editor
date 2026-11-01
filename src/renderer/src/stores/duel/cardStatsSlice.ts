import type { StateCreator } from 'zustand'
import { allocateCustomCounterId } from '@shared/index'
import type { DuelStore } from './types'

export type CardStatsPatch = {
  customAtk?: number
  customDef?: number
  customLevel?: number
}

export interface CardStatsSlice {
  setCardCounter: (instanceId: string, counterType: number, count: number) => void
  removeCardCounter: (instanceId: string, counterType: number) => void
  syncCardCounters: (instanceId: string, counters?: Record<number, number>) => void

  registerCustomCounter: (name: string) => number
  setCardStats: (instanceId: string, patch: CardStatsPatch) => void
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

  syncCardCounters: (instanceId, counters) =>
    set((prev) => ({
      state: {
        ...prev.state,
        cards: prev.state.cards.map((c) =>
          c.instanceId === instanceId
            ? {
                ...c,
                counters: counters && Object.keys(counters).length > 0 ? { ...counters } : undefined
              }
            : c
        )
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

  setCardStats: (instanceId, patch) =>
    set((prev) => ({
      state: {
        ...prev.state,
        cards: prev.state.cards.map((c) => {
          if (c.instanceId === instanceId) {
            return { ...c, ...patch }
          }
          return c
        })
      }
    }))
})
