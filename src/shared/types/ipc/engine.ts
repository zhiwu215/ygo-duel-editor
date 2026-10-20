import { DuelPuzzleState } from '../duel'
import type { EngineBoardState, EngineTimelineNode } from '../duelEngine'

export interface EngineExportReplayParams {
  state: DuelPuzzleState
  launch?: boolean
  force?: boolean
}

export interface ContentCoverageDetail {
  missingDataIds: number[]
  missingScriptIds: number[]
}

export interface EngineExportReplayResult {
  success: boolean
  manualHint?: string
  errorCode?:
    'no-game-directory' | 'game-not-found' | 'replay-failed' | 'no-actions' | 'content-missing'
  error?: string
  luaPath?: string
  yrpPath?: string
  yrp3dPath?: string
  launched?: boolean
  warnings?: string[]
  coverage?: ContentCoverageDetail
}

export interface TestInGameResult {
  success: boolean
  exePath?: string
  scriptPath?: string
  errorCode?: 'no-game-directory' | 'game-not-found' | 'content-missing'
  error?: string
  coverage?: ContentCoverageDetail
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
