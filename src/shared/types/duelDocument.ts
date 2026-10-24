import type { DuelPuzzleState } from './duel'
import type { EngineSessionDoc } from '../engine/sessionDoc'

export interface DuelDocument {
  state: DuelPuzzleState
  engine?: EngineSessionDoc
}

export interface DuelDocumentEntry {
  filePath: string
  fileName: string
  name: string
  title: string
  categoryPath: string
  updatedAt: number
  stepCount: number
  engineStepCount: number
  manualStepCount: number
}

export interface DuelDocumentFolder {
  name: string
  path: string
  folders: DuelDocumentFolder[]
  documents: DuelDocumentEntry[]
}

export interface DuelDocumentTree {
  rootPath: string
  folders: DuelDocumentFolder[]
  documents: DuelDocumentEntry[]
}

export interface DuelDocumentReadResult {
  success: boolean
  filePath?: string
  document?: DuelDocument
  error?: string
}

export interface DuelDocumentWriteResult {
  success: boolean
  filePath?: string
  error?: string
}

export interface DuelDocumentListResult {
  success: boolean
  tree?: DuelDocumentTree
  error?: string
}
