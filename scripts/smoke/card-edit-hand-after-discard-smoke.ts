/**
 * 天使的施舍抽牌弃牌后替换剩余手牌占位卡：
 * 1. 用「天使的施舍」抽 3 张，丢弃 1 张占位卡和 1 张非占位卡
 * 2. 替换手牌里另一张没被丢弃的占位卡
 * 3. 新卡必须留在手牌，不能被历史丢弃应答带进墓地
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
import { autoAnswer } from './autoAnswer'
import { settleToIdle } from './settleToIdle'

const GRACEFUL_CHARITY = 79571449
const REPLACED_CODE = 36361633
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
    makeCard(GRACEFUL_CHARITY, 0, CardLocation.HAND, 4),
    ...Array.from({ length: 6 }, (_, index) =>
      makeCard(PLACEHOLDER_CARD_CODE, 0, CardLocation.DECK, index)
    ),
    makeCard(PLACEHOLDER_CARD_CODE, 1, CardLocation.HAND, 0),
    makeCard(PLACEHOLDER_CARD_CODE, 1, CardLocation.DECK, 0)
  ]
  const duelists: Duelist[] = [
    { id: 'duelist_0_0', team: 0, name: '我方', lp: 8000, isFirst: true, turnOrder: 1 },
    { id: 'duelist_1_0', team: 1, name: '对方', lp: 8000, isFirst: false, turnOrder: 2 }
  ]
  return normalizeDuelState({
    version: '1.2.0',
    title: '弃牌后替换手牌占位卡联测',
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

function submitAuto(request: EngineRequest): void {
  const res = duelSession.submitAnswer(autoAnswer(request))
  if (res.retry) throw new Error('引擎拒绝了自动回答')
}

async function activateCharityAndDiscard(): Promise<void> {
  const charity = duelSession
    .getBoardState()
    .players[0].hand.find((card) => card.code === GRACEFUL_CHARITY)
  assert(Boolean(charity), '手牌应有天使的施舍')
  duelSession.submitAnswer({ kind: 'idle', cmd: 'ACTIVATE', card: charity as never })

  let discarded = false
  for (let guard = 0; guard < 40; guard++) {
    const pending = duelSession.getPendingRequest()
    assert(Boolean(pending), '施舍结算中断')
    if (pending!.kind === 'idle') return
    if (
      !discarded &&
      pending!.kind === 'card' &&
      pending!.data.kind === 'card' &&
      !pending!.data.cancelable
    ) {
      const data = pending!.data
      const placeholder = data.cards.find((card) => card.code === PLACEHOLDER_CARD_CODE)
      const other = data.cards.find((card) => card.code !== PLACEHOLDER_CARD_CODE)
      assert(Boolean(placeholder), '丢弃候选中应有占位卡')
      assert(Boolean(other), '丢弃候选中应有非占位卡')
      duelSession.submitAnswer({ kind: 'card', cards: [placeholder!, other!] })
      discarded = true
      continue
    }
    submitAuto(pending!)
  }
  throw new Error('施舍结算未能推进到 idle')
}

async function main(): Promise<void> {
  await cdbService.ready()
  await duelSession.startDuel({ puzzleState: buildPuzzle() })
  await settleToIdle()

  await activateCharityAndDiscard()
  await settleToIdle()

  const before = duelSession.getBoardState()
  const graveBefore = before.players[0].graveyard.length
  const handBefore = before.players[0].hand.length
  const remaining = before.players[0].hand
    .filter((card) => card.code === PLACEHOLDER_CARD_CODE)
    .sort((left, right) => left.sequence - right.sequence)
  assert(remaining.length >= 2, `弃牌后手牌应还剩多张占位卡，实际 ${remaining.length}`)
  const target = remaining[remaining.length - 1]

  const res = await duelSession.replaceCard(refOf(target), REPLACED_CODE)
  assert(!res.error, `替换剩余手牌占位卡失败: ${res.error ?? ''}`)
  assert(!res.conflict, '不应要求回退确认')
  assert(!res.warning, `替换不应产生警告: ${res.warning ?? ''}`)

  const after = res.boardState!
  const replaced = after.players[0].hand.find((card) => card.code === REPLACED_CODE)
  assert(Boolean(replaced), '新卡应留在手牌')
  assert(replaced!.sequence === target.sequence, '新卡应落在原手牌位置')
  assert(
    !after.players[0].graveyard.some((card) => card.code === REPLACED_CODE),
    '新卡不应被历史丢弃应答带进墓地'
  )
  assert(after.players[0].hand.length === handBefore, '替换后手牌数量不变')
  assert(after.players[0].graveyard.length === graveBefore, '替换后墓地数量不变')

  const replacedName = cdbService.getCardById(REPLACED_CODE)?.name
  assert(Boolean(replacedName), '替换目标卡应有卡名')
  assert(
    !duelSession.getTimeline().some((node) => node.title.includes(replacedName!)),
    '历史步骤不应把新卡记录成被丢弃的卡'
  )

  console.log('[card-edit-hand-after-discard-smoke] ALL CHECKS PASSED')
  process.exit(0)
}

main().catch((err) => {
  console.error('[card-edit-hand-after-discard-smoke] FAILED:', err)
  process.exit(1)
})
