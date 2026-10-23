import type {
  EngineBoardState,
  EngineDuelInitParams,
  EngineStepEvent,
  EngineTimelineNode
} from '../types/duelEngine'
import {
  normalizeTimingPolicy,
  type EngineRequest,
  type InjectCommand,
  type TimingPolicy
} from './protocol'
import { BASE64_PATTERN } from './base64'
import { ENGINE_SESSION_DOC_VERSION, EngineSessionDoc, SerializedOp } from './sessionDoc'

const INJECT_CARD_TARGETS = new Set([
  'hand',
  'deck-top',
  'deck-bottom',
  'deck-shuffle',
  'grave-top',
  'grave-bottom',
  'removed',
  'extra',
  'mzone',
  'szone',
  'fzone'
])

function fail(message: string): never {
  throw new Error(`对局剧本格式错误：${message}`)
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function assertRecord(value: unknown, field: string): asserts value is Record<string, unknown> {
  if (!isRecord(value)) fail(`${field} 必须是对象。`)
}

function readString(value: unknown, field: string): string {
  if (typeof value !== 'string') fail(`${field} 必须是字符串。`)
  return value
}

function readNumber(value: unknown, field: string): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    fail(`${field} 必须是有限数字。`)
  }
  return value
}

function readInteger(value: unknown, field: string, min = Number.NEGATIVE_INFINITY): number {
  const number = readNumber(value, field)
  if (!Number.isInteger(number) || number < min) {
    fail(`${field} 必须是 >= ${min} 的整数。`)
  }
  return number
}

function readPlayer(value: unknown, field: string): 0 | 1 {
  if (value !== 0 && value !== 1) fail(`${field} 必须是 0 或 1。`)
  return value
}

function parseStringArray(value: unknown, field: string): string[] {
  if (!Array.isArray(value)) fail(`${field} 必须是数组。`)
  return value.map((item, index) => readString(item, `${field}[${index}]`))
}

function parseResponses(value: unknown, field: string): string[] {
  const responses = parseStringArray(value, field)
  responses.forEach((response, index) => {
    if (!BASE64_PATTERN.test(response) || response.length % 4 !== 0) {
      fail(`${field}[${index}] 不是有效的 base64。`)
    }
  })
  return responses
}

function parseInjectCommand(value: unknown, field: string): InjectCommand {
  assertRecord(value, field)
  if (value.op === 'set-lp') {
    return {
      op: 'set-lp',
      player: readPlayer(value.player, `${field}.player`),
      lp: readInteger(value.lp, `${field}.lp`, 0)
    }
  }
  if (value.op === 'add-card') {
    const to = readString(value.to, `${field}.to`)
    if (!INJECT_CARD_TARGETS.has(to)) fail(`${field}.to 不是支持的落点：${to}`)
    const command: Extract<InjectCommand, { op: 'add-card' }> = {
      op: 'add-card',
      player: readPlayer(value.player, `${field}.player`),
      code: readInteger(value.code, `${field}.code`, 1),
      to: to as Extract<InjectCommand, { op: 'add-card' }>['to']
    }
    if (value.sequence !== undefined) {
      command.sequence = readInteger(value.sequence, `${field}.sequence`, 0)
    }
    if (value.position !== undefined) {
      command.position = readInteger(value.position, `${field}.position`, 0)
    }
    return command
  }
  return fail(`${field}.op 不是支持的注入类型。`)
}

function parseOp(value: unknown, index: number): SerializedOp {
  const field = `ops[${index}]`
  assertRecord(value, field)
  if (value.type === 'inject') {
    const command = parseInjectCommand(value.command, `${field}.command`)
    if (value.removed !== undefined && typeof value.removed !== 'boolean') {
      fail(`${field}.removed 必须是布尔值。`)
    }
    return value.removed ? { type: 'inject', command, removed: true } : { type: 'inject', command }
  }
  if (value.type === 'answer') {
    return {
      type: 'answer',
      nodeId: readString(value.nodeId, `${field}.nodeId`),
      responses: parseResponses(value.responses, `${field}.responses`)
    }
  }
  if (value.type === 'auto') {
    return { type: 'auto', responses: parseResponses(value.responses, `${field}.responses`) }
  }
  return fail(`${field}.type 不是支持的操作类型。`)
}

