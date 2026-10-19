import type { CardEditSlice } from './cardEditSlice'
import type { PolicySlice } from './policySlice'
import type { RequestSlice } from './requestSlice'
import type { SessionSlice } from './sessionSlice'

export type DuelEngineStore = PolicySlice & SessionSlice & RequestSlice & CardEditSlice
