import { create } from 'zustand'
import { FieldCard } from '@shared/index'

export type ContextMenuTarget =
  | { kind: 'card'; card: FieldCard }
  | { kind: 'zone'; controller: 0 | 1; location: number }
  | { kind: 'hand'; controller: 0 | 1; duelistId: string }

export type ContextMenuState = ContextMenuTarget & { x: number; y: number }

interface ContextMenuStore {
  menu: ContextMenuState | null
  openMenu: (card: FieldCard, x: number, y: number) => void
  openZoneMenu: (controller: 0 | 1, location: number, x: number, y: number) => void
  openHandMenu: (controller: 0 | 1, duelistId: string, x: number, y: number) => void
  closeMenu: () => void
}

export const useContextMenuStore = create<ContextMenuStore>((set) => ({
  menu: null,
  openMenu: (card, x, y) => set({ menu: { kind: 'card', card, x, y } }),
  openZoneMenu: (controller, location, x, y) =>
    set({ menu: { kind: 'zone', controller, location, x, y } }),
  openHandMenu: (controller, duelistId, x, y) =>
    set({ menu: { kind: 'hand', controller, duelistId, x, y } }),
  closeMenu: () => set({ menu: null })
}))
