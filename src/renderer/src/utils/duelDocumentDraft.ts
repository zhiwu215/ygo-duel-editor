import { DEFAULT_DUEL_TITLE, type DuelPuzzleState } from '@shared/index'
import { useDuelStore } from '../stores/useDuelStore'

const DRAFT_KEY = 'ygo-duel-editor:duel-draft-v2'

export interface DuelDocumentDraft {
  savedAt: number
  filePath: string | null
  state: DuelPuzzleState
  duelStarted: boolean
}

function hasDraftContent(state: DuelPuzzleState): boolean {
  const title = state.title?.trim() ?? ''
  if (title.length > 0 && title !== DEFAULT_DUEL_TITLE) return true
  return state.cards.length > 0 || (state.steps?.length ?? 0) > 0
}

export function writeDuelDocumentDraft(): void {
  if (typeof localStorage === 'undefined') return
  const duel = useDuelStore.getState()
  const state = duel.state
  if (!hasDraftContent(state)) {
    clearDuelDocumentDraft()
    return
  }
  const draft: DuelDocumentDraft = {
    savedAt: Date.now(),
    filePath: duel.currentProjectPath,
    state,
    duelStarted: duel.duelStarted
  }
  try {
    localStorage.setItem(DRAFT_KEY, JSON.stringify(draft))
  } catch {
    return
  }
}

export function readDuelDocumentDraft(): DuelDocumentDraft | null {
  if (typeof localStorage === 'undefined') return null
  try {
    const raw = localStorage.getItem(DRAFT_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as Partial<DuelDocumentDraft> | null
    if (!parsed || typeof parsed.savedAt !== 'number' || !parsed.state) return null
    return parsed as DuelDocumentDraft
  } catch {
    return null
  }
}

export function clearDuelDocumentDraft(): void {
  if (typeof localStorage === 'undefined') return
  try {
    localStorage.removeItem(DRAFT_KEY)
  } catch {
    return
  }
}
