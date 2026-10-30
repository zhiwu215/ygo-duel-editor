/**
 * 回放脚本盘面还原联测：
 * 生成给游戏的 single lua 必须与编辑器引擎的建卡顺序/序列完全一致，
 * 否则游戏侧还原出的开局盘面不同，录像应答会错位（表现为游戏回放中途 Error occurs）。
 */
import { DuelPuzzleState, FieldCard, generateLuaScript, normalizeDuelState } from '@shared/index'
import { _OcgcoreConstants } from 'koishipro-core.js'
import { createSessionState } from '../../src/main/services/duel/session-state'
import { setupFromPuzzleState } from '../../src/main/services/duel/session-setup'
import { buildDuelFlag } from '../../src/main/services/yrpWriter'
import { cdbService } from './cdb-shim'
import { getOcgcoreEngine } from './ocgcore-engine-shim'

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
    hint: '',
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

async function editorSnapshot(puzzle: DuelPuzzleState): Promise<Record<string, string>> {
  const engine = await getOcgcoreEngine()
  const state = createSessionState()
  state.ocgcore = engine
  state.duel = engine.createDuelV2(SEED)
  try {
    setupFromPuzzleState(state, puzzle)
    return snapshot(state.duel)
  } finally {
    state.duel.endDuel()
  }
}

async function luaSnapshot(puzzle: DuelPuzzleState): Promise<Record<string, string>> {
  const engine = await getOcgcoreEngine()
  currentLua = generateLuaScript(puzzle, { forReplay: true })
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
  const editor = await editorSnapshot(puzzle)
  const lua = await luaSnapshot(puzzle)
  for (const key of Object.keys(editor)) {
    assert(
      editor[key] === lua[key],
      `MR${masterRule} ${key} 盘面不一致\n  编辑器: ${editor[key]}\n  回放脚本: ${lua[key]}`
    )
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

async function main(): Promise<void> {
  await cdbService.ready()
  await checkRule(2)
  await checkRule(5)
  console.log('[lua-placement-smoke] OK')
  process.exit(0)
}

main().catch((err) => {
  console.error('[lua-placement-smoke] FAILED:', err)
  process.exit(1)
})
