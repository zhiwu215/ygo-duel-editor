import { create } from 'zustand'
import { createCardEditSlice } from './cardEditSlice'
import { createPolicySlice } from './policySlice'
import { createReplaySlice } from './replaySlice'
import { createRequestSlice } from './requestSlice'
import { createSessionSlice } from './sessionSlice'
import { createStepEffectSlice } from './stepEffectSlice'
import type { DuelEngineStore } from './types'

export const useDuelEngineStore = create<DuelEngineStore>()((...a) => ({
  ...createPolicySlice(...a),
  ...createSessionSlice(...a),
  ...createRequestSlice(...a),
  ...createReplaySlice(...a),
  ...createStepEffectSlice(...a),
  ...createCardEditSlice(...a)
}))

export { orderEditorCardsByEngineHand } from './handOrder'
export type { DuelEngineStore } from './types'
