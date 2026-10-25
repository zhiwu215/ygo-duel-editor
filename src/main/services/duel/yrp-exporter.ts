import { compress } from '@cjser/lzma1'
import fs from 'fs'
import { CardLocation, type DuelOperation, type EngineDuelInitParams } from '@shared/index'
import { OcgcoreDuelRule } from 'koishipro-core.js'
import { YGOProMessages, YGOProMsgRetry } from 'ygopro-msg-encode'
import { getOcgcoreEngine } from './ocgcore-engine'
import { buildStartDuelOptions, setupFromDeckParams, setupFromPuzzleState } from './session-setup'
import { createSessionState, type SessionState } from './session-state'

const REPLAY_ID_YRP2 = 0x32707279
const REPLAY_COMPRESSED = 0x1
const REPLAY_UNIFORM = 0x10
const PRO_VERSION = 0x1362
const HEADER_VERSION = 1
const SEED_COUNT = 8
const NAME_BYTES = 40
const MAX_RESPONSE_LENGTH = 255
const MAX_PROCESS_LOOPS = 10000
const LZMA_MODE = 5
const DEFAULT_HOST_NAME = 'YGO Duel Editor'
const DEFAULT_CLIENT_NAME = 'Replay'

export interface YrpExportInput {
  seed: number[]
  initParams: EngineDuelInitParams
  ops: DuelOperation[]
  hostName?: string
  clientName?: string
}

export interface YrpExportHeader {
  id: number
  version: number
  flag: number
  seed: number
  dataSize: number
  startTime: number
  props: number[]
  seedSequence: number[]
}

export interface YrpExportResult {
  buffer: Buffer
  header: YrpExportHeader
  messageChunkCount: number
  messagePacketCount: number
  responseCount: number
  bodySize: number
  compressedSize: number
  messageStream: Uint8Array[]
}

interface YrpDeck {
  main: number[]
  extra: number[]
}

function pump(state: SessionState, stream: Uint8Array[]): number {
  const duel = state.duel
  if (!duel) throw new Error('当前没有可推进的对局。')
  let packets = 0
  let loops = 0
  while (true) {
    if (++loops > MAX_PROCESS_LOOPS) {
      throw new Error('引擎推进步数超出上限，可能陷入死循环。')
    }
    const res = duel.process({ noParse: true })
    if (res.raw.length > 0) {
      stream.push(res.raw)
      const msgs = YGOProMessages.getInstancesFromPayload(res.raw)
      if (msgs.some((msg) => msg instanceof YGOProMsgRetry)) {
        throw new Error('引擎拒绝了历史响应 (RETRY)，无法导出该对局。')
      }
      packets += msgs.length
    }
    if (res.status === 1) return packets
    if (res.status === 2 || duel.ended) return packets
  }
}

function decksFromPuzzle(initParams: EngineDuelInitParams): YrpDeck[] {
  const puzzle = initParams.puzzleState
  if (!puzzle) throw new Error('缺少 puzzleState。')
  const fieldCards = puzzle.cards.filter((c) => c.code > 0)
  const outside = fieldCards.filter(
    (c) => c.location !== CardLocation.DECK && c.location !== CardLocation.EXTRA
  )
  if (outside.length > 0) {
    throw new Error('yrp 只能记录初始牌组与响应流，无法表达初始手牌/场面卡片，该谜题不可导出。')
  }
  return [0, 1].map((player) => {
    const pile = (location: number): typeof fieldCards =>
      fieldCards.filter((c) => c.controller === player && c.location === location)
    const main = pile(CardLocation.DECK)
      .sort((a, b) => b.sequence - a.sequence)
      .map((c) => c.code)
    const extra = pile(CardLocation.EXTRA)
      .sort((a, b) => a.sequence - b.sequence)
      .map((c) => c.code)
    return { main, extra }
  }) as [YrpDeck, YrpDeck]
}

function decksFromParams(initParams: EngineDuelInitParams): YrpDeck[] {
  return [0, 1].map((player) => {
    const deck = player === 0 ? initParams.p0Deck : initParams.p1Deck
    const extra = player === 0 ? initParams.p0Extra : initParams.p1Extra
    if (!deck || deck.length === 0) {
      throw new Error('卡组模式导出需要显式提供 p0Deck/p1Deck。')
    }
    return {
      main: [...deck].reverse(),
      extra: [...(extra ?? [])]
    }
  }) as [YrpDeck, YrpDeck]
}

function startOptions(initParams: EngineDuelInitParams): number {
  if (initParams.puzzleState) {
    const { rule, flags } = buildStartDuelOptions(
      initParams.puzzleState.masterRule,
      Boolean(initParams.puzzleState.firstTurnAttack)
    )
    return (((rule & 0xffff) << 16) | flags.reduce((acc, flag) => acc | flag, 0)) >>> 0
  }
  return (((OcgcoreDuelRule.MasterRule2020 & 0xffff) << 16) | 16) >>> 0
}

function duelParams(initParams: EngineDuelInitParams): {
  startLp: number
  startHand: number
  drawCount: number
} {
  if (initParams.puzzleState) {
    const lp0 = Number(initParams.puzzleState.players[0]?.lp ?? 8000)
    const lp1 = Number(initParams.puzzleState.players[1]?.lp ?? 8000)
    if (lp0 !== lp1) {
      throw new Error('yrp 的 start_lp 为单一数值，要求双方初始 LP 相同。')
    }
    return { startLp: lp0, startHand: 0, drawCount: 1 }
  }
  const lp0 = initParams.p0Lp ?? 8000
  const lp1 = initParams.p1Lp ?? 8000
  if (lp0 !== lp1) {
    throw new Error('yrp 的 start_lp 为单一数值，要求双方初始 LP 相同。')
  }
  const hand0 = initParams.p0StartHand ?? 5
  const hand1 = initParams.p1StartHand ?? 5
  if (hand0 !== hand1) {
    throw new Error('yrp 的 start_hand 为单一数值，要求双方起始手牌数相同。')
  }
  return { startLp: lp0, startHand: hand0, drawCount: 1 }
}

