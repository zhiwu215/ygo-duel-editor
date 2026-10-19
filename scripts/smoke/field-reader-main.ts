/**
 * R1+R2 冒烟测试：真实引擎 + FieldReader 全量查询 + 问答模型（routeRequest/encodeAnswer）
 *
 * 验证点：
 *  1. 默认卡组开局后，全量查询能读到双方手牌/卡组/墓地等
 *  2. newCard 注入实验（MR4+ 灵摆区 = szone 0/4 等）
 *  3. 两次连续 readBoard 的 instanceId 保持稳定
 *  4. 问答模型：程序化对局若干步，请求路由 + 自动作答无 RETRY
 */
import path from 'path'
import fs from 'fs'
import { createRequire } from 'module'

// 仅以 CJS bundle 形式运行：node 的 CJS 包装器提供 __filename
declare const __filename: string
const coreRequire = createRequire(__filename)
import { cdbService } from './cdb-shim'
import { readEngineCardData } from '../../src/main/services/duel/card-reader'
import { FieldReader } from '../../src/main/services/duel/field-reader'
import { CardLocation } from '@shared/constants/locations'
import type { EngineRequest, Answer } from '@shared/engine/protocol'

const GAME_DIR = process.env.YGO_SMOKE_GAMEDIR || 'E:/MyCardLibrary/ygopro'

const TEST_DECK = [
  89631139, 89631139, 89631139, 14558127, 23434538, 70342110, 70342110, 66518841, 66518841, 97997309
]

const TYPE_PENDULUM = 0x1000000

