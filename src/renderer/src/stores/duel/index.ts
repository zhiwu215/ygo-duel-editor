import { create } from 'zustand'
import { temporal } from 'zundo'
import { createBoardSlice } from './boardSlice'
import { createDuelistsSlice } from './duelistsSlice'
import { createLpSlice } from './lpSlice'
import { createPreviewSlice } from './previewSlice'
import { createSessionSlice } from './sessionSlice'
import { createStepsSlice } from './stepsSlice'
import { createUiSlice } from './uiSlice'
import { createUndoSlice } from './undoSlice'
import type { DuelStore } from './types'

export const useDuelStore = create<DuelStore>()(
  temporal(
    (...a) => ({
      ...createBoardSlice(...a),
      ...createDuelistsSlice(...a),
      ...createLpSlice(...a),
      ...createPreviewSlice(...a),
      ...createSessionSlice(...a),
      ...createStepsSlice(...a),
      ...createUiSlice(...a),
      ...createUndoSlice(...a)
    }),
    {
      partialize: (state) => ({ state: state.state }),
      equality: (past, current) => past.state === current.state,
      limit: 50
    }
  )
)

export type { DuelStore } from './types'
export type {
  MoveCardParams,
  PendingPlacement,
  PendingPlacementMode,
  PendingPlacementSlot
} from './boardSlice'
export type { LpFlash } from './lpSlice'
export type { PreviewReturn } from './previewSlice'
