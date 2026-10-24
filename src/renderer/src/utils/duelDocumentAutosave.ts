import { useDuelStore } from '../stores/useDuelStore'
import { useDuelEngineStore } from '../stores/useDuelEngineStore'
import { buildDuelDocument } from './duelDocumentBuild'
import { clearDuelDocumentDraft } from './duelDocumentDraft'

export type DuelDocumentSaveStatus = 'idle' | 'pending' | 'saving' | 'saved' | 'error' | 'unsaved'

export interface DuelDocumentSaveState {
  status: DuelDocumentSaveStatus
  savedAt: number | null
}

const AUTO_SAVE_DELAY_MS = 800
const AUTO_SAVE_RETRY_MS = 5000

let state: DuelDocumentSaveState = { status: 'idle', savedAt: null }
const listeners = new Set<() => void>()
let timer: ReturnType<typeof setTimeout> | null = null
let suspended = false
let dirty = false
let revision = 0
let saveChain: Promise<boolean> = Promise.resolve(true)

function emit(patch: Partial<DuelDocumentSaveState>): void {
  state = { ...state, ...patch }
  for (const listener of listeners) listener()
}

function clearTimer(): void {
  if (timer === null) return
  clearTimeout(timer)
  timer = null
}

function canSaveNow(): boolean {
  if (suspended) return false
  const duel = useDuelStore.getState()
  if (!duel.currentProjectPath || duel.previewReturn) return false
  const engine = useDuelEngineStore.getState()
  return !engine.loading && !engine.replayInfo
}

function schedule(delay: number): void {
  clearTimer()
  if (!canSaveNow()) return
  timer = setTimeout(() => {
    timer = null
    void flushDuelDocumentAutosave()
  }, delay)
}

function markPending(): void {
  if (state.status !== 'pending') emit({ status: 'pending' })
}

export function subscribeDuelDocumentSaveStatus(listener: () => void): () => void {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

export function getDuelDocumentSaveStatus(): DuelDocumentSaveState {
  return state
}

export function hasUnsavedDuelDocument(): boolean {
  return dirty && Boolean(useDuelStore.getState().currentProjectPath)
}

export function getDuelDocumentRevision(): number {
  return revision
}

export function markDuelDocumentDirty(): void {
  if (suspended) return
  dirty = true
  revision += 1
  if (!useDuelStore.getState().currentProjectPath) {
    clearTimer()
    if (state.status !== 'unsaved') emit({ status: 'unsaved' })
    return
  }
  if (!canSaveNow()) {
    markPending()
    return
  }
  markPending()
  schedule(AUTO_SAVE_DELAY_MS)
}

export function flushDuelDocumentAutosave(): Promise<boolean> {
  clearTimer()
  saveChain = saveChain.then(saveIfDirty)
  return saveChain
}

export function notifyDuelDocumentSaved(savedRevision: number): void {
  clearTimer()
  if (revision !== savedRevision) {
    markPending()
    schedule(AUTO_SAVE_DELAY_MS)
    return
  }
  dirty = false
  emit({ status: 'saved', savedAt: Date.now() })
  clearDuelDocumentDraft()
}

export function suspendDuelDocumentAutosave(): void {
  suspended = true
  dirty = false
  clearTimer()
}

export function resumeDuelDocumentAutosave(): void {
  suspended = false
  dirty = false
  clearTimer()
  if (state.status !== 'idle') emit({ status: 'idle' })
}

async function saveIfDirty(): Promise<boolean> {
  if (!dirty) return true
  if (!canSaveNow()) return false
  const filePath = useDuelStore.getState().currentProjectPath
  if (!filePath) return false
  dirty = false
  emit({ status: 'saving' })
  try {
    const document = await buildDuelDocument()
    if (useDuelEngineStore.getState().isInitialized && !document.engine) {
      throw new Error('引擎会话快照不可用')
    }
    const result = await window.api.saveDuelDocument(filePath, document)
    if (!result.success) throw new Error(result.error ?? '自动保存失败')
    emit({ status: dirty ? 'pending' : 'saved', savedAt: Date.now() })
    if (dirty) {
      schedule(AUTO_SAVE_DELAY_MS)
    } else {
      clearDuelDocumentDraft()
    }
    return true
  } catch {
    dirty = true
    emit({ status: 'error' })
    schedule(AUTO_SAVE_RETRY_MS)
    return false
  }
}
