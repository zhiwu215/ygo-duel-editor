import { create } from 'zustand'
import { EngineCardRef } from '@shared/index'

export interface EngineCardEditTarget {
  ref: EngineCardRef
  name: string
  code: number
}

interface EngineCardEditState {
  replaceTarget: EngineCardEditTarget | null
  openReplace: (target: EngineCardEditTarget) => void
  closeReplace: () => void
}

export const useEngineCardEditStore = create<EngineCardEditState>((set) => ({
  replaceTarget: null,
  openReplace: (target) => set({ replaceTarget: target }),
  closeReplace: () => set({ replaceTarget: null })
}))
