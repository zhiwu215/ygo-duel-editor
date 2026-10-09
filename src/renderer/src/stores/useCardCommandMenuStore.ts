import { create } from 'zustand'
import { FieldCard } from '@shared/index'
import { CardActionOptions } from '../utils/ruleCheck'

interface CardCommandMenuState {
  card: FieldCard | null
  actions: CardActionOptions | null
  anchorRect: DOMRect | null
  openMenu: (card: FieldCard, actions: CardActionOptions, anchorRect: DOMRect) => void
  closeMenu: () => void
}

export const useCardCommandMenuStore = create<CardCommandMenuState>((set) => ({
  card: null,
  actions: null,
  anchorRect: null,
  openMenu: (card, actions, anchorRect) => set({ card, actions, anchorRect }),
  closeMenu: () => set({ card: null, actions: null, anchorRect: null })
}))
