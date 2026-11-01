/**
 * 替换卡片的历史应答重映射冒烟：
 * 1. 先用「天使的施舍」抽牌并丢弃两张占位卡（记录选卡应答）
 * 2. 再把手牌里的占位卡替换成真实卡
 * 3. 重演后新卡必须留在手牌，不能因为历史丢弃应答被重映射而进入墓地
 */
import { duelSession } from '../../src/main/services/duel/duel-session'
import {
  CardLocation,
  CardPosition,
  PLACEHOLDER_CARD_CODE,
  normalizeDuelState,
  type Answer,
  type Duelist,
  type EngineCard,
  type EngineCardRef,
  type EngineRequest,
  type FieldCard
} from '@shared/index'
import { cdbService } from './cdb-shim'

const GRACEFUL_CHARITY = 79571449
const REPLACED_CODE = 43422537
const GARGOYLE = 24611934

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
    overlayMaterials: [],
    duelistId: controller === 0 ? 'duelist_0_0' : 'duelist_1_0'
  }
}

function buildPuzzle(): ReturnType<typeof normalizeDuelState> {
  const cards: FieldCard[] = [
    makeCard(PLACEHOLDER_CARD_CODE, 0, CardLocation.HAND, 0),
    makeCard(PLACEHOLDER_CARD_CODE, 0, CardLocation.HAND, 1),
    makeCard(PLACEHOLDER_CARD_CODE, 0, CardLocation.HAND, 2),
    makeCard(GARGOYLE, 0, CardLocation.HAND, 3),
    makeCard(PLACEHOLDER_CARD_CODE, 0, CardLocation.HAND, 4),
    makeCard(GRACEFUL_CHARITY, 0, CardLocation.HAND, 5),
    ...Array.from({ length: 6 }, (_, index) =>
      makeCard(PLACEHOLDER_CARD_CODE, 0, CardLocation.DECK, index)
    ),
    makeCard(PLACEHOLDER_CARD_CODE, 1, CardLocation.HAND, 0),
    makeCard(PLACEHOLDER_CARD_CODE, 1, CardLocation.DECK, 0)
  ]
  const duelists: Duelist[] = [
    { id: 'duelist_0_0', team: 0, name: '我方', lp: 8000, isFirst: true, turnOrder: 1 },
    { id: 'duelist_1_0', team: 1, name: '对方', lp: 8000, turnOrder: 2 }
  ]
  return normalizeDuelState({
    version: '1.2.0',
    title: '替换应答重映射联测',
    hint: '',
    duelType: 'full',
    masterRule: 5,
    players: [
      { lp: 8000, maxHand: 0, startHand: 0 },
      { lp: 8000, maxHand: 0, startHand: 0 }
    ],
    turnPlayer: 0 as 0 | 1,
    firstTurnAttack: true,
    cards,
    steps: [],
    duelists,
    matchConfig: { mode: '1v1', team0Count: 1, team1Count: 1, sharedLp: false },
    scenarios: {}
  })
}

function assert(condition: boolean, message: string): void {
  if (!condition) throw new Error(`断言失败: ${message}`)
}

function refOf(card: EngineCard): EngineCardRef {
  return {
    controller: card.controller,
    location: card.location,
    sequence: card.sequence,
    instanceId: card.instanceId,
    duelistId: card.duelistId
  }
}

function answerFor(request: EngineRequest): Answer {
  const data = request.data
  switch (data.kind) {
    case 'rps':
      return { kind: 'rps', hand: 'paper' }
    case 'idle':
      return { kind: 'idle', cmd: 'TO_EP' }
    case 'chain':
      return { kind: 'chain', card: null }
    case 'yesno':
      return { kind: 'yesno', yes: false }
    case 'place':
      return { kind: 'place', places: data.places.slice(0, Math.max(1, data.count)) }
    case 'card': {
      if (!data.cancelable) {
        const picks = [...data.cards]
          .filter((card) => card.location === CardLocation.HAND && card.controller === 0)
          .sort((left, right) => left.sequence - right.sequence)
          .slice(0, Math.max(1, data.min))
        return { kind: 'card', cards: picks }
      }
      return { kind: 'card', cards: null }
    }
    default:
      throw new Error(`autoAnswer 未覆盖 kind=${data.kind}`)
  }
}

async function settleToIdle(): Promise<void> {
  for (let guard = 0; guard < 40; guard++) {
    const pending = duelSession.getPendingRequest()
    if (!pending) return
    if (pending.kind === 'idle') return
    duelSession.submitAnswer(answerFor(pending))
  }
}

function fmtCodes(cards: EngineCard[]): string {
  return cards.map((card) => card.code).join(',')
}

async function main(): Promise<void> {
  await cdbService.ready()
  await duelSession.startDuel({ puzzleState: buildPuzzle() })
  await settleToIdle()

  const before = duelSession.getBoardState()
  const charity = before.players[0].hand.find((card) => card.code === GRACEFUL_CHARITY)
  assert(Boolean(charity), '手牌应有天使的施舍')
  duelSession.submitAnswer({ kind: 'idle', cmd: 'ACTIVATE', card: charity as never })
  await settleToIdle()

  const afterDiscard = duelSession.getBoardState()
  assert(afterDiscard.players[0].graveyard.length === 3, '丢弃后墓地应有 3 张卡')
  assert(
    !afterDiscard.players[0].graveyard.some((card) => card.code === REPLACED_CODE),
    '丢弃后墓地不应出现替换目标卡'
  )

  const target = afterDiscard.players[0].hand
    .filter((card) => card.code === PLACEHOLDER_CARD_CODE)
    .sort((left, right) => left.sequence - right.sequence)[0]
  assert(Boolean(target), '手牌应剩占位卡')
  const res = await duelSession.replaceCard(refOf(target!), REPLACED_CODE)
  assert(!res.error, `替换占位卡失败: ${res.error ?? ''}`)
  assert(!res.warning, `替换不应产生警告: ${res.warning ?? ''}`)

  const board = res.boardState!
  assert(
    board.players[0].hand.some((card) => card.code === REPLACED_CODE),
    `替换后新卡应留在手牌，实际手牌: ${fmtCodes(board.players[0].hand)}`
  )
  assert(
    !board.players[0].graveyard.some((card) => card.code === REPLACED_CODE),
    `替换后新卡不应进入墓地，实际墓地: ${fmtCodes(board.players[0].graveyard)}`
  )
  assert(
    board.players[0].hand.filter((card) => card.code === REPLACED_CODE).length === 1,
    '手牌里应有 1 张新卡'
  )
  assert(board.players[0].hand.length === afterDiscard.players[0].hand.length, '替换后手牌数量不变')

  console.log('[card-edit-answer-remap-smoke] ALL CHECKS PASSED')
  process.exit(0)
}

main().catch((err) => {
  console.error('[card-edit-answer-remap-smoke] FAILED:', err)
  process.exit(1)
})
