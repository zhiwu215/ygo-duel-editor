import type { OcgcoreDuel, OcgcoreWrapper } from 'koishipro-core.js'
import type {
  DuelLogEvent,
  EngineDuelInitParams,
  EngineRequest,
  EngineStepEvent
} from '@shared/index'
import {
  DEFAULT_TIMING_POLICY,
  type RecordedAnswer,
  type TimingPolicy
} from '@shared/engine/protocol'
import type { DuelOperation } from '@shared/engine/session-doc'
import type { ReplayPlayback } from './replay-session'
import type { ProvenanceRecord } from './provenance-tracker'
import { FieldReader } from './field-reader'
import { EngineTimelineManager } from './timeline-manager'
import { createDuelLogContext, type DuelLogContext } from './duel-log'

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
  accumulatedLogEvents: DuelLogEvent[]
  duelLog: DuelLogContext
  lastAdvanceRetried: boolean
  autoAnswers: RecordedAnswer[]
  seed: number[]
  initParams: EngineDuelInitParams | null
  ops: DuelOperation[]
  timingPolicy: TimingPolicy
  replaying: boolean
  replay: ReplayPlayback | null
  recordingMessages: Uint8Array[] | null
  recordingResponses: Uint8Array[] | null
  provenance: Map<string, ProvenanceRecord>
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
    accumulatedLogEvents: [],
    duelLog: createDuelLogContext(),
    lastAdvanceRetried: false,
    autoAnswers: [],
    seed: [],
    initParams: null,
    ops: [],
    timingPolicy: { ...DEFAULT_TIMING_POLICY },
    replaying: false,
    replay: null,
    recordingMessages: null,
    recordingResponses: null,
    provenance: new Map()
  }
}
