import { create } from 'zustand'
import { GameLanguageOption } from '@shared/index'

interface GameLanguageState {
  open: boolean
  options: GameLanguageOption[]
  show: (options: GameLanguageOption[]) => void
  hide: () => void
}

export const useGameLanguageStore = create<GameLanguageState>((set) => ({
  open: false,
  options: [],
  show: (options) => set({ open: true, options }),
  hide: () => set({ open: false, options: [] })
}))

export function openGameLanguageDialog(options: GameLanguageOption[]): void {
  useGameLanguageStore.getState().show(options)
}
