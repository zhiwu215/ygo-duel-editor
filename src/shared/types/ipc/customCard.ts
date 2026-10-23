import { CustomCard } from '../customCard'

export type { CustomCardSyncTarget } from '../customCard'

export interface CustomCardScriptInfo {
  code: number
  fileName: string
  path: string
  exists: boolean
  size?: number
  updatedAt?: number
  stringIds: number[]
}

export interface CustomCardScriptPickResult {
  success: boolean
  canceled?: boolean
  error?: string
  filePath?: string
  fileName?: string
  suggestedId?: number
  stringIds?: number[]
  size?: number
}

export interface CustomCardScriptResult {
  success: boolean
  canceled?: boolean
  error?: string
  warning?: string
  info?: CustomCardScriptInfo
}

export interface CustomCardSaveResult {
  success: boolean
  card?: CustomCard
  error?: string
  warning?: string
}

export interface CustomCardDeleteResult {
  success: boolean
  error?: string
}

export interface CustomCardPickImageResult {
  success: boolean
  canceled?: boolean
  filePath?: string
  previewDataUrl?: string
  error?: string
}

export interface CustomCardOpenDirResult {
  success: boolean
  error?: string
}

export interface CustomSetcodeNamesResult {
  success: boolean
  error?: string
  names?: Record<string, string>
}

export interface CustomCardSyncResult {
  success: boolean
  error?: string
  cdb: boolean
  scripts: number
  pics: number
  removed: number
}
