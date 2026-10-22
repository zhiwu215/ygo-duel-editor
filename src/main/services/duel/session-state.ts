import type { OcgcoreDuel, OcgcoreWrapper } from 'koishipro-core.js'
import type { EngineDuelInitParams, EngineRequest, EngineStepEvent } from '@shared/index'
import { DEFAULT_TIMING_POLICY, type TimingPolicy } from '@shared/engine/protocol'
import type { DuelOperation } from '@shared/engine/session-doc'
import type { ProvenanceRecord } from './provenance-tracker'
import type { DrawEvent } from './engine-pump'
import type { ReplayPlayback } from './replay-session'
import { FieldReader } from './field-reader'
import { EngineTimelineManager } from './timeline-manager'

export interface PendingQuery {
  msg: unknown
  request: EngineRequest
}

export function headPendingQuery(state: SessionState): PendingQuery | null {
  return state.pendingQueries[0] ?? null
}

export interface SessionState {
  ocgcore: OcgcoreWrapper | null
  duel: OcgcoreDuel | null
  ownedWrapper: OcgcoreWrapper | null
  requestSnapshot: Uint8Array | null
  fieldReader: FieldReader
  timeline: EngineTimelineManager
  pendingQueries: PendingQuery[]
  requestSeq: number
  lastHintDesc: number | undefined
  lastParseError: string | null
  lastScriptError: string | null
  accumulatedLogs: string[]
  accumulatedEvents: EngineStepEvent[]
  lastAdvanceRetried: boolean
  seed: number[]
  initParams: EngineDuelInitParams | null
  ops: DuelOperation[]
  timingPolicy: TimingPolicy
  replaying: boolean
  replay: ReplayPlayback | null
  recordingMessages: Uint8Array[] | null
  provenance: Map<string, ProvenanceRecord>
  sequenceProvenance: Map<string, ProvenanceRecord>
  drawCounts: [number, number]
  deckDirty: [boolean, boolean]
  lastDrawEvents: DrawEvent[]
  lastDeckShuffles: (0 | 1)[]
}

export function createSessionState(): SessionState {
  return {
    ocgcore: null,
    duel: null,
    ownedWrapper: null,
    requestSnapshot: null,
    fieldReader: new FieldReader(),
    timeline: new EngineTimelineManager(),
    pendingQueries: [],
    requestSeq: 1,
    lastHintDesc: undefined,
    lastParseError: null,
    lastScriptError: null,
    accumulatedLogs: [],
    accumulatedEvents: [],
    lastAdvanceRetried: false,
    seed: [],
    initParams: null,
    ops: [],
    timingPolicy: { ...DEFAULT_TIMING_POLICY },
    replaying: false,
    replay: null,
    recordingMessages: null,
    provenance: new Map(),
    sequenceProvenance: new Map(),
    drawCounts: [0, 0],
    deckDirty: [false, false],
    lastDrawEvents: [],
    lastDeckShuffles: []
  }
}
