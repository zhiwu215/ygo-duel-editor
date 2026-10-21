import { create } from 'zustand'

interface DetachMaterialState {
  hostInstanceId: string | null
  selected: number[]
  openDetach: (instanceId: string) => void
  toggle: (index: number) => void
  closeDetach: () => void
}

export const useDetachMaterialStore = create<DetachMaterialState>((set) => ({
  hostInstanceId: null,
  selected: [],
  openDetach: (instanceId) => set({ hostInstanceId: instanceId, selected: [] }),
  toggle: (index) =>
    set((prev) => ({
      selected: prev.selected.includes(index)
        ? prev.selected.filter((i) => i !== index)
        : [...prev.selected, index]
    })),
  closeDetach: () => set({ hostInstanceId: null, selected: [] })
}))
