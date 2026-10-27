import type {
  EngineBoardState,
  EngineDuelInitParams,
  EngineTimelineNode
} from '../types/duelEngine'
import type { EngineRequest, InjectCommand, RecordedAnswer, TimingPolicy } from './protocol'
import { base64ToBytes, bytesToBase64 } from './base64'

export const ENGINE_SESSION_DOC_VERSION = 1

interface SerializedAnswerOp {
  type: 'answer'
  nodeId: string
  responses: string[]
  answers?: RecordedAnswer[]
}

interface SerializedAutoOp {
  type: 'auto'
  responses: string[]
  answers?: RecordedAnswer[]
}

interface SerializedInjectOp {
  type: 'inject'
  command: InjectCommand
  removed?: boolean
}

export type SerializedOp = SerializedAnswerOp | SerializedAutoOp | SerializedInjectOp

export interface EngineSessionDoc {
  version: 1
  seed: number[]
  initParams: EngineDuelInitParams
  ops: SerializedOp[]
  timeline: EngineTimelineNode[]
  currentStepId: string
  timingPolicy: TimingPolicy
  suspended?: boolean
  boardFingerprint?: string
}

export interface EngineSessionImportPayload {
  initParams: EngineDuelInitParams
  boardState: EngineBoardState
  pendingRequest: EngineRequest | null
  timeline: EngineTimelineNode[]
  currentStepId: string
}

export type DuelOperation =
  | { type: 'answer'; nodeId: string; responses: Uint8Array[]; answers?: RecordedAnswer[] }
  | { type: 'auto'; responses: Uint8Array[]; answers?: RecordedAnswer[] }
  | { type: 'inject'; command: InjectCommand; removed?: boolean }

export function encodeSessionOp(op: DuelOperation): SerializedOp {
  if (op.type === 'inject') {
    return op.removed
      ? { type: 'inject', command: structuredClone(op.command), removed: true }
      : { type: 'inject', command: structuredClone(op.command) }
  }
  const answers = op.answers ? structuredClone(op.answers) : undefined
  if (op.type === 'answer') {
    return {
      type: 'answer',
      nodeId: op.nodeId,
      responses: op.responses.map(bytesToBase64),
      ...(answers ? { answers } : {})
    }
  }
  return {
    type: 'auto',
    responses: op.responses.map(bytesToBase64),
    ...(answers ? { answers } : {})
  }
}

export function decodeSessionOp(op: SerializedOp): DuelOperation {
  if (op.type === 'inject') {
    const command = structuredClone(op.command)
    return op.removed ? { type: 'inject', command, removed: true } : { type: 'inject', command }
  }
  const answers = op.answers ? structuredClone(op.answers) : undefined
  if (op.type === 'answer') {
    return {
      type: 'answer',
      nodeId: op.nodeId,
      responses: op.responses.map(base64ToBytes),
      ...(answers ? { answers } : {})
    }
  }
  return {
    type: 'auto',
    responses: op.responses.map(base64ToBytes),
    ...(answers ? { answers } : {})
  }
}
