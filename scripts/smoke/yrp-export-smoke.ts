import fs from 'fs'
import path from 'path'
import { decompress } from '@cjser/lzma1'
import { _OcgcoreConstants } from 'koishipro-core.js'
import { YGOProMessages } from 'ygopro-msg-encode'
import { duelSession } from '../../src/main/services/duel/duel-session'
import { decodeSessionOp } from '@shared/index'
import type { Answer, EngineDuelInitParams, EngineRequest } from '@shared/index'
import { cdbService } from './cdb-shim'
import { getOcgcoreEngine } from './ocgcore-engine-shim'
import { exportSessionToYrp } from '../../src/main/services/duel/yrp-exporter'

const { OcgcoreScriptConstants } = _OcgcoreConstants
const REPLAY_ID_YRP2 = 0x32707279
const PRO_VERSION = 0x1362

function buildInitParams(): EngineDuelInitParams {
  const p0Deck = [
    89631139, 23434538, 14558127, 70342110, 66518841, 97997309, 53129443, 89631139, 46986414,
    26082229, 72302403, 44095762, 83764718, 6368038, 12580477, 74677422, 4064256, 89943723,
    23434538, 14558127, 70342110, 66518841, 97997309, 53129443, 46986414, 26082229, 72302403,
    44095762, 83764718, 6368038, 12580477, 74677422, 4064256, 89943723, 10000000, 10000010,
    10000020, 89631139, 46986414, 23434538
  ]
  return {
    p0Lp: 8000,
    p1Lp: 8000,
    p0StartHand: 5,
    p1StartHand: 5,
    p0Deck: [...p0Deck],
    p1Deck: [...p0Deck],
    p0Extra: [],
    p1Extra: []
  }
}

function autoAnswer(request: EngineRequest, doSummon: boolean): Answer {
  const d = request.data
  switch (d.kind) {
    case 'rps':
      return { kind: 'rps', hand: 'paper' }
    case 'idle': {
      if (doSummon && d.summonable.length > 0) {
        return { kind: 'idle', cmd: 'SUMMON', card: d.summonable[0] }
      }
      return { kind: 'idle', cmd: d.canEp ? 'TO_EP' : d.canBp ? 'TO_BP' : 'TO_EP' }
    }
    case 'battle':
      return { kind: 'battle', cmd: 'TO_EP' }
    case 'yesno':
      return { kind: 'yesno', yes: false }
    case 'chain':
      return { kind: 'chain', card: null }
    case 'card':
      return d.cancelable
        ? { kind: 'card', cards: null }
        : { kind: 'card', cards: d.cards.slice(0, Math.max(1, d.min)) }
    case 'tribute':
      return d.cancelable
        ? { kind: 'tribute', cards: null }
        : { kind: 'tribute', cards: d.cards.slice(0, Math.max(1, d.min)) }
    case 'place':
      return { kind: 'place', places: d.places.slice(0, Math.max(1, d.count)) }
    case 'disfield':
      return { kind: 'disfield', places: d.places.slice(0, Math.max(1, d.count)) }
    case 'position':
      return { kind: 'position', position: d.positions[0] }
    case 'option':
      return { kind: 'option', index: 0 }
    case 'sort':
      return { kind: 'sort', cards: null }
    case 'unselect':
      return d.finishable
        ? { kind: 'unselect', card: null }
        : d.selectable.length > 0
          ? { kind: 'unselect', card: d.selectable[0] }
          : { kind: 'unselect', card: null }
    case 'announce':
      return d.announceType === 'number'
        ? { kind: 'announce', value: d.numbers![0] }
        : { kind: 'announce', value: d.availableMask ? d.availableMask & -d.availableMask : 1 }
    case 'counter':
      return { kind: 'counter', counters: [] }
    case 'sum': {
      const picked = [...d.mustSelect]
      for (const card of d.cards) {
        if (picked.length >= d.count) break
        if (!picked.some((p) => p.code === card.code && p.sequence === card.sequence)) {
          picked.push(card)
        }
      }
      return { kind: 'sum', cards: picked }
    }
    default:
      throw new Error(`autoAnswer 未覆盖 kind=${request.kind}`)
  }
}

