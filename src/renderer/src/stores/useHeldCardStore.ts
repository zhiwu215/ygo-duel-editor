import { create } from 'zustand'

interface HeldCardState {
  instanceId: string | null
  point: { x: number; y: number } | null
  hold: (instanceId: string, point: { x: number; y: number }) => void
  release: () => void
}

export const useHeldCardStore = create<HeldCardState>((set) => ({
  instanceId: null,
  point: null,
  hold: (instanceId, point) => set({ instanceId, point }),
  release: () => set({ instanceId: null, point: null })
}))
