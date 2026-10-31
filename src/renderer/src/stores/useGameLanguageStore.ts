import { create } from 'zustand'
import { GameLanguageOption } from '@shared/index'

export type GameLanguageTarget = { kind: 'game' } | { kind: 'extra'; root: string }

interface GameLanguageState {
  open: boolean
  options: GameLanguageOption[]
  target: GameLanguageTarget
  show: (options: GameLanguageOption[], target?: GameLanguageTarget) => void
  hide: () => void
}

export const useGameLanguageStore = create<GameLanguageState>((set) => ({
  open: false,
  options: [],
  target: { kind: 'game' },
  show: (options, target = { kind: 'game' }) => set({ open: true, options, target }),
  hide: () => set({ open: false, options: [], target: { kind: 'game' } })
}))

export function openGameLanguageDialog(
  options: GameLanguageOption[],
  target?: GameLanguageTarget
): void {
  useGameLanguageStore.getState().show(options, target)
}
