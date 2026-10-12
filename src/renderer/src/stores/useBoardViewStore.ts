import { create } from 'zustand'

interface BoardViewState {
  is3D: boolean
  perspective: number
  planeRotateX: number
  toggle3D: () => void
  set3D: (val: boolean) => void
  setPlaneRotateX: (angle: number) => void
}

export const useBoardViewStore = create<BoardViewState>((set) => ({
  is3D: false,
  perspective: 1400,
  planeRotateX: 38,
  toggle3D: () => set((s) => ({ is3D: !s.is3D })),
  set3D: (val: boolean) => set({ is3D: val }),
  setPlaneRotateX: (angle: number) => set({ planeRotateX: angle })
}))
