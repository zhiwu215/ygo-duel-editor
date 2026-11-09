/**
 * 自动重打选卡应答冒烟：
 * 1. 第二回合用手牌注入强欲之壶，再发动天使的施舍弃掉注入卡
 * 2. 自动重打把手牌注入并入初始手牌，手牌顺序与原局不同
 * 3. 重演历史应答时应按卡片身份重新对齐位置，而不是报 Card not found
 */
import assert from 'node:assert/strict'
import { DuelSession } from '../../src/main/services/duel/duel-session'
import {
  CardLocation,
  CardPosition,
  normalizeDuelState,
  type Answer,
  type EngineRequest,
  type FieldCard
} from '@shared/index'
import { cdbService } from './cdb-shim'
import { reconstructOpeningFromSession } from '../../src/renderer/src/stores/duelEngine/openingFromSession'
import { rebuildSessionWithoutInjections } from '../../src/renderer/src/stores/duelEngine/replayWithoutInjections'

const GRACEFUL_CHARITY = 79571449
const POT_OF_GREED = 55144522
const BLUE_EYES = 89631139
const DARK_MAGICIAN = 46986414
const DECK = [23434538, 14558127, 70342110, 66518841, 97997309]
const SEED = [11, 22, 33, 44, 55, 66, 77, 88]

let fieldId = 0

function makeCard(code: number, controller: 0 | 1, location: number, sequence: number): FieldCard {
  return {
    instanceId: `card-${++fieldId}`,
    code,
    controller,
    owner: controller,
    location,
    sequence,
    position:
      location === CardLocation.HAND ? CardPosition.FACEDOWN : CardPosition.FACEDOWN_DEFENSE,
    overlayMaterials: []
  }
}

function buildPuzzle(): ReturnType<typeof normalizeDuelState> {
  const cards: FieldCard[] = [
    makeCard(GRACEFUL_CHARITY, 0, CardLocation.HAND, 0),
    makeCard(BLUE_EYES, 0, CardLocation.HAND, 1),
    makeCard(DARK_MAGICIAN, 0, CardLocation.HAND, 2),
    ...DECK.map((code, index) => makeCard(code, 0, CardLocation.DECK, index)),
    ...DECK.map((code, index) => makeCard(code, 1, CardLocation.DECK, index))
  ]
  return normalizeDuelState({
    version: '1.2.0',
    title: '自动重打选卡应答',
    hint: '',
    duelType: 'full',
    masterRule: 5,
    players: [
      { lp: 8000, maxHand: 0, startHand: 0 },
      { lp: 8000, maxHand: 0, startHand: 0 }
    ],
    turnPlayer: 0 as 0 | 1,
    firstTurnAttack: false,
    cards,
    steps: [],
    duelists: [
      { id: 'duelist_0_0', team: 0, name: '我方', lp: 8000, isFirst: true, turnOrder: 1 },
      { id: 'duelist_1_0', team: 1, name: '对方', lp: 8000, turnOrder: 2 }
    ],
    matchConfig: { mode: '1v1', team0Count: 1, team1Count: 1, sharedLp: false },
    scenarios: {}
  })
}

function autoAnswer(request: EngineRequest): Answer {
  const data = request.data
  switch (data.kind) {
    case 'idle':
      return { kind: 'idle', cmd: 'TO_EP' }
    case 'battle':
      return { kind: 'battle', cmd: 'TO_EP' }
    case 'yesno':
      return { kind: 'yesno', yes: false }
    case 'chain':
      return { kind: 'chain', card: null }
    case 'card':
      return data.cancelable
        ? { kind: 'card', cards: null }
        : { kind: 'card', cards: data.cards.slice(0, Math.max(1, data.min)) }
    case 'place':
      return { kind: 'place', places: data.places.slice(0, Math.max(1, data.count)) }
    case 'disfield':
      return { kind: 'disfield', places: data.places.slice(0, Math.max(1, data.count)) }
    case 'position':
      return { kind: 'position', position: data.positions[0] }
    case 'option':
      return { kind: 'option', index: 0 }
    case 'tribute':
      return data.cancelable
        ? { kind: 'tribute', cards: null }
        : { kind: 'tribute', cards: data.cards.slice(0, Math.max(1, data.min)) }
    default:
      return { kind: 'chain', card: null }
  }
}