function parseEngineCard(value: unknown, field: string): void {
  assertRecord(value, field)
  readString(value.instanceId, `${field}.instanceId`)
  readInteger(value.code, `${field}.code`, 0)
  readPlayer(value.controller, `${field}.controller`)
  readPlayer(value.owner, `${field}.owner`)
  readInteger(value.location, `${field}.location`, 0)
  readInteger(value.sequence, `${field}.sequence`, 0)
  readInteger(value.position, `${field}.position`, 0)
  if (!Array.isArray(value.overlayMaterials)) {
    fail(`${field}.overlayMaterials 必须是数组。`)
  }
  value.overlayMaterials.forEach((code, index) =>
    readInteger(code, `${field}.overlayMaterials[${index}]`, 0)
  )
}

function parsePlayerState(value: unknown, field: string): void {
  assertRecord(value, field)
  readPlayer(value.player, `${field}.player`)
  readNumber(value.lp, `${field}.lp`)
  readNumber(value.maxLp, `${field}.maxLp`)
  readNumber(value.deckCount, `${field}.deckCount`)
  readNumber(value.extraCount, `${field}.extraCount`)
  readNumber(value.graveCount, `${field}.graveCount`)
  readNumber(value.removedCount, `${field}.removedCount`)
  for (const key of ['hand', 'deck', 'extra', 'graveyard', 'banished'] as const) {
    const cards = value[key]
    if (cards === undefined) continue
    if (!Array.isArray(cards)) fail(`${field}.${key} 必须是数组。`)
    cards.forEach((card, index) => parseEngineCard(card, `${field}.${key}[${index}]`))
  }
  for (const key of ['mzone', 'szone', 'pzone'] as const) {
    const slots = value[key]
    if (slots === undefined) continue
    if (!Array.isArray(slots)) fail(`${field}.${key} 必须是数组。`)
    slots.forEach((card, index) => {
      if (card === null) return
      parseEngineCard(card, `${field}.${key}[${index}]`)
    })
  }
  if (value.fzone !== undefined && value.fzone !== null) {
    parseEngineCard(value.fzone, `${field}.fzone`)
  }
}

function parseBoardState(value: unknown, field: string): EngineBoardState {
  assertRecord(value, field)
  readNumber(value.turn, `${field}.turn`)
  readPlayer(value.turnPlayer, `${field}.turnPlayer`)
  readNumber(value.phase, `${field}.phase`)
  readString(value.phaseName, `${field}.phaseName`)
  if (!Array.isArray(value.players) || value.players.length !== 2) {
    fail(`${field}.players 必须包含两名玩家。`)
  }
  value.players.forEach((player, index) => parsePlayerState(player, `${field}.players[${index}]`))
  if (!Array.isArray(value.allCards)) fail(`${field}.allCards 必须是数组。`)
  value.allCards.forEach((card, index) => parseEngineCard(card, `${field}.allCards[${index}]`))
  return value as unknown as EngineBoardState
}

function parseRequest(value: unknown, field: string): EngineRequest | null {
  if (value === null) return null
  assertRecord(value, field)
  readString(value.id, `${field}.id`)
  readInteger(value.seq, `${field}.seq`, 0)
  readPlayer(value.player, `${field}.player`)
  readString(value.kind, `${field}.kind`)
  readInteger(value.identifier, `${field}.identifier`, 0)
  readString(value.title, `${field}.title`)
  if (value.subtitle !== undefined) readString(value.subtitle, `${field}.subtitle`)
  if (value.descHint !== undefined) readInteger(value.descHint, `${field}.descHint`, 0)
  assertRecord(value.data, `${field}.data`)
  return value as unknown as EngineRequest
}

function parseEvent(value: unknown, field: string): EngineStepEvent {
  assertRecord(value, field)
  switch (value.kind) {
    case 'shuffle-hand':
      return { kind: 'shuffle-hand', player: readPlayer(value.player, `${field}.player`) }
    case 'draw': {
      if (!Array.isArray(value.codes)) fail(`${field}.codes 必须是数组。`)
      return {
        kind: 'draw',
        player: readPlayer(value.player, `${field}.player`),
        codes: value.codes.map((code, index) => readInteger(code, `${field}.codes[${index}]`, 0))
      }
    }
    case 'chain':
      return {
        kind: 'chain',
        controller: readPlayer(value.controller, `${field}.controller`),
        location: readInteger(value.location, `${field}.location`, 0),
        sequence: readInteger(value.sequence, `${field}.sequence`, 0),
        chainCount: readInteger(value.chainCount, `${field}.chainCount`, 0)
      }
    case 'chain-solving':
      return {
        kind: 'chain-solving',
        chainCount: readInteger(value.chainCount, `${field}.chainCount`, 0)
      }
    case 'chain-end':
      return { kind: 'chain-end' }
    case 'chain-negated':
      return {
        kind: 'chain-negated',
        chainCount: readInteger(value.chainCount, `${field}.chainCount`, 0)
      }
    case 'chain-disabled':
      return {
        kind: 'chain-disabled',
        chainCount: readInteger(value.chainCount, `${field}.chainCount`, 0)
      }
    default:
      return fail(`${field}.kind 不受支持。`)
  }
}

