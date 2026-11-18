/**
 * 回放脚本盘面还原联测：
 * 生成给游戏的 single lua 必须与编辑器引擎的建卡顺序/序列完全一致，
 * 否则游戏侧还原出的开局盘面不同，录像应答会错位（表现为游戏回放中途 Error occurs）。
 */
import {
  CardLocation,
  CardPosition,
  DuelPuzzleState,
  FieldCard,
  createStandardTagDuelists,
  generateLuaScript,
  normalizeDuelState,
  parseLuaScript
} from '@shared/index'
import { _OcgcoreConstants, type OcgcoreDuel } from 'koishipro-core.js'
import { createSessionState } from '../../src/main/services/duel/session-state'
import { setupFromPuzzleState } from '../../src/main/services/duel/session-setup'
import { buildDuelFlag } from '../../src/main/services/yrpWriter'
import { cdbService } from './cdb-shim'
import { getOcgcoreEngine } from './ocgcore-engine-shim'
import { DuelSession } from '../../src/main/services/duel/duel-session'
import { autoAnswer } from './autoAnswer'
import { routeRequest } from '../../src/main/services/duel/request-router'
import { encodeAnswer } from '../../src/main/services/duel/answer-encoder'

const {
  LOCATION_HAND,
  LOCATION_DECK,
  LOCATION_EXTRA,
  LOCATION_SZONE,
  LOCATION_GRAVE,
  LOCATION_REMOVED,
  LOCATION_MZONE,
  LOCATION_PZONE
} = _OcgcoreConstants.OcgcoreScriptConstants

const SCRIPT_NAME = 'single/__lua_placement_smoke.lua'
let currentLua = ''
let luaReaderReady = false
const SEED = [12345, 54321, 111, 222]

const QUERY_ZONES = [
  { key: 'hand', location: LOCATION_HAND },
  { key: 'deck', location: LOCATION_DECK },
  { key: 'extra', location: LOCATION_EXTRA },
  { key: 'grave', location: LOCATION_GRAVE },
  { key: 'removed', location: LOCATION_REMOVED },
  { key: 'mzone', location: LOCATION_MZONE },
  { key: 'szone', location: LOCATION_SZONE },
  { key: 'pzone', location: LOCATION_PZONE }
]

let fieldId = 0
function makeCard(
  code: number,
  controller: 0 | 1,
  location: number,
  sequence: number,
  position: number
): FieldCard {
  return {
    instanceId: `card-${++fieldId}`,
    code,
    controller,
    owner: controller,
    location,
    sequence,
    position,
    overlayMaterials: []
  }
}

