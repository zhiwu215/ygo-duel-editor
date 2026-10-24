import type { StateCreator } from 'zustand'
import { CdbCard } from '@shared/index'
import type { DuelStore } from './types'

export interface UiSlice {
  selectedCardId: string | null
  hoveredCard: CdbCard | null
  hoveredInstanceId: string | null

  activeStatPopoverCardId: string | null
  statPopoverPosition: { x: number; y: number } | null
  setActiveStatPopoverCardId: (id: string | null) => void
  setStatPopoverPosition: (pos: { x: number; y: number } | null) => void
  openStatPopover: (id: string, initialPos?: { x: number; y: number }) => void
  closeStatPopover: () => void

  tacticalView: boolean
  toggleTacticalView: () => void

  activeLeftTab: 'archives' | 'library' | 'card' | 'agent'
  isLeftOpen: boolean
  setActiveLeftTab: (tab: 'archives' | 'library' | 'card' | 'agent') => void
  toggleLeftTab: (tab: 'archives' | 'library' | 'card' | 'agent') => void

  documentPanelMode: 'library' | 'editor'
  setDocumentPanelMode: (mode: 'library' | 'editor') => void

  stepEditorId: string | null
  openStepEditor: (stepId: string) => void
  closeStepEditor: () => void

  setSelectedCardId: (id: string | null) => void
  setHoveredCard: (card: CdbCard | null) => void
  setHoveredInstanceId: (id: string | null) => void
}

export const createUiSlice: StateCreator<DuelStore, [], [], UiSlice> = (set) => ({
  selectedCardId: null,
  hoveredCard: null,
  hoveredInstanceId: null,

  activeStatPopoverCardId: null,
  statPopoverPosition: null,
  setActiveStatPopoverCardId: (id) => set({ activeStatPopoverCardId: id }),
  setStatPopoverPosition: (pos) => set({ statPopoverPosition: pos }),
  openStatPopover: (id, initialPos) =>
    set((prev) => ({
      activeStatPopoverCardId: id,
      statPopoverPosition: initialPos !== undefined ? initialPos : prev.statPopoverPosition
    })),
  closeStatPopover: () => set({ activeStatPopoverCardId: null }),

  tacticalView: false,
  toggleTacticalView: () => set((prev) => ({ tacticalView: !prev.tacticalView })),

  activeLeftTab: 'card',
  isLeftOpen: true,
  setActiveLeftTab: (tab) => set({ activeLeftTab: tab, isLeftOpen: true }),
  toggleLeftTab: (tab) =>
    set((prev) => ({
      activeLeftTab: tab,
      isLeftOpen: prev.activeLeftTab === tab ? !prev.isLeftOpen : true
    })),

  documentPanelMode: 'library',
  setDocumentPanelMode: (mode) => set({ documentPanelMode: mode }),

  stepEditorId: null,
  openStepEditor: (stepId) =>
    set({
      stepEditorId: stepId,
      selectedStepId: stepId,
      activeRightTab: 'steps',
      isLeftOpen: true,
      activeLeftTab: 'archives'
    }),
  closeStepEditor: () => set({ stepEditorId: null }),

  setSelectedCardId: (id) => set({ selectedCardId: id }),
  setHoveredCard: (card) => set({ hoveredCard: card }),
  setHoveredInstanceId: (id) => set({ hoveredInstanceId: id })
})
