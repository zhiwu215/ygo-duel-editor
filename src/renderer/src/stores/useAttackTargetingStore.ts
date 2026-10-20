import { create } from 'zustand'
import { FieldCard } from '@shared/index'

interface AttackTargetingState {
  attacker: FieldCard | null
  start: (card: FieldCard) => void
  cancel: () => void
}

export const useAttackTargetingStore = create<AttackTargetingState>((set) => ({
  attacker: null,
  start: (card) => set({ attacker: card }),
  cancel: () => set({ attacker: null })
}))
