import { DuelPuzzleState } from '../duel'

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