function settleToIdle(session: DuelSession, player: 0 | 1): void {
  for (let guard = 0; guard < 60; guard++) {
    const pending = session.getPendingRequest()
    if (!pending) throw new Error('对局已结束，未进入主要阶段')
    if (pending.data.kind === 'idle' && pending.player === player) return
    const res = session.submitAnswer(autoAnswer(pending))
    assert.equal(res.retry, false, '自动应答被引擎拒绝')
  }
  throw new Error(`未能推进到玩家 ${player} 的主要阶段`)
}

function handCodes(session: DuelSession): number[] {
  return session
    .getBoardState()
    .players[0].hand.map((card) => card.code)
    .sort((left, right) => left - right)
}

async function main(): Promise<void> {
  await cdbService.ready()

  const session = new DuelSession()
  await session.startDuel({ puzzleState: buildPuzzle(), seed: SEED })
  settleToIdle(session, 0)
  session.submitAnswer({ kind: 'idle', cmd: 'TO_EP' })
  settleToIdle(session, 1)
  session.submitAnswer({ kind: 'idle', cmd: 'TO_EP' })
  settleToIdle(session, 0)

  await session.inject({ op: 'add-card', player: 0, code: POT_OF_GREED, to: 'hand' })
  const idle = session.getPendingRequest()
  assert.ok(idle?.data.kind === 'idle', '注入后应处于我方主要阶段')
  const charity = idle.data.activatable.find((card) => card.code === GRACEFUL_CHARITY)
  assert.ok(charity, '手牌中应有天使的施舍')
  const activated = session.submitAnswer({ kind: 'idle', cmd: 'ACTIVATE', card: charity })
  assert.equal(activated.retry, false, '发动天使的施舍被拒绝')

  let discardRequest: EngineRequest | undefined
  for (let guard = 0; guard < 20; guard++) {
    const pending = session.getPendingRequest()
    if (!pending) break
    if (pending.data.kind === 'card' && pending.data.min >= 2) {
      discardRequest = pending
      break
    }
    const res = session.submitAnswer(autoAnswer(pending))
    assert.equal(res.retry, false, '结算天使的施舍时被引擎拒绝')
  }
  assert.ok(discardRequest?.data.kind === 'card', '应出现弃牌选择')
  const injected = discardRequest.data.cards.find((card) => card.code === POT_OF_GREED)
  assert.ok(injected, '弃牌候选中应有注入的强欲之壶')
  const other = discardRequest.data.cards.find((card) => card.code !== POT_OF_GREED)
  assert.ok(other, '弃牌候选中应有第二张卡')
  const discarded = session.submitAnswer({ kind: 'card', cards: [injected, other] })
  assert.equal(discarded.retry, false, '弃牌选择被拒绝')
  settleToIdle(session, 0)

  const sourceBoard = session.getBoardState()
  const sourceHand = handCodes(session)
  const doc = session.exportSessionDoc()

  const opening = reconstructOpeningFromSession(doc)
  assert.ok(opening, '应能重建初始场面')
  const rebuilt = rebuildSessionWithoutInjections(doc, opening)
  assert.ok(rebuilt, '应能重建无注入会话')
  assert.equal(
    rebuilt.doc.ops.some((op) => op.type === 'inject'),
    false,
    '重建后不应有注入操作'
  )

  const target = new DuelSession()
  const imported = await target.importSessionDoc(rebuilt.doc)

  assert.deepEqual(handCodes(target), sourceHand, '重打后的手牌应与原局一致')
  assert.equal(imported.boardState.players[0].deckCount, sourceBoard.players[0].deckCount)
  assert.equal(
    imported.boardState.players[0].graveyard.length,
    sourceBoard.players[0].graveyard.length
  )
  assert.equal(imported.boardState.players[0].lp, sourceBoard.players[0].lp)
  assert.equal(imported.boardState.turn, sourceBoard.turn)
  assert.ok(target.getAllTimelineResponses().length > 0, '重打后应有可导出的应答流')

  console.log('[auto-replay-card-answer] ALL PASSED')
  process.exit(0)
}

void main().catch((err) => {
  console.error('[auto-replay-card-answer] FAILED:', err)
  process.exit(1)
})
