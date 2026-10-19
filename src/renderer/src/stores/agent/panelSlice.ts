import type { StateCreator } from 'zustand'
import { AgentStreamEvent } from '@shared/index'
import type { AgentStore } from './types'
import { applyAgentStreamEvent } from './chatEvents'

export interface PanelSlice {
  cleanupListener: (() => void) | null
  setOpen: (open: boolean) => void
}

export const createPanelSlice: StateCreator<AgentStore, [], [], PanelSlice> = (set, get) => ({
  cleanupListener: null,

  setOpen: (open) => {
    if (open && !get().cleanupListener && window.api?.onAgentEvent) {
      const cleanup = window.api.onAgentEvent((event: AgentStreamEvent) => {
        applyAgentStreamEvent(event, set, get)
      })
      set({ cleanupListener: cleanup })
    }
  }
})
