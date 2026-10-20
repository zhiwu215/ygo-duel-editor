import { create } from 'zustand'
import { temporal } from 'zundo'
import { createCardStatsSlice } from './cardStatsSlice'
import { createDuelistsSlice } from './duelistsSlice'
import { createExecutionsSlice } from './executionsSlice'
import { createLpSlice } from './lpSlice'
import { createOverlaySlice } from './overlaySlice'
import { createPlacementSlice } from './placementSlice'
import { createPreviewSlice } from './previewSlice'
import { createSessionSlice } from './sessionSlice'
import { createSetupSlice } from './setupSlice'
import { createStateBaseSlice } from './stateBaseSlice'
import { createStepsSlice } from './stepsSlice'
import { createUiSlice } from './uiSlice'
import { createUndoSlice } from './undoSlice'
import type { DuelStore } from './types'

export const useDuelStore = create<DuelStore>()(
  temporal(
    (...a) => ({
      ...createStateBaseSlice(...a),
      ...createPlacementSlice(...a),
      ...createExecutionsSlice(...a),
      ...createOverlaySlice(...a),
      ...createCardStatsSlice(...a),
      ...createSetupSlice(...a),
      ...createDuelistsSlice(...a),
      ...createLpSlice(...a),
      ...createPreviewSlice(...a),
      ...createSessionSlice(...a),
      ...createStepsSlice(...a),
      ...createUiSlice(...a),
      ...createUndoSlice(...a)
    }),
    {
      partialize: (state) => ({ state: state.state, duelStarted: state.duelStarted }),
      equality: (past, current) =>
        past.state === current.state && past.duelStarted === current.duelStarted,
      limit: 50
    }
  )
)

export type { DuelStore } from './types'
export type { MoveCardParams } from './placementSlice'
export type { LpFlash } from './lpSlice'
export type { PreviewReturn } from './previewSlice'
