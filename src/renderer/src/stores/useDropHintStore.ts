import { create } from 'zustand'

export interface DropHintZone {
  controller: 0 | 1
  location: number
  sequence: number
}

interface DropHintState {
  zone: DropHintZone | null
  show: (zone: DropHintZone) => void
  close: () => void
}

export const useDropHintStore = create<DropHintState>((set) => ({
  zone: null,
  show: (zone) => set({ zone }),
  close: () => set({ zone: null })
}))
