/**
 * 替换从卡组抽到后又被丢弃的占位卡（手牌还留着另一张同码占位卡）：
 * 1. 牌堆顶是占位卡，用「天使的施舍」抽 3 张并丢弃抽到的 2 张占位卡
 * 2. 依次替换墓地里被丢弃的这两张占位卡
 * 3. 新卡必须落在各自墓地原位置，不能跑回手牌
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
const REPLACED = 36361633
const SECOND_REPLACED = 89631139

let fieldId = 0

const DECK_PLACEHOLDER_IDS = new Set<string>()

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
  DECK_PLACEHOLDER_IDS.clear()
  const cards: FieldCard[] = [
    makeCard(GRACEFUL_CHARITY, 0, CardLocation.HAND, 0),
    makeCard(PLACEHOLDER_CARD_CODE, 0, CardLocation.HAND, 1),
    makeCard(PLACEHOLDER_CARD_CODE, 0, CardLocation.DECK, 0),
    makeCard(PLACEHOLDER_CARD_CODE, 0, CardLocation.DECK, 1),
    makeCard(23434538, 0, CardLocation.DECK, 2),
    makeCard(14558127, 0, CardLocation.DECK, 3),
    makeCard(70342110, 0, CardLocation.DECK, 4),
    ...Array.from({ length: 5 }, (_, index) => makeCard(97997309, 1, CardLocation.DECK, index))
  ]
  for (const card of cards) {
    if (
      card.controller === 0 &&
      card.location === CardLocation.DECK &&
      card.code === PLACEHOLDER_CARD_CODE
    ) {
      DECK_PLACEHOLDER_IDS.add(card.instanceId)
    }
  }
  const duelists: Duelist[] = [
    { id: 'duelist_0_0', team: 0, name: '我方', lp: 8000, isFirst: true, turnOrder: 1 },
    { id: 'duelist_1_0', team: 1, name: '对方', lp: 8000, isFirst: false, turnOrder: 2 }
  ]
  return normalizeDuelState({
    version: '1.2.0',
    title: '替换抽到后丢弃的占位卡联测',
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
    default:
      throw new Error(`answerFor 未覆盖 kind=${data.kind}`)
  }
}

async function settleToIdle(): Promise<void> {
  for (let guard = 0; guard < 80; guard++) {
    const pending = duelSession.getPendingRequest()
    if (!pending) return
    if (pending.kind === 'idle') return
    const res = duelSession.submitAnswer(answerFor(pending))
    if (res.retry) throw new Error('引擎拒绝了自动回答')
  }
  throw new Error('未能推进到 idle')
}

async function activateCharityAndDiscardPlaceholder(): Promise<void> {
  const charity = duelSession
    .getBoardState()
    .players[0].hand.find((card) => card.code === GRACEFUL_CHARITY)
  assert(Boolean(charity), '手牌应有天使的施舍')
  duelSession.submitAnswer({ kind: 'idle', cmd: 'ACTIVATE', card: charity as never })
  for (let guard = 0; guard < 40; guard++) {
    const pending = duelSession.getPendingRequest()
    assert(Boolean(pending), '施舍结算中断')
    if (pending!.kind === 'idle') return
    if (pending!.kind === 'card' && pending!.data.kind === 'card' && !pending!.data.cancelable) {
      const data = pending!.data
      const hand = duelSession.getBoardState().players[0].hand
      const drawnPlaceholders = hand.filter(
        (card) => card.code === PLACEHOLDER_CARD_CODE && DECK_PLACEHOLDER_IDS.has(card.instanceId)
      )
      const picks = drawnPlaceholders.map((card) => {
        const target = data.cards.find(
          (item) => item.code === card.code && item.sequence === card.sequence
        )
        assert(Boolean(target), '抽到的占位卡应在丢弃候选中')
        return target!
      })
      assert(picks.length >= data.min, '丢弃候选中应有足够的抽到的占位卡')
      duelSession.submitAnswer({ kind: 'card', cards: picks.slice(0, data.min) })
      continue
    }
    duelSession.submitAnswer(answerFor(pending!))
  }
  throw new Error('施舍结算未能推进到 idle')
}

async function main(): Promise<void> {
  await cdbService.ready()
  await duelSession.startDuel({ puzzleState: buildPuzzle(), seed: [1, 2, 3, 4, 5, 6, 7, 8] })
  await settleToIdle()
  await activateCharityAndDiscardPlaceholder()
  await settleToIdle()

  const board = duelSession.getBoardState()
  const gravePlaceholders = board.players[0].graveyard.filter(
    (card) => card.code === PLACEHOLDER_CARD_CODE
  )
  assert(gravePlaceholders.length === 2, `墓地应有 2 张占位卡，实际 ${gravePlaceholders.length}`)
  const handPlaceholder = board.players[0].hand.find((card) => card.code === PLACEHOLDER_CARD_CODE)
  assert(Boolean(handPlaceholder), '手牌应还剩一张占位卡')
  const target = [...gravePlaceholders].sort((left, right) => left.sequence - right.sequence)[0]
  const timelineBefore = duelSession.getTimeline()

  const res = await duelSession.replaceCard(refOf(target), REPLACED)
  assert(!res.error, `替换墓地占位卡失败: ${res.error ?? ''}`)
  assert(!res.conflict, '不应要求回退确认')
  assert(!res.warning?.includes('卡片已替换，但重演后'), `不应出现落点警告: ${res.warning ?? ''}`)

  const after = res.boardState!
  const landing = after.players[0].graveyard.find((card) => card.code === REPLACED)
  assert(Boolean(landing), '新卡应在墓地')
  assert(landing!.sequence === target.sequence, '新卡应落在墓地原位置')
  assert(duelSession.getTimeline().length === timelineBefore.length, '替换不应丢弃步骤')
  assert(
    after.players[0].hand.some((card) => card.code === PLACEHOLDER_CARD_CODE),
    '手牌应仍剩那张未被替换的占位卡'
  )

  const secondTarget = after.players[0].graveyard.find(
    (card) => card.code === PLACEHOLDER_CARD_CODE
  )
  assert(Boolean(secondTarget), '墓地应还剩另一张占位卡')
  const secondRes = await duelSession.replaceCard(refOf(secondTarget!), SECOND_REPLACED)
  assert(!secondRes.error, `替换第二张墓地占位卡失败: ${secondRes.error ?? ''}`)
  assert(!secondRes.conflict, '第二张替换不应要求回退确认')
  assert(
    !secondRes.warning?.includes('卡片已替换，但重演后'),
    `第二张替换不应出现落点警告: ${secondRes.warning ?? ''}`
  )
  const secondBoard = secondRes.boardState!
  assert(
    secondBoard.players[0].graveyard.some(
      (card) => card.code === SECOND_REPLACED && card.sequence === secondTarget!.sequence
    ),
    '第二张新卡应落在墓地原位置'
  )

  console.log('[card-edit-drawn-discard-smoke] ALL CHECKS PASSED')
  process.exit(0)
}

main().catch((err) => {
  console.error('[card-edit-drawn-discard-smoke] FAILED:', err)
  process.exit(1)
})
