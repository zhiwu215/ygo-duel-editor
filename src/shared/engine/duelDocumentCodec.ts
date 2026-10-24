import type { DuelDocument } from '../types/duelDocument'
import { normalizeDuelState } from '../types/duelFactory'
import type { EngineSessionDoc } from './sessionDoc'
import { parseEngineSessionDoc } from './sessionDocParser'

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

export function normalizeDuelDocument(input: unknown): DuelDocument {
  if (!isRecord(input) || !isRecord(input.state)) {
    throw new Error('对局文档格式错误：缺少 state。')
  }
  const state = normalizeDuelState(input.state as never)
  let engine: EngineSessionDoc | undefined
  if (input.engine !== undefined && input.engine !== null) {
    try {
      engine = parseEngineSessionDoc(input.engine as never)
    } catch {
      engine = undefined
    }
  }
  return { state, engine }
}

export function parseDuelDocumentJson(content: string): DuelDocument {
  let parsed: unknown
  try {
    parsed = JSON.parse(content)
  } catch {
    throw new Error('对局文档不是有效的 JSON。')
  }
  return normalizeDuelDocument(parsed)
}

export function serializeDuelDocument(document: DuelDocument): string {
  return JSON.stringify(document, null, 2)
}
