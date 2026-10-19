import type { CardStatsSlice } from './cardStatsSlice'
import type { DuelistsSlice } from './duelistsSlice'
import type { ExecutionsSlice } from './executionsSlice'
import type { LpSlice } from './lpSlice'
import type { OverlaySlice } from './overlaySlice'
import type { PlacementSlice } from './placementSlice'
import type { PreviewSlice } from './previewSlice'
import type { SessionSlice } from './sessionSlice'
import type { SetupSlice } from './setupSlice'
import type { StateBaseSlice } from './stateBaseSlice'
import type { StepsSlice } from './stepsSlice'
import type { UiSlice } from './uiSlice'
import type { UndoSlice } from './undoSlice'

export type DuelStore = StateBaseSlice &
  PlacementSlice &
  ExecutionsSlice &
  OverlaySlice &
  CardStatsSlice &
  SetupSlice &
  DuelistsSlice &
  LpSlice &
  PreviewSlice &
  SessionSlice &
  StepsSlice &
  UiSlice &
  UndoSlice
