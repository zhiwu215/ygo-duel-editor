import { create } from 'zustand'
import { FieldCard } from '@shared/index'

interface CardCommandMenuState {
  card: FieldCard | null
  anchorRect: DOMRect | null
  openMenu: (card: FieldCard, anchorRect: DOMRect) => void
  closeMenu: () => void
}

export const useCardCommandMenuStore = create<CardCommandMenuState>((set) => ({
  card: null,
  anchorRect: null,
  openMenu: (card, anchorRect) => set({ card, anchorRect }),
  closeMenu: () => set({ card: null, anchorRect: null })
}))
