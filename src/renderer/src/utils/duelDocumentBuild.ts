import {
  computeBoardFingerprint,
  createLightweightSnapshot,
  type DuelDocument
} from '@shared/index'
import { useDuelStore } from '../stores/useDuelStore'
import { useDuelEngineStore } from '../stores/useDuelEngineStore'

export async function buildDuelDocument(): Promise<DuelDocument> {
  const current = useDuelStore.getState()
  if (current.previewReturn) current.exitPreview()
  const live = useDuelStore.getState()
  const state = live.sceneEditing
    ? {
        ...live.state,
        initialBoardSnapshot: createLightweightSnapshot(live.state.cards),
        initialLp: [live.state.players[0]?.lp ?? 8000, live.state.players[1]?.lp ?? 8000] as [
          number,
          number
        ]
      }
    : live.state
  const engineStore = useDuelEngineStore.getState()
  if (engineStore.isInitialized) {
    const engine = await engineStore.getSessionDoc()
    return engine
      ? {
          state,
          engine: {
            ...engine,
            boardFingerprint: computeBoardFingerprint(state, { enginePileOrder: true })
          }
        }
      : { state }
  }
  return engineStore.suspendedDoc ? { state, engine: engineStore.suspendedDoc } : { state }
}
