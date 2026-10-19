import { DuelPuzzleState } from '../duel'
import type { EngineBoardState, EngineTimelineNode } from '../duelEngine'

export interface EngineExportReplayParams {
  state: DuelPuzzleState
  launch?: boolean
}

export interface EngineExportReplayResult {
  success: boolean
  errorCode?: 'no-game-directory' | 'ygopro-not-found' | 'replay-failed' | 'no-actions'
  error?: string
  luaPath?: string
  yrpPath?: string
  launched?: boolean
  warnings?: string[]
}

export interface EngineReplaySummary {
  fileName: string
  hostName: string
  clientName: string
  isSingleMode: boolean
  totalSteps: number
  warning?: string
}

export interface EngineReplayImportPayload {
  info: EngineReplaySummary
  boardState: EngineBoardState
  timeline: EngineTimelineNode[]
  currentStepId: string
}

export interface EngineImportReplayResult {
  success: boolean
  canceled?: boolean
  filePath?: string
  error?: string
  payload?: EngineReplayImportPayload
}