function writeName(name: string): Buffer {
  const buf = Buffer.alloc(NAME_BYTES)
  buf.write(name, 0, NAME_BYTES, 'utf16le')
  return buf
}

function writeDeckSection(codes: number[]): Buffer[] {
  return [makeInt32(codes.length), ...codes.map((code) => makeInt32(code))]
}

function makeInt32(value: number): Buffer {
  const buf = Buffer.alloc(4)
  buf.writeInt32LE(value | 0, 0)
  return buf
}

async function replayAndCapture(input: YrpExportInput): Promise<{
  stream: Uint8Array[]
  packetCount: number
  consumed: Uint8Array[]
}> {
  if (input.ops.some((op) => op.type === 'inject')) {
    throw new Error('对局包含注入（inject）操作，yrp 格式无法表达对局中注入的卡片，无法导出。')
  }

  const state = createSessionState()
  state.ocgcore = await getOcgcoreEngine()
  state.replaying = true
  state.seed = [...input.seed]
  state.initParams = structuredClone(input.initParams)
  state.duel = state.ocgcore!.createDuelV2(state.seed)

  const stream: Uint8Array[] = []
  let packetCount = 0
  const capture = (): void => {
    packetCount += pump(state, stream)
  }

  if (input.initParams.puzzleState) {
    setupFromPuzzleState(state, input.initParams.puzzleState)
  } else {
    setupFromDeckParams(state, input.initParams)
  }
  capture()

  const consumed: Uint8Array[] = []
  for (const op of input.ops) {
    if (state.duel!.ended) break
    if (op.type === 'inject') continue
    for (const response of op.responses) {
      if (response.length === 0 || response.length > MAX_RESPONSE_LENGTH) {
        throw new Error(`响应长度非法：${response.length}`)
      }
      state.duel!.setResponse(response)
      capture()
      consumed.push(response)
      if (state.duel!.ended) break
    }
  }
  state.duel!.endDuel()

  return { stream, packetCount, consumed }
}

export async function exportSessionToYrp(
  input: YrpExportInput,
  filePath: string
): Promise<YrpExportResult> {
  if (!input.seed || input.seed.length === 0) {
    throw new Error('缺少对局 seed。')
  }
  const { stream, packetCount, consumed } = await replayAndCapture(input)

  const deckMode = input.initParams.puzzleState ? decksFromPuzzle : decksFromParams
  const decks = deckMode(input.initParams)
  const { startLp, startHand, drawCount } = duelParams(input.initParams)
  const opt = startOptions(input.initParams)

  const bodyChunks: Buffer[] = [
    writeName(input.hostName ?? DEFAULT_HOST_NAME),
    writeName(input.clientName ?? DEFAULT_CLIENT_NAME),
    makeInt32(startLp),
    makeInt32(startHand),
    makeInt32(drawCount),
    makeInt32(opt)
  ]
  for (const deck of decks) {
    bodyChunks.push(...writeDeckSection(deck.main), ...writeDeckSection(deck.extra))
  }
  for (const response of consumed) {
    bodyChunks.push(Buffer.from([response.length]), Buffer.from(response))
  }
  const body = Buffer.concat(bodyChunks)

  const lzma = compress(body, LZMA_MODE)
  const props = [...lzma.subarray(0, 5), 0, 0, 0]
  const startTime = Math.floor(Date.now() / 1000)
  const seedSequence = [...input.seed]
  while (seedSequence.length < SEED_COUNT) seedSequence.push(0)

  const header = Buffer.alloc(80)
  header.writeUInt32LE(REPLAY_ID_YRP2, 0)
  header.writeUInt32LE(PRO_VERSION, 4)
  header.writeUInt32LE(REPLAY_COMPRESSED | REPLAY_UNIFORM, 8)
  header.writeUInt32LE(input.seed[0] >>> 0, 12)
  header.writeUInt32LE(body.length >>> 0, 16)
  header.writeUInt32LE(startTime >>> 0, 20)
  Buffer.from(props).copy(header, 24)
  seedSequence.forEach((seed, index) => header.writeUInt32LE(seed >>> 0, 32 + index * 4))
  header.writeUInt32LE(HEADER_VERSION, 64)
  header.writeUInt32LE(0, 68)
  header.writeUInt32LE(0, 72)
  header.writeUInt32LE(0, 76)

  const buffer = Buffer.concat([header, Buffer.from(lzma.subarray(13))])
  fs.writeFileSync(filePath, buffer)

  return {
    buffer,
    header: {
      id: REPLAY_ID_YRP2,
      version: PRO_VERSION,
      flag: REPLAY_COMPRESSED | REPLAY_UNIFORM,
      seed: input.seed[0] >>> 0,
      dataSize: body.length,
      startTime,
      props,
      seedSequence
    },
    messageChunkCount: stream.length,
    messagePacketCount: packetCount,
    responseCount: consumed.length,
    bodySize: body.length,
    compressedSize: buffer.length - header.length,
    messageStream: stream
  }
}
