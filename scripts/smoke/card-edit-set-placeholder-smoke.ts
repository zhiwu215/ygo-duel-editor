/**
 * 场上盖放占位卡的替换冒烟：
 * 1. 手牌有多张同码占位卡时，先用 SSET 盖放其中一张
 * 2. 把场上这张占位卡替换成真实陷阱卡
 * 3. 重演必须把历史上的 SSET 应答改到被替换的那张卡，不能改错其它占位卡
 */
import { duelSession } from '../../src/main/services/duel/duel-session'
import {
  CardLocation,
  CardPosition,
  PLACEHOLDER_CARD_CODE,
  normalizeDuelState,
  type Duelist,
  type EngineCard,
  type EngineCardRef,
  type EngineRequest,
  type FieldCard
} from '@shared/index'
import { cdbService } from './cdb-shim'
import { settleToIdle } from './settleToIdle'

const TRAP_CODE = 36361633

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
    ...Array.from({ length: 6 }, (_, index) =>
      makeCard(PLACEHOLDER_CARD_CODE, 0, CardLocation.DECK, index)
    ),
    makeCard(PLACEHOLDER_CARD_CODE, 1, CardLocation.DECK, 0)
  ]
  const duelists: Duelist[] = [
    { id: 'duelist_0_0', team: 0, name: '我方', lp: 8000, isFirst: true, turnOrder: 1 },
    { id: 'duelist_1_0', team: 1, name: '对方', lp: 8000, isFirst: false, turnOrder: 2 }
  ]
  return normalizeDuelState({
    version: '1.2.0',
    title: '盖放占位卡替换联测',
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

function idleOf(request: EngineRequest | null): Extract<EngineRequest['data'], { kind: 'idle' }> {
  if (request?.data.kind !== 'idle') throw new Error('当前请求不是 idle')
  return request.data
}

async function setHandPlaceholder(sequence: number): Promise<void> {
  const idle = idleOf(duelSession.getPendingRequest())
  const target = idle.ssetable.find(
    (card) => card.code === PLACEHOLDER_CARD_CODE && card.sequence === sequence
  )
  assert(Boolean(target), `手牌第 ${sequence} 张占位卡应可盖放`)
  const submitted = duelSession.submitAnswer({ kind: 'idle', cmd: 'SSET', card: target! })
  const place = submitted.pendingRequest?.data
  assert(place?.kind === 'place', '盖放后应询问放置区域')
  duelSession.submitAnswer({
    kind: 'place',
    places: place.places.slice(0, Math.max(1, place.count))
  })
  await settleToIdle()
}

async function main(): Promise<void> {
  await cdbService.ready()
  await duelSession.startDuel({ puzzleState: buildPuzzle() })
  await settleToIdle()

  await setHandPlaceholder(1)
  await setHandPlaceholder(1)

  const board = duelSession.getBoardState()
  const setCards = board.players[0].szone.filter(
    (card): card is EngineCard => card !== null && card.code === PLACEHOLDER_CARD_CODE
  )
  assert(setCards.length === 2, `场上应有 2 张盖放占位卡，实际 ${setCards.length}`)
  const target = setCards[0]
  console.log(`[card-edit-set] 替换场上第 ${target.sequence} 张盖放占位卡`)

  const result = await duelSession.replaceCard(refOf(target), TRAP_CODE)
  assert(!result.error, `替换失败: ${result.error ?? ''}`)
  assert(!result.warning, `替换不应产生警告: ${result.warning ?? ''}`)

  const after = result.boardState!
  const replaced = after.players[0].szone.find(
    (card) => card !== null && card.sequence === target.sequence
  )
  assert(replaced?.code === TRAP_CODE, `目标区域应是新陷阱卡，实际 ${replaced?.code ?? '空'}`)
  assert(
    after.players[0].szone.filter((card) => card !== null && card.code === PLACEHOLDER_CARD_CODE)
      .length === 1,
    '另一张盖放占位卡应保留'
  )
  assert(
    after.players[0].hand.filter((card) => card.code === PLACEHOLDER_CARD_CODE).length === 1,
    '未使用的占位卡应留在手牌'
  )
  console.log('[card-edit-set-placeholder-smoke] ALL CHECKS PASSED')
  process.exit(0)
}

main().catch((err) => {
  console.error('[card-edit-set-placeholder-smoke] FAILED:', err)
  process.exit(1)
})
