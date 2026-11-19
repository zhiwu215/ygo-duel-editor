import assert from 'node:assert/strict'
import { CardLocation, CardPosition, generateLuaScript, normalizeDuelState } from '@shared/index'
import type { DuelPuzzleState, FieldCard } from '@shared/index'
import { createDuelFromYrp, type OcgcoreWrapper } from 'koishipro-core.js'
import {
  OcgcoreCommonConstants,
  YGOProMsgDraw,
  YGOProMsgNewTurn,
  YGOProMsgReloadField,
  YGOProMsgStart
} from 'ygopro-msg-encode'
import { YGOProYrp3d } from 'ygopro-yrp3d-encode'
import { DuelSession } from '../../src/main/services/duel/duel-session'
import { buildReplayBootstrapPayloads } from '../../src/main/services/duel/replay-bootstrap'
import { buildReplayOpening } from '../../src/main/services/duel/replay-opening'
import { verifyYrpReplay } from '../../src/main/services/duel/replay-verifier'
import { applyReplayViewToPayloads } from '../../src/main/services/duel/replay-view'
import { buildYrp3dMessages } from '../../src/main/services/yrp3dMessages'
import { buildDuelFlag, buildYrpSingleFile } from '../../src/main/services/yrpWriter'
import { autoAnswer } from './autoAnswer'
import { getOcgcoreEngine } from './ocgcore-engine-shim'

const SEED = [12345, 54321, 111, 222, 333, 444, 555, 666]
const HANDS = [
  [89631139, 46986414, 89631139, 40640057, 12580477],
  [74677422, 14558127, 72302403, 53129443, 23434538]
] as const
const DECKS = [
  [70342110, 83764718, 6368038],
  [66518841, 97997309, 26082229]
] as const

function makePile(player: 0 | 1, location: number, codes: readonly number[]): FieldCard[] {
  return codes.map((code, sequence) => ({
    code,
    instanceId: `${player}:${location}:${sequence}`,
    controller: player,
    owner: player,
    location,
    sequence,
    position:
      location === CardLocation.HAND ? CardPosition.FACEDOWN : CardPosition.FACEDOWN_DEFENSE,
    overlayMaterials: []
  }))
}

function buildPuzzle(hands: readonly (readonly number[])[], masterRule: 2 | 5): DuelPuzzleState {
  return normalizeDuelState({
    version: '1.2.0',
    title: '开局抽牌回放',
    hint: [],
    duelType: 'full',
    masterRule,
    players: [
      { lp: 8000, maxHand: 5, startHand: 0 },
      { lp: 8000, maxHand: 5, startHand: 0 }
    ],
    turnPlayer: 0,
    firstTurnAttack: false,
    cards: ([0, 1] as const).flatMap((player) => [
      ...makePile(player, CardLocation.HAND, hands[player]),
      ...makePile(player, CardLocation.DECK, DECKS[player])
    ]),
    steps: []
  })
}

