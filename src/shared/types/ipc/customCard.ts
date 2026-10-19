import { CustomCard } from '../customCard'

export interface CustomCardScriptInfo {
  code: number
  fileName: string
  path: string
  exists: boolean
  size?: number
  updatedAt?: number
}

export interface CustomCardScriptResult {
  success: boolean
  canceled?: boolean
  error?: string
  info?: CustomCardScriptInfo
}

export interface CustomCardSaveResult {
  success: boolean
  card?: CustomCard
  error?: string
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

export interface CustomCardSyncResult {
  success: boolean
  error?: string
  cdb: boolean
  scripts: number
  pics: number
}