function assert(condition: boolean, message: string): void {
  if (!condition) throw new Error(`断言失败: ${message}`)
}

interface ParsedYrp {
  header: {
    id: number
    version: number
    flag: number
    seed: number
    dataSize: number
    startTime: number
    props: number[]
    seedSequence: number[]
    headerVersion: number
    value123: number[]
  }
  hostName: string
  clientName: string
  startLp: number
  startHand: number
  drawCount: number
  opt: number
  decks: { main: number[]; extra: number[] }[]
  responses: Buffer[]
}

function parseYrp(buffer: Buffer): ParsedYrp {
  let off = 0
  const u32 = (): number => {
    const v = buffer.readUInt32LE(off)
    off += 4
    return v
  }
  const id = u32()
  const version = u32()
  const flag = u32()
  const seed = u32()
  const dataSize = u32()
  const startTime = u32()
  const props = [...buffer.subarray(off, off + 8)]
  off += 8
  assert(id === REPLAY_ID_YRP2, `id 应为 'yrp2'，实际 0x${id.toString(16)}`)
  assert(
    version === PRO_VERSION,
    `version 应为 0x${PRO_VERSION.toString(16)}，实际 0x${version.toString(16)}`
  )
  assert((flag & 0x1) !== 0, 'flag 应含 REPLAY_COMPRESSED')
  if (version >= 0x1353) assert((flag & 0x10) !== 0, 'version >= 0x1353 必须含 REPLAY_UNIFORM')
  const seedSequence = Array.from({ length: 8 }, u32)
  const headerVersion = u32()
  const value123 = [u32(), u32(), u32()]
  assert(headerVersion === 1, 'header_version 应为 1')
  assert(off === 80, `yrp2 头应 80 字节，实际 ${off}`)

  const lzmaHeader = Buffer.alloc(13)
  Buffer.from(props.slice(0, 5)).copy(lzmaHeader, 0)
  lzmaHeader.writeUInt32LE(dataSize, 5)
  const body = Buffer.from(decompress(Buffer.concat([lzmaHeader, buffer.subarray(off)])))
  assert(body.length === dataSize, `datasize 与解压后长度不符: ${dataSize} vs ${body.length}`)

  let boff = 0
  const bU32 = (): number => {
    const v = body.readUInt32LE(boff)
    boff += 4
    return v
  }
  const bI32 = (): number => {
    const v = body.readInt32LE(boff)
    boff += 4
    return v
  }
  const readName = (): string => {
    const raw = body.subarray(boff, boff + 40)
    boff += 40
    return Buffer.from(raw).toString('utf16le').replace(/\0+$/, '')
  }
  const hostName = readName()
  const clientName = readName()
  const startLp = bI32()
  const startHand = bI32()
  const drawCount = bI32()
  const opt = bU32()
  const decks = [0, 1].map(() => {
    const mainCount = bI32()
    const main = Array.from({ length: mainCount }, bI32)
    const extraCount = bI32()
    const extra = Array.from({ length: extraCount }, bI32)
    return { main, extra }
  })
  const responses: Buffer[] = []
  while (boff < body.length) {
    const len = body.readUInt8(boff)
    boff += 1
    assert(len > 0, '响应长度不应为 0')
    assert(boff + len <= body.length, '响应流越界')
    responses.push(Buffer.from(body.subarray(boff, boff + len)))
    boff += len
  }
  assert(boff === body.length, '响应流应恰好耗尽 body')
  return {
    header: {
      id,
      version,
      flag,
      seed,
      dataSize,
      startTime,
      props,
      seedSequence,
      headerVersion,
      value123
    },
    hostName,
    clientName,
    startLp,
    startHand,
    drawCount,
    opt,
    decks,
    responses
  }
}

function countMessageTypes(stream: Uint8Array[]): Map<string, number> {
  const counts = new Map<string, number>()
  for (const chunk of stream) {
    for (const msg of YGOProMessages.getInstancesFromPayload(chunk)) {
      const name = msg.constructor.name
      counts.set(name, (counts.get(name) ?? 0) + 1)
    }
  }
  return counts
}

function sameBytes(a: Uint8Array, b: Uint8Array): boolean {
  return a.length === b.length && a.every((v, i) => v === b[i])
}

