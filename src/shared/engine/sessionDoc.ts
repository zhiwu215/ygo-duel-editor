import type {
  EngineBoardState,
  EngineDuelInitParams,
  EngineTimelineNode
} from '../types/duelEngine'
import type { EngineRequest, InjectCommand, TimingPolicy } from './protocol'
import { base64ToBytes, bytesToBase64 } from './base64'

export const ENGINE_SESSION_DOC_VERSION = 1

interface SerializedAnswerOp {
  type: 'answer'
  nodeId: string
  responses: string[]
}

interface SerializedAutoOp {
  type: 'auto'
  responses: string[]
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
}

export interface EngineSessionImportPayload {
  boardState: EngineBoardState
  pendingRequest: EngineRequest | null
  timeline: EngineTimelineNode[]
  currentStepId: string
}

export interface EngineSessionFileResult {
  success: boolean
  canceled?: boolean
  filePath?: string
  error?: string
}

export interface EngineSessionLoadResult extends EngineSessionFileResult {
  doc?: EngineSessionDoc
}

export interface EngineSessionImportResult extends EngineSessionFileResult {
  boardState?: EngineBoardState
  pendingRequest?: EngineRequest | null
  timeline?: EngineTimelineNode[]
  currentStepId?: string
  timingPolicy?: TimingPolicy
}

export type DuelOperation =
  | { type: 'answer'; nodeId: string; responses: Uint8Array[] }
  | { type: 'auto'; responses: Uint8Array[] }
  | { type: 'inject'; command: InjectCommand; removed?: boolean }

export function encodeSessionOp(op: DuelOperation): SerializedOp {
  if (op.type === 'inject') {
    return op.removed
      ? { type: 'inject', command: structuredClone(op.command), removed: true }
      : { type: 'inject', command: structuredClone(op.command) }
  }
  if (op.type === 'answer') {
    return { type: 'answer', nodeId: op.nodeId, responses: op.responses.map(bytesToBase64) }
  }
  return { type: 'auto', responses: op.responses.map(bytesToBase64) }
}

export function decodeSessionOp(op: SerializedOp): DuelOperation {
  if (op.type === 'inject') {
    const command = structuredClone(op.command)
    return op.removed ? { type: 'inject', command, removed: true } : { type: 'inject', command }
  }
  if (op.type === 'answer') {
    return { type: 'answer', nodeId: op.nodeId, responses: op.responses.map(base64ToBytes) }
  }
  return { type: 'auto', responses: op.responses.map(base64ToBytes) }
}
