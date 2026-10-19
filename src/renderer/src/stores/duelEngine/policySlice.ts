import type { StateCreator } from 'zustand'
import { DEFAULT_TIMING_POLICY, TimingPolicy, normalizeTimingPolicy } from '@shared/index'
import type { DuelEngineStore } from './types'

export interface PolicySlice {
  timingPolicy: TimingPolicy

  setTimingPolicy: (policy: TimingPolicy) => void
  loadTimingPolicy: () => Promise<TimingPolicy>
}

export const createPolicySlice: StateCreator<DuelEngineStore, [], [], PolicySlice> = (
  set,
  get
) => ({
  timingPolicy: { ...DEFAULT_TIMING_POLICY },

  setTimingPolicy: (policy) => {
    const normalized = normalizeTimingPolicy(policy)
    set({ timingPolicy: normalized })
    void window.api.duelEngineSetPolicy(normalized).catch((err) => {
      console.error('[useDuelEngineStore] setTimingPolicy failed:', err)
    })
    void window.api.saveConfig({ timingPolicy: normalized }).catch((err) => {
      console.error('[useDuelEngineStore] save timingPolicy failed:', err)
    })
  },

  loadTimingPolicy: async () => {
    try {
      const config = await window.api.getConfig()
      const policy = normalizeTimingPolicy(config.timingPolicy)
      set({ timingPolicy: policy })
      return policy
    } catch (err) {
      console.error('[useDuelEngineStore] loadTimingPolicy failed:', err)
      return get().timingPolicy
    }
  }
})
