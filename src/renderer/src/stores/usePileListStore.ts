import { create } from 'zustand'

export interface PileListTarget {
  controller: 0 | 1
  location: number
}

interface PileListState {
  target: PileListTarget | null
  openSeq: number
  openPile: (controller: 0 | 1, location: number) => void
  closePile: () => void
}

export const usePileListStore = create<PileListState>((set) => ({
  target: null,
  openSeq: 0,
  openPile: (controller, location) =>
    set((prev) => ({ target: { controller, location }, openSeq: prev.openSeq + 1 })),
  closePile: () => set({ target: null })
}))
