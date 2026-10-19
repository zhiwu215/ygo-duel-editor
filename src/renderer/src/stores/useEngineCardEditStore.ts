import { create } from 'zustand'
import { EngineCardRef, EngineProvenance } from '@shared/index'
import { useDuelEngineStore } from './useDuelEngineStore'

export interface EngineCardEditTarget {
  ref: EngineCardRef
  name: string
  code: number
}

interface EngineCardEditState {
  provenanceTarget: EngineCardEditTarget | null
  provenance: EngineProvenance | null
  provenanceLoading: boolean
  replaceTarget: EngineCardEditTarget | null
  openProvenance: (target: EngineCardEditTarget) => Promise<void>
  closeProvenance: () => void
  openReplace: (target: EngineCardEditTarget) => void
  closeReplace: () => void
}

export const useEngineCardEditStore = create<EngineCardEditState>((set) => ({
  provenanceTarget: null,
  provenance: null,
  provenanceLoading: false,
  replaceTarget: null,

  openProvenance: async (target) => {
    set({ provenanceTarget: target, provenance: null, provenanceLoading: true })
    const provenance = await useDuelEngineStore.getState().getProvenance(target.ref)
    set((state) =>
      state.provenanceTarget === target
        ? { provenance, provenanceLoading: false }
        : { provenanceLoading: false }
    )
  },

  closeProvenance: () => set({ provenanceTarget: null, provenance: null }),

  openReplace: (target) => set({ replaceTarget: target }),

  closeReplace: () => set({ replaceTarget: null })
}))
