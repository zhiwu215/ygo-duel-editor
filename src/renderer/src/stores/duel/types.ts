import type { BoardSlice } from './boardSlice'
import type { DuelistsSlice } from './duelistsSlice'
import type { LpSlice } from './lpSlice'
import type { PreviewSlice } from './previewSlice'
import type { SessionSlice } from './sessionSlice'
import type { StepsSlice } from './stepsSlice'
import type { UiSlice } from './uiSlice'
import type { UndoSlice } from './undoSlice'

export type DuelStore = BoardSlice &
  DuelistsSlice &
  LpSlice &
  PreviewSlice &
  SessionSlice &
  StepsSlice &
  UiSlice &
  UndoSlice
