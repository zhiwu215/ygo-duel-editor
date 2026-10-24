import type { DuelDocument } from '@shared/index'
import { useDuelStore } from '../stores/useDuelStore'
import { useDuelEngineStore } from '../stores/useDuelEngineStore'

export async function buildDuelDocument(): Promise<DuelDocument> {
  const current = useDuelStore.getState()
  if (current.previewReturn) current.exitPreview()
  const state = useDuelStore.getState().state
  const engine = useDuelEngineStore.getState().isInitialized
    ? await useDuelEngineStore.getState().getSessionDoc()
    : null
  return engine ? { state, engine } : { state }
}
