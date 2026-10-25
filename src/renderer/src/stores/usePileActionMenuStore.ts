import { create } from 'zustand'

export interface PileActionMenuTarget {
  controller: 0 | 1
  location: number
  anchorRect: { left: number; top: number; width: number; height: number }
}

interface PileActionMenuState {
  target: PileActionMenuTarget | null
  openMenu: (
    controller: 0 | 1,
    location: number,
    anchorRect: PileActionMenuTarget['anchorRect']
  ) => void
  closeMenu: () => void
}

export const usePileActionMenuStore = create<PileActionMenuState>((set) => ({
  target: null,
  openMenu: (controller, location, anchorRect) =>
    set({ target: { controller, location, anchorRect } }),
  closeMenu: () => set({ target: null })
}))