async function main(): Promise<void> {
  await cdbService.ready()
  const initParams = buildInitParams()
  const start = await duelSession.startDuel(initParams)
  console.log(
    `[yrp-export-smoke] 开局: P0 手牌=${start.boardState.players[0].hand.length} 卡组=${start.boardState.players[0].deckCount} LP=${start.boardState.players[0].lp}`
  )

  let answers = 0
  let summoned = false
  while (answers < 14) {
    const pending = duelSession.getPendingRequest()
    if (!pending) break
    const res = duelSession.submitAnswer(autoAnswer(pending, !summoned))
    if (!res.retry && pending.kind === 'idle' && !summoned) summoned = true
    if (res.retry) throw new Error('对局被引擎拒绝 (RETRY)')
    answers++
  }
  assert(summoned, '至少应执行一次召唤类应答')
  const board = duelSession.getBoardState()
  console.log(
    `[yrp-export-smoke] 对局推进: 应答 ${answers} 次, P0 场上=${board.players[0].mzone[0]?.code ?? '无'} 手牌=${board.players[0].hand.length} 回合=${board.turn}`
  )
  const timelineTitles = duelSession
    .getTimeline()
    .map((node) => node.title)
    .slice(-6)
  console.log(`[yrp-export-smoke] 时间线尾步: ${timelineTitles.join(' | ')}`)

  const doc = duelSession.exportSessionDoc()
  const ops = doc.ops.map(decodeSessionOp)
  const expectedResponses = ops.flatMap((op) => op.responses)

  const outDir = path.join(process.cwd(), 'scripts', 'smoke', 'out')
  fs.mkdirSync(outDir, { recursive: true })
  const outPath = path.join(outDir, 'yrp-export-smoke.yrp')
  const result = await exportSessionToYrp(
    { seed: doc.seed, initParams: doc.initParams, ops },
    outPath
  )

  const stat = fs.statSync(outPath)
  console.log(`[yrp-export-smoke] 导出: ${outPath}`)
  console.log(
    `[yrp-export-smoke] 统计: 文件=${stat.size}B body(解压)=${result.bodySize}B 压缩块=${result.compressedSize}B 消息块=${result.messageChunkCount} 消息包=${result.messagePacketCount} 响应=${result.responseCount}`
  )
  console.log(`[yrp-export-smoke] 头部 hex: ${result.buffer.subarray(0, 80).toString('hex')}`)
  const h = result.header
  console.log(
    `[yrp-export-smoke] header: id=0x${h.id.toString(16)} version=0x${h.version.toString(16)} flag=0x${h.flag.toString(16)} seed=${h.seed} datasize=${h.dataSize} time=${new Date(h.startTime * 1000).toISOString()} props=[${h.props}] seeds=[${h.seedSequence}]`
  )
  const typeCounts = [...countMessageTypes(result.messageStream).entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([name, count]) => `${name}×${count}`)
    .join(' ')
  console.log(`[yrp-export-smoke] 消息分布: ${typeCounts}`)

  const parsed = parseYrp(result.buffer)
  assert(
    parsed.header.seedSequence.slice(0, doc.seed.length).every((s, i) => s === doc.seed[i] >>> 0),
    'seed_sequence 与会话 seed 一致'
  )
  assert(
    parsed.startLp === 8000 && parsed.startHand === 5 && parsed.drawCount === 1,
    'params 与会话一致'
  )
  assert(
    parsed.decks[0].main.length === initParams.p0Deck!.length &&
      parsed.decks[0].main.every(
        (code, i) => code === initParams.p0Deck![initParams.p0Deck!.length - 1 - i]
      ) &&
      parsed.decks[1].main.every(
        (code, i) => code === initParams.p1Deck![initParams.p1Deck!.length - 1 - i]
      ),
    '牌组列表应为会话卡组的逆序（yrp 列表[0] = 卡组底）'
  )
  assert(
    parsed.responses.length === result.responseCount &&
      result.responseCount <= expectedResponses.length &&
      parsed.responses.every((r, i) => sameBytes(r, expectedResponses[i])),
    '响应流应为会话 ops 响应的前缀且逐字节一致'
  )
  const truncated = expectedResponses.length - result.responseCount
  console.log(
    `[yrp-export-smoke] 反向解析: 头部80B ✓ datasize ✓ lzma 解压 ✓ names="${parsed.hostName}"/"${parsed.clientName}" opt=0x${parsed.opt.toString(16)} 牌组=[${parsed.decks.map((d) => `main×${d.main.length}+extra×${d.extra.length}`).join(' ')}] 响应 ${parsed.responses.length} 条逐字节一致 ✓${truncated > 0 ? ` (对局已结束，截断尾部 ${truncated} 条响应)` : ''}`
  )

  const engine = await getOcgcoreEngine()
  const duel = engine.createDuelV2(parsed.header.seedSequence)
  duel.setPlayerInfo({
    player: 0,
    lp: parsed.startLp,
    startHand: parsed.startHand,
    drawCount: parsed.drawCount
  })
  duel.setPlayerInfo({
    player: 1,
    lp: parsed.startLp,
    startHand: parsed.startHand,
    drawCount: parsed.drawCount
  })
  for (const player of [0, 1] as const) {
    for (const code of parsed.decks[player].main) {
      duel.newCard({
        code,
        owner: player,
        player,
        location: OcgcoreScriptConstants.LOCATION_DECK,
        sequence: 0,
        position: OcgcoreScriptConstants.POS_FACEDOWN_DEFENSE
      })
    }
    for (const code of parsed.decks[player].extra) {
      duel.newCard({
        code,
        owner: player,
        player,
        location: OcgcoreScriptConstants.LOCATION_EXTRA,
        sequence: 0,
        position: OcgcoreScriptConstants.POS_FACEDOWN_DEFENSE
      })
    }
  }
  duel.startDuel(parsed.opt)
  const clientStream: Uint8Array[] = []
  let responseIndex = 0
  while (true) {
    const res = duel.process({ noParse: true })
    if (res.raw.length > 0) clientStream.push(res.raw)
    if (res.status === 1) {
      if (responseIndex >= parsed.responses.length) break
      duel.setResponse(parsed.responses[responseIndex++])
      continue
    }
    if (res.status === 2 || duel.ended) break
  }
  duel.endDuel()

  let firstDiff = -1
  for (let i = 0; i < Math.min(clientStream.length, result.messageStream.length); i++) {
    if (!sameBytes(clientStream[i], result.messageStream[i])) {
      firstDiff = i
      break
    }
  }
  const clientTypes = countMessageTypes(clientStream)
  console.log(
    `[yrp-export-smoke] 回放对比: 块数 导出=${result.messageStream.length} 回放=${clientStream.length} 首个差异块=${firstDiff}`
  )
  console.log(
    `[yrp-export-smoke] 回放消息分布: ${[...clientTypes.entries()]
      .sort((a, b) => b[1] - a[1])
      .map(([n, c]) => `${n}×${c}`)
      .join(' ')}`
  )
  for (
    let i = Math.max(0, firstDiff - 1);
    i < Math.min(firstDiff + 4, result.messageStream.length);
    i++
  ) {
    const types = (s: Uint8Array): string =>
      YGOProMessages.getInstancesFromPayload(s)
        .map((m) => m.constructor.name)
        .join('+')
    console.log(
      `[yrp-export-smoke] 块[${i}] 导出=(${types(result.messageStream[i])}) 回放=(${i < clientStream.length ? types(clientStream[i]) : '无'})`
    )
  }
  assert(
    clientStream.length === result.messageStream.length &&
      clientStream.every((chunk, i) => sameBytes(chunk, result.messageStream[i])),
    `客户端模拟回放消息流应与导出重演逐字节一致: ${clientStream.length} vs ${result.messageStream.length} 块`
  )
  console.log(
    `[yrp-export-smoke] 回放验证: 按 ReplayMode::StartDuel 流程用 yrp 头部信息重建对局并喂入响应流, 消息流 ${clientStream.length} 块与导出重演逐字节一致 ✓`
  )

  console.log('[yrp-export-smoke] ALL CHECKS PASSED')
  process.exit(0)
}

main().catch((err) => {
  console.error('[yrp-export-smoke] FAILED:', err)
  process.exit(1)
})