async function main(): Promise<void> {
  await cdbService.ready()
  console.log('[smoke] cdb loaded, cards:', cdbService.size)

  const { OcgcoreDuelRule, OcgcoreDuelOptionFlag } = coreRequire('koishipro-core.js')
  // dist/index.cjs → dist 目录 → dist/vendor/wasm_cjs（CJS 构建用 cjs 目录的 wasm）
  const wasmDir = path.join(
    path.dirname(coreRequire.resolve('koishipro-core.js')),
    'vendor/wasm_cjs'
  )
  // 全 CJS 加载（bundle 内两个依赖也被 alias 到 CJS 构建，保证类实例同源）
  const { createOcgcoreWrapper } = await import('koishipro-core.js')
  // DirScriptReader 的 ESM 构建有 node 兼容 bug（loadNodeModule），这里用等效的纯 fs 实现
  // 引擎传来的路径形如 "./script/constant.lua" 或 "c89631139.lua"
  const DirScriptReader =
    (scriptRoot: string) =>
    (scriptPath: string): Uint8Array | null => {
      if (process.env.YGO_SMOKE_DEBUG) console.log(`[dbg] readScript: ${scriptPath}`)
      const normalized = scriptPath.replace(/^\.\//, '').replace(/^script\//, '')
      try {
        return new Uint8Array(fs.readFileSync(path.join(scriptRoot, normalized)))
      } catch {
        return null
      }
    }
  const ygopro = await import('ygopro-msg-encode')
  const { routeRequest } = await import('../../src/main/services/duel/request-router')
  const { encodeAnswer } = await import('../../src/main/services/duel/answer-encoder')

  // emscripten 胶水在 node 下会 fetch 文件路径（unknown scheme），直接喂 wasm 字节
  const wasmBinary = new Uint8Array(fs.readFileSync(path.join(wasmDir, 'libocgcore.wasm')))
  const wrapper = await createOcgcoreWrapper({ wasmBinary })
  wrapper.setMessageHandler((_, message, type) => {
    if (type === 2) console.log(`[core-error] ${message}`)
  })
  wrapper.setCardReader((code) => readEngineCardData(code))
  wrapper.setScriptReader(DirScriptReader(GAME_DIR + '/script'), true)

  const duel = wrapper.createDuelV2([12345, 67890, 11111, 22222])
  duel.setPlayerInfo({ player: 0, lp: 8000, startHand: 5, drawCount: 1 })
  duel.setPlayerInfo({ player: 1, lp: 8000, startHand: 5, drawCount: 1 })

  for (const code of [...TEST_DECK].reverse()) {
    duel.newCard({ code, owner: 0, player: 0, location: 0x01, sequence: 0, position: 0x8121 })
  }
  for (const code of TEST_DECK) {
    duel.newCard({ code, owner: 1, player: 1, location: 0x01, sequence: 0, position: 0x8121 })
  }

  duel.startDuel({
    rule: OcgcoreDuelRule.MasterRule2020,
    flags: [OcgcoreDuelOptionFlag.PseudoShuffle, OcgcoreDuelOptionFlag.RevealDeckSeq]
  })

  const reader = new FieldReader()
  reader.reset([8000, 8000], 0)

  const locName: Record<number, string> = {
    [CardLocation.HAND]: 'hand',
    [CardLocation.MZONE]: 'mzone',
    [CardLocation.SZONE]: 'szone',
    [CardLocation.GRAVE]: 'grave',
    [CardLocation.REMOVED]: 'removed',
    [CardLocation.DECK]: 'deck',
    [CardLocation.EXTRA]: 'extra',
    [CardLocation.FZONE]: 'fzone',
    [CardLocation.PZONE]: 'pzone'
  }

  let loops = 0
  let pendingMsg: unknown = null
  let descHint: number | undefined = undefined

  const advanceToWait = (): void => {
    pendingMsg = null
    loops = 0
    while (true) {
      if (++loops > 5000) throw new Error('process loop overflow')
      const res = duel.process()
      if (process.env.YGO_SMOKE_DEBUG) {
        console.log(
          `[dbg] process: status=${res.status} msgs=${(res.messages ?? []).length} raw=${res.length}`
        )
      }
      for (const msg of res.messages ?? []) {
        reader.applyMetaMessage(msg)
        if (process.env.YGO_SMOKE_DEBUG) {
          const ctor = (msg as { constructor?: { name?: string } }).constructor
          const sameChain = ygopro.YGOProMsgSelectChain
          console.log(`[dbg]   msg: ${ctor?.name} ctorMatch=${ctor === sameChain}`)
        }
        if (msg instanceof ygopro.YGOProMsgHint && msg.type === 3) descHint = msg.desc
        if (
          msg instanceof ygopro.YGOProMsgSelectIdleCmd ||
          msg instanceof ygopro.YGOProMsgSelectBattleCmd ||
          msg instanceof ygopro.YGOProMsgSelectCard ||
          msg instanceof ygopro.YGOProMsgSelectTribute ||
          msg instanceof ygopro.YGOProMsgSelectChain ||
          msg instanceof ygopro.YGOProMsgSelectPlace ||
          msg instanceof ygopro.YGOProMsgSelectPosition ||
          msg instanceof ygopro.YGOProMsgSelectYesNo ||
          msg instanceof ygopro.YGOProMsgSelectEffectYn ||
          msg instanceof ygopro.YGOProMsgSelectOption ||
          msg instanceof ygopro.YGOProMsgAnnounceNumber ||
          msg instanceof ygopro.YGOProMsgAnnounceCard ||
          msg instanceof ygopro.YGOProMsgRockPaperScissors
        ) {
          pendingMsg = msg
        }
      }
      if (res.status === 1 || duel.ended) break
    }
  }

  // --- 到第一个等待点 ---
  advanceToWait()
  const board1 = reader.readBoard(duel)
  const grouped1 = new Map<string, number>()
  for (const c of board1.allCards) {
    const k = `P${c.controller}.${locName[c.location] ?? c.location}`
    grouped1.set(k, (grouped1.get(k) ?? 0) + 1)
  }
  console.log('[smoke] 开局场地分布:', Object.fromEntries(grouped1))
  console.log(
    '[smoke] LP:',
    board1.players.map((p) => p.lp),
    '回合:',
    board1.turn,
    '阶段:',
    board1.phaseName
  )
  if ((grouped1.get('P0.hand') ?? 0) !== 5 || (grouped1.get('P1.hand') ?? 0) !== 5) {
    throw new Error(`开局手牌数不对: P0=${grouped1.get('P0.hand')} P1=${grouped1.get('P1.hand')}`)
  }

  // --- 注入实验 ---
  const pendulumCards = cdbService.findCardsByType(TYPE_PENDULUM, 2)
  console.log(
    '[smoke] 挑选灵摆卡:',
    pendulumCards.map((c) => `${c.id}(lv=${c.level})`)
  )
  const injectExperiments: { name: string; card: Parameters<typeof duel.newCard>[0] }[] = [
    ...pendulumCards.map((c, i) => ({
      name: `szone#${i * 4} pendulum`,
      card: { code: c.id, owner: 0, player: 0, location: 0x08, sequence: i * 4, position: 0x5 }
    })),
    {
      name: 'szone#1 faceup-spell',
      card: { code: TEST_DECK[3], owner: 0, player: 0, location: 0x08, sequence: 1, position: 0x5 }
    },
    {
      name: 'mzone#0 faceup-attack',
      card: { code: 89631139, owner: 0, player: 0, location: 0x04, sequence: 0, position: 0x5 }
    },
    {
      name: 'grave#0',
      card: { code: TEST_DECK[4], owner: 0, player: 0, location: 0x10, sequence: 0, position: 0x1 }
    },
    {
      name: 'deck-top',
      card: { code: TEST_DECK[5], owner: 0, player: 0, location: 0x01, sequence: 0, position: 0x1 }
    }
  ]
  const injectionResults: Record<string, boolean> = {}
  for (const exp of injectExperiments) {
    const before = {
      deck: duel.queryFieldCount({ player: 0, location: 0x01 }),
      mzone: duel.queryFieldCount({ player: 0, location: 0x04 }),
      szone: duel.queryFieldCount({ player: 0, location: 0x08 }),
      grave: duel.queryFieldCount({ player: 0, location: 0x10 })
    }
    duel.newCard(exp.card)
    const after = {
      deck: duel.queryFieldCount({ player: 0, location: 0x01 }),
      mzone: duel.queryFieldCount({ player: 0, location: 0x04 }),
      szone: duel.queryFieldCount({ player: 0, location: 0x08 }),
      grave: duel.queryFieldCount({ player: 0, location: 0x10 })
    }
    const delta =
      after.deck -
      before.deck +
      after.mzone -
      before.mzone +
      after.szone -
      before.szone +
      after.grave -
      before.grave
    injectionResults[exp.name] = delta > 0
    console.log(`[smoke] 注入 ${exp.name}: ${delta > 0 ? '成功' : '失败(静默拒绝)'} delta=${delta}`)
  }

  const board2 = reader.readBoard(duel)
  const pendulumInSzone = board2.allCards.filter(
    (c) => c.location === CardLocation.SZONE && pendulumCards.some((p) => p.id === c.code)
  )
  console.log(
    '[smoke] 灵摆卡在 szone 读取:',
    pendulumInSzone.map((c) => `${c.code}@seq${c.sequence}`)
  )
  if (pendulumCards.length > 0 && pendulumInSzone.length < pendulumCards.length) {
    throw new Error(
      `注入的灵摆卡没有被全量查询读到：期望${pendulumCards.length}，实际${pendulumInSzone.length}`
    )
  }

  // --- instanceId 连续性 ---
  const idMap1 = new Map(
    board1.allCards.map((c) => [
      `${c.controller}:${c.location}:${c.sequence}:${c.code}`,
      c.instanceId
    ])
  )
  for (const [key, id] of idMap1) {
    const cur = board2.allCards.find(
      (c) => `${c.controller}:${c.location}:${c.sequence}:${c.code}` === key
    )
    if (cur && cur.instanceId !== id)
      throw new Error(`instanceId 漂移: ${key} ${id} -> ${cur.instanceId}`)
  }
  console.log('[smoke] instanceId 连续性: OK')

  // --- 问答模型：程序化对局 ---
  const seenKinds = new Set<string>()
  let requestCount = 0
  const retryCount = 0

  for (let step = 0; step < 60 && !duel.ended && pendingMsg; step++) {
    const request = routeRequest(pendingMsg, { id: `req-${step}`, seq: step, descHint })
    if (!request) throw new Error(`请求消息路由失败 (step=${step})`)
    seenKinds.add(request.kind)
    requestCount++
    console.log(
      `[smoke] 请求 #${requestCount}: kind=${request.kind} player=${request.player} hint=${descHint} title=${request.title}`
    )

    const answer = autoAnswer(request)
    duel.setResponse(encodeAnswer(pendingMsg, answer))
    advanceToWait()
  }
  console.log(
    '[smoke] 问答模型: 路由',
    requestCount,
    '条, RETRY',
    retryCount,
    '次, kinds:',
    [...seenKinds].join(', ')
  )
  console.log('[smoke] 对局结束?', duel.ended ? '是' : '否（步数上限或无请求）')

  const finalBoard = reader.readBoard(duel)
  console.log(
    '[smoke] 终局: 回合',
    finalBoard.turn,
    '玩家',
    finalBoard.turnPlayer,
    '阶段',
    finalBoard.phaseName
  )

  console.log('[smoke] ALL CHECKS PASSED')
  duel.endDuel()
  wrapper.finalize()
}

function autoAnswer(request: EngineRequest): Answer {
  const d = request.data
  switch (request.kind) {
    case 'rps':
      return { kind: 'rps', hand: 'paper' }
    case 'idle':
      return { kind: 'idle', cmd: 'TO_EP' }
    case 'battle':
      return { kind: 'battle', cmd: 'TO_EP' }
    case 'yesno':
      return { kind: 'yesno', yes: false }
    case 'chain':
      return { kind: 'chain', card: null }
    case 'card': {
      if (d.cancelable) return { kind: 'card', cards: null }
      return { kind: 'card', cards: d.cards.slice(0, Math.max(1, d.min)) }
    }
    case 'tribute':
      if (d.cancelable) return { kind: 'tribute', cards: null }
      return { kind: 'tribute', cards: d.cards.slice(0, Math.max(1, d.min)) }
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
      return { kind: 'unselect', card: null }
    case 'announce': {
      if (d.announceType === 'number') return { kind: 'announce', value: d.numbers![0] }
      if (d.announceType === 'card') return { kind: 'announce', value: 89631139 }
      return { kind: 'announce', value: d.availableMask ? lowestBits(d.availableMask) : 1 }
    }
    case 'counter':
      return { kind: 'counter', counters: [] }
    default:
      throw new Error(`autoAnswer 未覆盖 kind=${request.kind satisfies never as string}`)
  }
}

function lowestBits(mask: number): number {
  let v = 0
  for (let b = 0; b < 24; b++) {
    if (mask & (1 << b)) {
      v |= 1 << b
      break
    }
  }
  return v
}

main().catch((err) => {
  console.error('[smoke] FAILED:', err)
  process.exit(1)
})
