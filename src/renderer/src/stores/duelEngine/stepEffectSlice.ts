import type { StateCreator } from 'zustand'
import type { EngineTimelineNode } from '@shared/index'
import { stepEffectsOfNode, type StepEffect } from './stepEffectQueue'
import type { DuelEngineStore } from './types'

export interface StepEffectSlice {
  stepEffects: StepEffect[]
  playStepEffects: (node: EngineTimelineNode | null | undefined) => void
  finishStepEffect: (id: number) => void
  clearStepEffects: () => void
}

export const createStepEffectSlice: StateCreator<DuelEngineStore, [], [], StepEffectSlice> = (
  set,
  get
) => ({
  stepEffects: [],

  playStepEffects: (node) => set({ stepEffects: stepEffectsOfNode(node) }),

  finishStepEffect: (id) => {
    const [head, ...rest] = get().stepEffects
    if (!head || head.id !== id) return
    set({ stepEffects: rest })
  },

  clearStepEffects: () => set({ stepEffects: [] })
})
