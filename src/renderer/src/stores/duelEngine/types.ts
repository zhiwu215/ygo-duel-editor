import type { CardEditSlice } from './cardEditSlice'
import type { PolicySlice } from './policySlice'
import type { ReplaySlice } from './replaySlice'
import type { RequestSlice } from './requestSlice'
import type { SessionSlice } from './sessionSlice'
import type { StepEffectSlice } from './stepEffectSlice'

export type DuelEngineStore = PolicySlice &
  SessionSlice &
  RequestSlice &
  ReplaySlice &
  StepEffectSlice &
  CardEditSlice
