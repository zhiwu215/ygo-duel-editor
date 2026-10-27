import { DuelPuzzleState } from '../duel'
import type { MasterRule } from '../rules'
import type { EngineBoardState, EngineTimelineNode } from '../duelEngine'
import type { EngineSessionDoc, EngineSessionImportPayload } from '../../engine/sessionDoc'

export interface EngineSessionDocResult {
  success: boolean
  doc?: EngineSessionDoc
  error?: string
}

export interface EngineSessionRestoreResult {
  success: boolean
  payload?: EngineSessionImportPayload
  error?: string
}

export interface EngineSupportInfo {
  supported: boolean
  reason?: string
}

export interface EngineExportReplayParams {
  state: DuelPuzzleState
  name?: string
  overwrite?: boolean
  launch?: boolean
  force?: boolean
  startOpIndex?: number
}

export interface ContentCoverageDetail {
  missingDataIds: number[]
  missingScriptIds: number[]
}

export interface EngineExportReplayResult {
  success: boolean
  manualHint?: string
  errorCode?:
    | 'no-game-directory'
    | 'game-not-found'
    | 'replay-failed'
    | 'no-actions'
    | 'content-missing'
    | 'replay-exists'
    | 'replay-start'
  error?: string
  existingPath?: string
  name?: string
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
  filePath?: string
  hostName: string
  clientName: string
  tagHostName?: string
  tagClientName?: string
  isTag: boolean
  isSingleMode: boolean
  totalSteps: number
  masterRule: MasterRule
  warning?: string
}

export interface EngineOpenReplayResult {
  success: boolean
  replayPath?: string
  launched?: boolean
  manualHint?: string
  errorCode?: 'no-game-directory' | 'game-not-found' | 'replay-missing' | 'replay-failed'
  error?: string
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

export interface ReplayFileEntry {
  fileName: string
  baseName: string
  size: number
  modifiedAt: number
  hasLua: boolean
}

export interface ReplayFileListResult {
  success: boolean
  entries: ReplayFileEntry[]
  error?: string
}

export interface ReplayDeleteResult {
  success: boolean
  deletedReplays: number
  deletedScripts: number
  error?: string
}
