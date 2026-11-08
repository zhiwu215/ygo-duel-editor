/**
 * 洗牌抽卡后的替换冒烟：
 * 1. 对方用「万宝槌」把整手占位卡送回卡组并抽 5 张
 * 2. 替换抽上来的一张占位卡
 * 3. 要求自动定位到洗牌后实际抽到的那张卡，重演后新卡仍在手牌
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

const MALLET = 85852291
const REPLACED = 43422537
const GARGOYLE = 24611934
const DECK_SIZE = 30

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
    ...Array.from({ length: 5 }, (_, index) =>
      makeCard(PLACEHOLDER_CARD_CODE, 0, CardLocation.HAND, index)
    ),
    ...Array.from({ length: 5 }, (_, index) => makeCard(GARGOYLE, 0, CardLocation.DECK, index)),
    makeCard(MALLET, 1, CardLocation.HAND, 0),
    ...Array.from({ length: 4 }, (_, index) =>
      makeCard(PLACEHOLDER_CARD_CODE, 1, CardLocation.HAND, index + 1)
    ),
    ...Array.from({ length: DECK_SIZE }, (_, index) =>
      makeCard(PLACEHOLDER_CARD_CODE, 1, CardLocation.DECK, index)
    )
  ]
  const duelists: Duelist[] = [
    { id: 'duelist_0_0', team: 0, name: '十代', lp: 4000, isFirst: true, turnOrder: 1 },
    { id: 'duelist_1_0', team: 1, name: '万丈目准', lp: 4000, turnOrder: 2 }
  ]
  return normalizeDuelState({
    version: '1.2.0',
    title: '洗牌抽卡替换联测',
    hint: '',
    duelType: 'full',
    masterRule: 5,
    players: [
      { lp: 4000, maxHand: 0, startHand: 0 },
      { lp: 4000, maxHand: 0, startHand: 0 }
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
  for (let guard = 0; guard < 60; guard++) {
    const pending = duelSession.getPendingRequest()
    if (!pending) return
    if (pending.kind === 'idle') return
    const res = duelSession.submitAnswer(answerFor(pending))
    if (res.retry) throw new Error('引擎拒绝了自动回答')
  }
  throw new Error('未能推进到 idle')
}

async function activateMallet(): Promise<void> {
  const pending = duelSession.getPendingRequest()
  if (!pending || pending.kind !== 'idle' || pending.data.kind !== 'idle') {
    throw new Error('等待发动万宝槌时不是 idle')
  }
  const mallet = pending.data.activatable.find((card) => card.code === MALLET)
  assert(Boolean(mallet), '发动候选里应有万宝槌')
  duelSession.submitAnswer({ kind: 'idle', cmd: 'ACTIVATE', card: mallet })

  for (let guard = 0; guard < 20; guard++) {
    const next = duelSession.getPendingRequest()
    if (!next) return
    if (next.kind === 'card' && next.data.kind === 'card') {
      const picks = next.data.cards.filter(
        (card) => card.location === CardLocation.HAND && card.controller === 1
      )
      assert(picks.length === 5, `选卡候选应为 5 张，实际 ${picks.length}`)
      duelSession.submitAnswer({ kind: 'card', cards: picks })
      continue
    }
    if (next.kind === 'idle') return
    duelSession.submitAnswer(answerFor(next))
  }
  throw new Error('万宝槌结算未能推进到 idle')
}

async function main(): Promise<void> {
  await cdbService.ready()
  await duelSession.startDuel({ puzzleState: buildPuzzle(), seed: [1, 2, 3, 4, 5, 6, 7, 8] })
  await settleToIdle()
  duelSession.submitAnswer({ kind: 'idle', cmd: 'TO_EP' })
  await settleToIdle()
  await activateMallet()
  await settleToIdle()

  const before = duelSession.getBoardState()
  const handBefore = before.players[1].hand
  assert(handBefore.length === 5, `结算后手牌应为 5 张，实际 ${handBefore.length}`)
  assert(
    handBefore.every((card) => card.code === PLACEHOLDER_CARD_CODE),
    `结算后手牌应全是占位卡，实际 ${handBefore.map((card) => card.code).join(',')}`
  )

  const target = [...handBefore].sort((a, b) => a.sequence - b.sequence)[0]
  const timelineBefore = duelSession.getTimeline()
  const currentStepId = timelineBefore[timelineBefore.length - 1].id

  const res = await duelSession.replaceCard(refOf(target), REPLACED)
  assert(!res.error, `替换失败: ${res.error ?? ''}`)
  assert(!res.conflict, '不应再要求回退确认')
  assert(!res.warning, `不应出现落点警告: ${res.warning ?? ''}`)
  assert(Boolean(res.editedCard), '应返回编辑信息')
  assert(res.editedCard!.instanceId !== target.instanceId, '编辑来源应指向卡组里的实际来源卡')

  const board = res.boardState!
  const replaced = board.players[1].hand.find((card) => card.code === REPLACED)
  assert(Boolean(replaced), '重演后新卡应在手牌')
  assert(replaced!.sequence === target.sequence, '新卡应落在被替换的那张手牌位置')
  assert(board.players[1].hand.length === 5, '替换后手牌数量不变')

  const provenance = await duelSession.getProvenance(refOf(replaced!))
  assert(provenance.kind === 'initial', '新卡来源应是初始卡组')

  const timelineAfter = duelSession.getTimeline()
  assert(timelineAfter.length === timelineBefore.length, '替换不应丢弃步骤')

  await duelSession.jumpToStep(currentStepId)
  const replayed = duelSession.getBoardState()
  assert(
    replayed.players[1].hand.some(
      (card) => card.code === REPLACED && card.sequence === target.sequence
    ),
    '再次重演后新卡仍应留在原手牌位置'
  )

  const second = replayed.players[1].hand.find(
    (card) => card.code === PLACEHOLDER_CARD_CODE && card.sequence !== target.sequence
  )
  assert(Boolean(second), '应还有可替换的占位卡')
  const secondRes = await duelSession.replaceCard(refOf(second!), 89631139)
  assert(!secondRes.error, `第二次替换失败: ${secondRes.error ?? ''}`)
  assert(!secondRes.conflict, '第二次替换不应要求回退确认')
  const secondBoard = secondRes.boardState!
  assert(
    secondBoard.players[1].hand.some(
      (card) => card.code === 89631139 && card.sequence === second!.sequence
    ),
    '第二次替换的新卡应落在原手牌位置'
  )
  assert(
    secondBoard.players[1].hand.some((card) => card.code === REPLACED),
    '第二次替换后第一张新卡仍应留在手牌'
  )

  console.log('[card-edit-drawn-source-smoke] ALL CHECKS PASSED')
  process.exit(0)
}

main().catch((err) => {
  console.error('[card-edit-drawn-source-smoke] FAILED:', err)
  process.exit(1)
})
