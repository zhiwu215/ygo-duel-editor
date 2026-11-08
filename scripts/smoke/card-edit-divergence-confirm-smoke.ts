/**
 * 卡片编辑分歧确认冒烟：
 * 1. 把手牌占位卡盖放到场上
 * 2. 把这张盖放占位卡替换成不能盖放的怪兽卡，重演会在盖放处对不齐
 * 3. 未确认时必须原样回滚并返回分歧信息；确认后才回退到分歧点并丢弃后续步骤
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
  type FieldCard
} from '@shared/index'
import { cdbService } from './cdb-shim'
import { settleToIdle } from './settleToIdle'

const MONSTER_CODE = 89631139

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
    title: '卡片编辑分歧确认联测',
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

async function setHandPlaceholder(sequence: number): Promise<void> {
  const pending = duelSession.getPendingRequest()
  if (pending?.data.kind !== 'idle') throw new Error('当前请求不是 idle')
  const target = pending.data.ssetable.find(
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
  const target = board.players[0].szone.find(
    (card): card is EngineCard => card !== null && card.code === PLACEHOLDER_CARD_CODE
  )
  assert(Boolean(target), '场上应有盖放的占位卡')
  const timelineBefore = duelSession.getTimeline().length
  const graveBefore = board.players[0].graveyard.length

  const rejected = await duelSession.replaceCard(refOf(target!), MONSTER_CODE)
  assert(Boolean(rejected.conflict), '重演无法对齐时应返回分歧信息')
  assert(!rejected.error, `未确认时不应报错: ${rejected.error ?? ''}`)
  assert(!rejected.editedCard, '未确认时应回滚编辑')

  const afterReject = duelSession.getBoardState()
  assert(
    afterReject.players[0].szone.some(
      (card) => card !== null && card.code === PLACEHOLDER_CARD_CODE
    ),
    '未确认时盖放占位卡应保持不变'
  )
  assert(!afterReject.allCards.some((card) => card.code === MONSTER_CODE), '未确认时不应出现新卡')
  assert(afterReject.players[0].graveyard.length === graveBefore, '未确认时墓地应保持不变')
  assert(duelSession.getTimeline().length === timelineBefore, '未确认时不应丢弃任何步骤')
  assert(duelSession.getPendingRequest() !== null, '未确认时引擎应恢复到可继续的状态')
  console.log(
    `[card-edit-conflict] 分歧确认: 第 ${rejected.conflict!.opIndex + 1} 条操作, 会丢弃 ${rejected.conflict!.discardedSteps} 步`
  )

  const accepted = await duelSession.replaceCard(refOf(target!), MONSTER_CODE, true)
  assert(!accepted.conflict, '确认后不应再要求确认')
  assert(Boolean(accepted.warning?.includes('已回退')), '确认后应提示已回退')
  assert(duelSession.getTimeline().length < timelineBefore, '确认后应只保留到分歧点之前的步骤')
  assert(
    accepted.boardState!.players[0].hand.some((card) => card.code === MONSTER_CODE),
    '确认后新卡应留在分歧点的位置'
  )

  console.log('[card-edit-divergence-confirm-smoke] ALL CHECKS PASSED')
  process.exit(0)
}

main().catch((err) => {
  console.error('[card-edit-divergence-confirm-smoke] FAILED:', err)
  process.exit(1)
})
