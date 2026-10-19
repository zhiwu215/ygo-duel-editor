import { create } from 'zustand'

interface DeckSwitcherState {
  controller: 0 | 1 | null
  openDeckSwitcher: (controller: 0 | 1) => void
  closeDeckSwitcher: () => void
}

export const useDeckSwitcherStore = create<DeckSwitcherState>((set) => ({
  controller: null,
  openDeckSwitcher: (controller) => set({ controller }),
  closeDeckSwitcher: () => set({ controller: null })
}))
