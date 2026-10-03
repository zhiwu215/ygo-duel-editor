import { create } from 'zustand'
import { FieldCard } from '@shared/index'

interface ContextMenuState {
  menu: {
    card: FieldCard
    x: number
    y: number
  } | null
  openMenu: (card: FieldCard, x: number, y: number) => void
  closeMenu: () => void
}

export const useContextMenuStore = create<ContextMenuState>((set) => ({
  menu: null,
  openMenu: (card, x, y) => set({ menu: { card, x, y } }),
  closeMenu: () => set({ menu: null })
}))