function buildPuzzle(masterRule: 2 | 5): DuelPuzzleState {
  const pendulums = cdbService.findCardsByType(0x1000000, 2).map((card) => card.id)
  const fieldCards =
    masterRule >= 4 && pendulums.length >= 2
      ? [
          makeCard(pendulums[0], 0, LOCATION_PZONE, 0, 0x5),
          makeCard(pendulums[1], 0, LOCATION_PZONE, 1, 0x5)
        ]
      : []
  return normalizeDuelState({
    version: '1.2.0',
    title: '盘面还原联测',
    hint: [],
    duelType: 'full',
    masterRule,
    players: [
      { lp: 8000, maxHand: 0, startHand: 0 },
      { lp: 8000, maxHand: 0, startHand: 0 }
    ],
    turnPlayer: 0 as 0 | 1,
    firstTurnAttack: false,
    cards: [
      makeCard(86120751, 0, LOCATION_HAND, 0, 0xa),
      makeCard(35167375, 0, LOCATION_HAND, 1, 0xa),
      makeCard(99659159, 0, LOCATION_HAND, 2, 0xa),
      makeCard(12307878, 0, LOCATION_EXTRA, 0, 0x8),
      makeCard(75286621, 0, LOCATION_EXTRA, 1, 0x8),
      makeCard(74063034, 0, LOCATION_EXTRA, 2, 0x8),
      makeCard(76714458, 0, LOCATION_DECK, 0, 0x8),
      makeCard(57294268, 0, LOCATION_DECK, 1, 0x8),
      makeCard(99999999, 0, LOCATION_DECK, 2, 0x8),
      makeCard(7902349, 0, LOCATION_DECK, 3, 0x8),
      makeCard(42956963, 0, LOCATION_GRAVE, 2, 0x5),
      makeCard(8124921, 0, LOCATION_GRAVE, 0, 0x5),
      makeCard(44519536, 0, LOCATION_GRAVE, 1, 0x5),
      makeCard(70903634, 0, LOCATION_REMOVED, 1, 0x5),
      makeCard(33396948, 0, LOCATION_REMOVED, 0, 0x5),
      makeCard(89631139, 0, LOCATION_MZONE, 1, 0x1),
      makeCard(53129443, 0, LOCATION_MZONE, 3, 0x4),
      makeCard(23434538, 0, LOCATION_SZONE, 1, 0xa),
      makeCard(12580477, 0, LOCATION_SZONE, 4, 0xa),
      makeCard(53129443, 0, 0x100, 0, 0x5),
      ...fieldCards,
      makeCard(69140098, 1, LOCATION_HAND, 0, 0xa),
      makeCard(14558127, 1, LOCATION_HAND, 1, 0xa),
      makeCard(33782437, 1, LOCATION_EXTRA, 0, 0x8),
      makeCard(21522601, 1, LOCATION_DECK, 0, 0x8),
      makeCard(8842266, 1, LOCATION_DECK, 1, 0x8),
      makeCard(7902349, 1, LOCATION_DECK, 2, 0x8),
      makeCard(70226289, 1, LOCATION_GRAVE, 0, 0x5),
      makeCard(83301414, 1, LOCATION_REMOVED, 0, 0x5),
      makeCard(4064256, 1, LOCATION_MZONE, 0, 0x1),
      makeCard(83764718, 1, LOCATION_SZONE, 2, 0xa)
    ],
    steps: [],
    duelists: [
      { id: 'duelist_0_0', team: 0, name: '我方', lp: 8000, isFirst: true, turnOrder: 1 },
      { id: 'duelist_1_0', team: 1, name: '对方', lp: 8000, turnOrder: 2 }
    ],
    matchConfig: { mode: '1v1', team0Count: 1, team1Count: 1, sharedLp: false },
    scenarios: {}
  })
}

type Duel = Awaited<ReturnType<Awaited<ReturnType<typeof getOcgcoreEngine>>['createDuelV2']>>

function snapshot(duel: Duel): Record<string, string> {
  const out: Record<string, string> = {}
  for (const player of [0, 1]) {
    for (const zone of QUERY_ZONES) {
      const cards = duel.queryFieldCard({
        player,
        location: zone.location,
        queryFlag: 0xefffff
      }).cards
      out[`${player}:${zone.key}`] = cards
        .filter((card) => (card.code ?? 0) > 0)
        .map(
          (card) =>
            `${card.code}@${card.sequence}/${card.position}${
              card.overlayCards?.length ? `+${card.overlayCards.join('+')}` : ''
            }`
        )
        .join(',')
    }
  }
  return out
}

async function editorSnapshot(
  puzzle: DuelPuzzleState,
  inspect?: (duel: OcgcoreDuel) => void
): Promise<Record<string, string>> {
  const engine = await getOcgcoreEngine()
  const state = createSessionState()
  state.ocgcore = engine
  state.duel = engine.createDuelV2(SEED)
  try {
    setupFromPuzzleState(state, puzzle)
    inspect?.(state.duel)
    return snapshot(state.duel)
  } finally {
    state.duel.endDuel()
  }
}

