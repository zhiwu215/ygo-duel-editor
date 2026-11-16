import { create } from 'zustand'
import { CdbCard, resolveCardPlacement } from '@shared/index'

export interface EngineInjectDropTarget {
  card: CdbCard
  controller: 0 | 1
  location: number
  sequence: number
}

interface EngineInjectDropState {
  pending: EngineInjectDropTarget | null
  open: (target: EngineInjectDropTarget) => void
  cancel: () => void
}

export const useEngineInjectDropStore = create<EngineInjectDropState>((set) => ({
  pending: null,
  open: (target) => set({ pending: resolveCardPlacement(target.card.type, target) }),
  cancel: () => set({ pending: null })
}))
