import { create } from 'zustand'

export interface HeldMaterialRef {
  hostInstanceId: string
  index: number
}

interface HeldCardState {
  instanceId: string | null
  materialRef: HeldMaterialRef | null
  point: { x: number; y: number } | null
  hold: (instanceId: string, point: { x: number; y: number }) => void
  holdMaterial: (hostInstanceId: string, index: number, point: { x: number; y: number }) => void
  release: () => void
}

export const useHeldCardStore = create<HeldCardState>((set) => ({
  instanceId: null,
  materialRef: null,
  point: null,
  hold: (instanceId, point) => set({ instanceId, materialRef: null, point }),
  holdMaterial: (hostInstanceId, index, point) =>
    set({ instanceId: null, materialRef: { hostInstanceId, index }, point }),
  release: () => set({ instanceId: null, materialRef: null, point: null })
}))