async function luaSnapshot(
  puzzle: DuelPuzzleState,
  forReplay = true,
  inspect?: (duel: OcgcoreDuel) => void
): Promise<Record<string, string>> {
  const engine = await getOcgcoreEngine()
  currentLua = generateLuaScript(puzzle, { forReplay })
  if (!luaReaderReady) {
    luaReaderReady = true
    engine.setScriptReader((scriptPath: string) =>
      scriptPath.replace(/^\.\//, '') === SCRIPT_NAME && currentLua
        ? new TextEncoder().encode(currentLua)
        : null
    )
  }
  const duel = engine.createDuelV2(SEED)
  const startLp = Number(puzzle.players[0].lp)
  try {
    duel.setRegistryValue('duel_mode', 'single')
    duel.setRegistryValue('start_lp', String(startLp))
    duel.setRegistryValue('start_hand', String(puzzle.players[0].startHand))
    duel.setRegistryValue('draw_count', '1')
    duel.setRegistryValue('player_type_0', '0')
    duel.setRegistryValue('player_type_1', '1')
    duel.setRegistryValue('player_name_0', '我方')
    duel.setRegistryValue('player_name_1', '对方')
    duel.setPlayerInfo({ player: 0, lp: startLp, startHand: 0, drawCount: 1 })
    duel.setPlayerInfo({ player: 1, lp: startLp, startHand: 0, drawCount: 1 })
    duel.preloadScript('./script/patches/entry.lua')
    duel.preloadScript('./script/special.lua')
    duel.preloadScript('./script/init.lua')
    duel.preloadScript(`./${SCRIPT_NAME}`)
    duel.startDuel(buildDuelFlag(puzzle.masterRule, puzzle.firstTurnAttack, false))
    inspect?.(duel)
    return snapshot(duel)
  } finally {
    duel.endDuel()
  }
}

function assert(condition: boolean, message: string): void {
  if (!condition) throw new Error(`断言失败: ${message}`)
}

async function checkRule(masterRule: 2 | 5): Promise<void> {
  const puzzle = buildPuzzle(masterRule)
  const host = makeCard(84013237, 0, CardLocation.MZONE, 2, CardPosition.FACEUP_ATTACK)
  host.overlayMaterials = [89631139, 46986414, 89631139]
  const opponentHost = makeCard(84013237, 1, CardLocation.MZONE, 2, CardPosition.FACEDOWN_DEFENSE)
  opponentHost.owner = 0
  opponentHost.overlayMaterials = [46986414, 89631139]
  puzzle.cards.push(host, opponentHost)
  if (masterRule === 5) {
    const extraHost = makeCard(84013237, 0, CardLocation.MZONE, 5, CardPosition.FACEUP_DEFENSE)
    extraHost.overlayMaterials = [46986414]
    puzzle.cards.push(extraHost)
  }
  const editor = await editorSnapshot(puzzle)
  const lua = await luaSnapshot(puzzle)
  assert(
    editor['0:mzone'].includes('84013237@2/1+89631139+46986414+89631139'),
    `MR${masterRule} 编辑器启动丢失超量素材: ${editor['0:mzone']}`
  )
  assert(
    lua['0:mzone'].includes('84013237@2/1+89631139+46986414+89631139'),
    `MR${masterRule} 游戏脚本丢失超量素材: ${lua['0:mzone']}`
  )
  assert(
    editor['1:mzone'].includes('84013237@2/8+46986414+89631139'),
    `MR${masterRule} 对方盖放宿主的素材异常: ${editor['1:mzone']}`
  )
  if (masterRule === 5) {
    assert(
      editor['0:mzone'].includes('84013237@5/4+46986414'),
      `MR5 额外怪兽区素材异常: ${editor['0:mzone']}`
    )
  }
  const game = await luaSnapshot(puzzle, false)
  const parsed = parseLuaScript(currentLua)
  for (const card of puzzle.cards.filter((card) => card.overlayMaterials.length > 0)) {
    const imported = parsed.cards.find(
      (candidate) =>
        candidate.controller === card.controller &&
        candidate.location === card.location &&
        candidate.sequence === card.sequence
    )
    assert(
      imported?.overlayMaterials.join(',') === card.overlayMaterials.join(','),
      `MR${masterRule} Lua 导入素材异常: ${card.instanceId}`
    )
  }
  for (const key of Object.keys(editor)) {
    assert(
      editor[key] === lua[key],
      `MR${masterRule} ${key} 盘面不一致\n  编辑器: ${editor[key]}\n  回放脚本: ${lua[key]}`
    )
    assert(editor[key] === game[key], `MR${masterRule} ${key} 游戏测试脚本盘面不一致`)
  }
  assert(editor['0:extra'].startsWith('74063034@0'), `MR${masterRule} 额外卡组顺序异常`)
  assert(
    editor['0:grave'].startsWith('8124921@0/5,44519536@1/5'),
    `MR${masterRule} 墓地顺序异常: ${editor['0:grave']}`
  )
  console.log(`MR${masterRule}: hand=${editor['0:hand']}`)
  console.log(`MR${masterRule}: deck=${editor['0:deck']}`)
  console.log(`MR${masterRule}: extra=${editor['0:extra']}`)
  console.log(`MR${masterRule}: grave=${editor['0:grave']}`)
  console.log(`MR${masterRule}: removed=${editor['0:removed']}`)
  console.log(`MR${masterRule}: mzone=${editor['0:mzone']}`)
  console.log(`MR${masterRule}: szone=${editor['0:szone']}`)
  console.log(`MR${masterRule}: pzone=${editor['0:pzone']}`)
}

async function checkTag(): Promise<void> {
  const puzzle = buildPuzzle(5)
  puzzle.cards = puzzle.cards.filter((card) => card.location !== CardLocation.HAND)
  puzzle.duelists = createStandardTagDuelists()
  puzzle.matchConfig = {
    mode: 'tag',
    team0Count: 2,
    team1Count: 2,
    tagFormat: 'standard',
    sharedLp: true
  }
  const host = makeCard(84013237, 1, CardLocation.MZONE, 2, CardPosition.FACEUP_ATTACK)
  host.overlayMaterials = [89631139, 46986414]
  puzzle.cards.push(host)
  const editor = await editorSnapshot(puzzle)
  const lua = await luaSnapshot(puzzle, false)
  assert(
    editor['1:mzone'].includes('84013237@2/1+89631139+46986414'),
    `双打启动丢失素材: ${editor['1:mzone']}`
  )
  assert(editor['1:mzone'] === lua['1:mzone'], '双打游戏测试脚本素材不一致')
}

async function checkDetach(): Promise<void> {
  const puzzle = buildPuzzle(5)
  const host = makeCard(34086406, 0, CardLocation.MZONE, 2, CardPosition.FACEUP_ATTACK)
  host.overlayMaterials = [89631139, 46986414, 89631139]
  puzzle.cards = [
    ...puzzle.cards.filter(
      (card) => card.location === CardLocation.DECK && cdbService.getCardById(card.code)
    ),
    host
  ]
  const session = new DuelSession()
  const start = await session.startDuel({ puzzleState: puzzle, seed: SEED })
  const totalCards = (): number =>
    session
      .getBoardState()
      .allCards.reduce((total, card) => total + 1 + card.overlayMaterials.length, 0)
  const total = totalCards()
  const settle = (): void => {
    for (let count = 0; count < 40; count++) {
      const request = session.getPendingRequest()
      assert(Boolean(request), '取除素材测试应有待答询问')
      if (request!.data.kind === 'idle') return
      const result = session.submitAnswer(autoAnswer(request!))
      assert(!result.retry, '引擎不应拒绝取除素材测试的回答')
    }
    throw new Error('取除素材测试无法推进到主要阶段')
  }
  settle()
  const request = session.getPendingRequest()!
  if (request.data.kind !== 'idle') throw new Error('应处于主要阶段')
  const activation = request.data.activatable.find(
    (card) =>
      card.controller === host.controller &&
      card.location === host.location &&
      card.sequence === host.sequence
  )
  assert(Boolean(activation), '布景素材必须可用于发动取除素材的效果')
  const activated = session.submitAnswer({ kind: 'idle', cmd: 'ACTIVATE', card: activation! })
  assert(!activated.retry, '引擎应接受发动效果')
  settle()
  assert(
    session.getBoardState().players[0].mzone[2]?.overlayMaterials.length === 2,
    '应取除一张素材'
  )
  assert(
    session.getBoardState().players[0].graveyard.some((card) => card.code === 89631139),
    '取除的素材应实际进入墓地'
  )
  assert(totalCards() === total, '取除素材前后总卡数必须守恒')
  const doc = session.exportSessionDoc()
  await session.importSessionDoc(doc)
  assert(
    session.getBoardState().players[0].mzone[2]?.overlayMaterials.length === 2,
    '恢复会话应保留剩余素材'
  )
  await session.jumpToStep(start.initialNode.id)
  assert(
    session.getBoardState().players[0].mzone[2]?.overlayMaterials.join(',') ===
      host.overlayMaterials.join(','),
    '回退到开局应还原完整素材及顺序'
  )
  session.exitReplay()
}

async function checkMonsterControl(): Promise<void> {
  const puzzle = buildPuzzle(5)
  puzzle.duelType = 'puzzle'
  const gameciel = makeCard(55063751, 1, LOCATION_MZONE, 1, CardPosition.FACEUP_ATTACK)
  gameciel.owner = 0
  const magician = makeCard(46986414, 0, LOCATION_MZONE, 2, CardPosition.FACEDOWN_DEFENSE)
  magician.owner = 1
  const darkHole = makeCard(53129443, 0, LOCATION_HAND, 0, CardPosition.FACEDOWN)
  puzzle.cards = [
    ...puzzle.cards.filter((card) => card.location === LOCATION_DECK),
    gameciel,
    magician,
    darkHole
  ]
  function play(duel: OcgcoreDuel): void {
    let activated = false
    for (let i = 0; i < 300 && !duel.ended; i++) {
      for (const msg of duel.process().messages ?? []) {
        const request = routeRequest(msg, { id: String(i), seq: i })
        if (!request) continue
        if (request.data.kind !== 'idle') {
          duel.setResponse(encodeAnswer(msg, autoAnswer(request)))
          continue
        }
        for (const monster of [gameciel, magician]) {
          const player = activated ? monster.owner : monster.controller
          const location = activated ? LOCATION_GRAVE : LOCATION_MZONE
          const cards = duel.queryFieldCard({ player, location, queryFlag: 0xefffff }).cards
          const found = cards.find((card) => card.code === monster.code)
          assert(found?.owner === monster.owner, `${monster.code} 控制方或送墓归属错误`)
          if (!activated) {
            assert(found?.sequence === monster.sequence, `${monster.code} 的开局位置错误`)
          }
        }
        if (activated) return
        const spell = request.data.activatable.find((card) => card.code === darkHole.code)
        if (!spell) throw new Error('应能发动黑洞')
        duel.setResponse(encodeAnswer(msg, { kind: 'idle', cmd: 'ACTIVATE', card: spell }))
        activated = true
      }
    }
    throw new Error('控制权测试未完成')
  }
  await luaSnapshot(puzzle, false, play)
  await luaSnapshot(puzzle, true, play)
  await editorSnapshot(puzzle, play)
}

async function main(): Promise<void> {
  await cdbService.ready()
  await checkRule(2)
  await checkRule(5)
  await checkTag()
  await checkMonsterControl()
  await checkDetach()
  console.log('[lua-placement-smoke] OK')
  process.exit(0)
}

main().catch((err) => {
  console.error('[lua-placement-smoke] FAILED:', err)
  process.exit(1)
})