function parseEvents(value: unknown, field: string): EngineStepEvent[] {
  if (!Array.isArray(value)) fail(`${field} 必须是数组。`)
  return value.map((event, index) => parseEvent(event, `${field}[${index}]`))
}

function parseTimelineNode(value: unknown, index: number): EngineTimelineNode {
  const field = `timeline[${index}]`
  assertRecord(value, field)
  const parentId = value.parentId === null ? null : readString(value.parentId, `${field}.parentId`)
  return {
    id: readString(value.id, `${field}.id`),
    parentId,
    stepNumber: readInteger(value.stepNumber, `${field}.stepNumber`, 1),
    title: readString(value.title, `${field}.title`),
    player: readPlayer(value.player, `${field}.player`),
    logs: parseStringArray(value.logs, `${field}.logs`),
    events: parseEvents(value.events, `${field}.events`),
    boardState: parseBoardState(value.boardState, `${field}.boardState`),
    pendingRequest: parseRequest(value.pendingRequest, `${field}.pendingRequest`),
    opIndex: readInteger(value.opIndex, `${field}.opIndex`, -1),
    createdAt: readNumber(value.createdAt, `${field}.createdAt`)
  }
}

function parseInitParams(value: unknown): EngineDuelInitParams {
  assertRecord(value, 'initParams')
  if (value.puzzleState !== undefined) assertRecord(value.puzzleState, 'initParams.puzzleState')
  for (const key of ['p0Lp', 'p1Lp', 'p0StartHand', 'p1StartHand'] as const) {
    if (value[key] !== undefined) readNumber(value[key], `initParams.${key}`)
  }
  for (const key of ['p0Deck', 'p1Deck', 'p0Extra', 'p1Extra', 'seed'] as const) {
    const codes = value[key]
    if (codes === undefined) continue
    if (!Array.isArray(codes)) fail(`initParams.${key} 必须是数组。`)
    codes.forEach((code, index) => readInteger(code, `initParams.${key}[${index}]`, 0))
  }
  return value as unknown as EngineDuelInitParams
}

export function parseEngineSessionDoc(value: unknown): EngineSessionDoc {
  assertRecord(value, '剧本')
  if (value.version !== ENGINE_SESSION_DOC_VERSION) {
    fail(`不支持的版本 ${String(value.version)}，当前仅支持版本 ${ENGINE_SESSION_DOC_VERSION}。`)
  }
  if (!Array.isArray(value.seed)) fail('seed 必须是数组。')
  const seed = value.seed.map((item, index) => readNumber(item, `seed[${index}]`))
  const initParams = parseInitParams(value.initParams)
  if (!Array.isArray(value.ops)) fail('ops 必须是数组。')
  const ops = value.ops.map((op, index) => parseOp(op, index))
  if (!Array.isArray(value.timeline) || value.timeline.length === 0) {
    fail('timeline 必须是非空数组。')
  }
  const timeline = value.timeline.map((node, index) => parseTimelineNode(node, index))
  const currentStepId = readString(value.currentStepId, 'currentStepId')

  const nodeById = new Map<string, EngineTimelineNode>()
  for (const node of timeline) {
    if (nodeById.has(node.id)) fail(`时间线节点 id 重复：${node.id}`)
    if (node.opIndex >= ops.length) {
      fail(`节点 ${node.id} 的 opIndex=${node.opIndex} 超出操作流长度 ${ops.length}。`)
    }
    nodeById.set(node.id, node)
  }
  for (const node of timeline) {
    if (node.parentId !== null && !nodeById.has(node.parentId)) {
      fail(`节点 ${node.id} 的父节点 ${node.parentId} 不存在。`)
    }
  }
  if (!nodeById.has(currentStepId)) {
    fail(`currentStepId=${currentStepId} 不在时间线中。`)
  }

  const visited = new Set<string>()
  let cursor = nodeById.get(currentStepId)
  while (cursor) {
    if (visited.has(cursor.id)) fail('时间线父链存在循环。')
    visited.add(cursor.id)
    cursor = cursor.parentId ? nodeById.get(cursor.parentId) : undefined
  }

  const timingValue = value.timingPolicy
  const timingPolicy = normalizeTimingPolicy(
    isRecord(timingValue) ? (timingValue as Partial<TimingPolicy>) : null
  )

  return {
    version: ENGINE_SESSION_DOC_VERSION,
    seed,
    initParams,
    ops,
    timeline,
    currentStepId,
    timingPolicy
  }
}