async function checkOpening(
  engine: OcgcoreWrapper,
  puzzle: DuelPuzzleState,
  hands: readonly (readonly number[])[]
): Promise<void> {
  const session = new DuelSession()
  await session.startDuel({ seed: SEED, puzzleState: puzzle, manualRandom: false })
  try {
    for (let index = 0; index < 3; index++) {
      const request = session.getPendingRequest()
      assert(request)
      assert(!session.submitAnswer(autoAnswer(request)).retry)
    }
    const { messages, responses } = await session.recordMessageStream()
    assert(responses.length > 0)

    const opening = buildReplayOpening(puzzle)
    const luaScript = new TextEncoder().encode(
      generateLuaScript(opening.state, { forReplay: true })
    )
    const scriptFile = `./single/replay-opening-smoke-${puzzle.masterRule}.lua`
    engine.setScriptReader((path) => (path === scriptFile ? luaScript : null))
    const yrp = buildYrpSingleFile({
      names: ['P0', 'P1'],
      seed: SEED,
      startLp: 8000,
      startHand: opening.state.players[0].startHand,
      drawCount: 1,
      opt: buildDuelFlag(puzzle.masterRule, false, false),
      scriptFile,
      responses
    })
    const { duel } = createDuelFromYrp(engine, yrp)
    try {
      const beforeTurn: number[][] = [[], []]
      for (const { message } of duel.advance()) {
        if (message instanceof YGOProMsgReloadField) {
          assert.deepEqual(
            message.players.map((player) => player.handCount),
            [0, 0]
          )
        }
        if (message instanceof YGOProMsgDraw) {
          beforeTurn[message.player].push(...message.cards.map((code) => code & 0x7fffffff))
        }
        if (message instanceof YGOProMsgNewTurn) break
      }
      assert.deepEqual(beforeTurn, hands)
      for (const player of [0, 1] as const) {
        const deck = duel.queryFieldCard({
          player,
          location: CardLocation.DECK,
          queryFlag: OcgcoreCommonConstants.QUERY_CODE
        }).cards
        assert.deepEqual(deck.map((card) => card.code).reverse(), [...DECKS[player]])
      }
    } finally {
      duel.endDuel()
    }
    assert.deepEqual(verifyYrpReplay(engine, yrp), { status: 'verified', step: responses.length })

    for (const [view, bottomSeat] of [
      ['player', 0],
      ['player', 1],
      ['observer', 0]
    ] as const) {
      const bootstrap = applyReplayViewToPayloads(
        buildReplayBootstrapPayloads(opening, bottomSeat),
        view,
        bottomSeat
      )
      const yrp3d = new YGOProYrp3d()
      yrp3d.messages.push(
        ...buildYrp3dMessages(applyReplayViewToPayloads(messages, view, bottomSeat), bootstrap)
      )
      const decoded = new YGOProYrp3d().fromYrp3d(yrp3d.toYrp3d()).messages
      const start = decoded[0]
      assert(start instanceof YGOProMsgStart)
      const deckCounts = hands.map((hand, player) => hand.length + DECKS[player].length)
      assert.deepEqual([start.player0.deckCount, start.player1.deckCount], deckCounts)
      const reload = decoded.find((message) => message instanceof YGOProMsgReloadField)
      if (puzzle.masterRule === 2) {
        assert(reload instanceof YGOProMsgReloadField)
        assert.deepEqual(
          reload.players.map((player) => player.handCount),
          [0, 0]
        )
        assert.deepEqual(
          reload.players.map((player) => player.deckCount),
          deckCounts
        )
      } else {
        assert.equal(reload, undefined)
      }
      const firstTurn = decoded.findIndex((message) => message instanceof YGOProMsgNewTurn)
      assert(firstTurn > 0)
      const draws = decoded
        .slice(0, firstTurn)
        .filter((message) => message instanceof YGOProMsgDraw)
      assert.deepEqual(
        draws.map((draw) => [draw.player, draw.cards]),
        hands.flatMap((hand, player) =>
          hand.length
            ? [[player, view === 'player' && player === bottomSeat ? [...hand] : hand.map(() => 0)]]
            : []
        )
      )
      const viewed = applyReplayViewToPayloads(messages, view, bottomSeat)
      const turnIndex = viewed.findIndex((message) => message[0] === YGOProMsgNewTurn.identifier)
      assert.deepEqual(
        decoded
          .slice(firstTurn)
          .filter((message) => message instanceof YGOProMsgDraw)
          .map((message) => message.toPayload()),
        viewed.slice(turnIndex).filter((message) => message[0] === YGOProMsgDraw.identifier)
      )
    }
  } finally {
    session.exitReplay()
  }
}

async function main(): Promise<void> {
  const engine: OcgcoreWrapper = await getOcgcoreEngine()
  await checkOpening(engine, buildPuzzle(HANDS, 5), HANDS)
  const asymmetricHands = [[], HANDS[1].slice(0, 2)]
  const puzzle = buildPuzzle(asymmetricHands, 2)
  puzzle.cards.push(...makePile(0, CardLocation.GRAVE, [44095762]))
  await checkOpening(engine, puzzle, asymmetricHands)
  console.log('[replay-opening-smoke] YRP 与 YRP3D 开局抽牌、牌序、视角和后续回合通过')
}

main().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
