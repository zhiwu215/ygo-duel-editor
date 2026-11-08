/**
 * 万宝槌送回卡组、过一回合再抽到其中一张时的替换冒烟：
 * 1. 对方手牌全是占位卡，牌堆只有万宝槌 + 几张卡
 * 2. 万宝槌把 5 张占位卡送回卡组、抽走牌堆原有的 5 张
 * 3. 下一次抽卡抽到的是被送回去的占位卡，替换它也要成功
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
const DECK_CODES = [62651957, 96300057, 46181000, 51638941]

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
    ...Array.from({ length: 8 }, (_, index) => makeCard(GARGOYLE, 0, CardLocation.DECK, index)),
    ...Array.from({ length: 5 }, (_, index) =>
      makeCard(PLACEHOLDER_CARD_CODE, 1, CardLocation.HAND, index)
    ),
    makeCard(MALLET, 1, CardLocation.DECK, 0),
    ...DECK_CODES.map((code, index) => makeCard(code, 1, CardLocation.DECK, index + 1)),
    makeCard(PLACEHOLDER_CARD_CODE, 1, CardLocation.DECK, DECK_CODES.length + 1)
  ]
  const duelists: Duelist[] = [
    { id: 'duelist_0_0', team: 0, name: '十代', lp: 4000, isFirst: true, turnOrder: 1 },
    { id: 'duelist_1_0', team: 1, name: '万丈目准', lp: 4000, turnOrder: 2 }
  ]
  return normalizeDuelState({
    version: '1.2.0',
    title: '送回后再抽到的替换联测',
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
  for (let guard = 0; guard < 80; guard++) {
    const pending = duelSession.getPendingRequest()
    if (!pending) return
    if (pending.kind === 'idle') return
    const res = duelSession.submitAnswer(answerFor(pending))
    if (res.retry) throw new Error('引擎拒绝了自动回答')
  }
  throw new Error('未能推进到 idle')
}

async function endTurn(): Promise<void> {
  duelSession.submitAnswer({ kind: 'idle', cmd: 'TO_EP' })
  await settleToIdle()
}

async function activeMallet(): Promise<void> {
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
  await endTurn()
  await activeMallet()
  await settleToIdle()

  const afterMallet = duelSession.getBoardState()
  assert(afterMallet.players[1].hand.length === 5, '万宝槌后手牌应为 5 张')
  assert(afterMallet.players[1].deckCount === 5, '万宝槌后牌堆应只剩送回卡组的 5 张')

  await endTurn()
  await endTurn()

  const afterDraw = duelSession.getBoardState()
  const drawn = [...afterDraw.players[1].hand].sort((a, b) => b.sequence - a.sequence)[0]
  assert(drawn.code === PLACEHOLDER_CARD_CODE, `第 4 回合抽到的应是送回卡组里的占位卡`)
  const provenance = await duelSession.getProvenance(refOf(drawn))
  assert(
    provenance.kind === 'initial' && provenance.location === CardLocation.HAND,
    '这张占位卡的来源应在初始手牌里'
  )

  const timelineBefore = duelSession.getTimeline()
  const res = await duelSession.replaceCard(refOf(drawn), REPLACED)
  assert(!res.error, `替换失败: ${res.error ?? ''}`)
  assert(!res.conflict, '不应要求回退确认')
  assert(!res.warning, `不应出现落点警告: ${res.warning ?? ''}`)
  const replaced = res.boardState!.players[1].hand.find((card) => card.code === REPLACED)
  assert(Boolean(replaced), '重演后新卡应在手牌')
  assert(replaced!.sequence === drawn.sequence, '新卡应落在被替换的那张手牌位置')
  assert(duelSession.getTimeline().length === timelineBefore.length, '替换不应丢弃步骤')

  const currentStepId = res.currentStepId!
  await duelSession.jumpToStep(currentStepId)
  const replayed = duelSession.getBoardState()
  assert(
    replayed.players[1].hand.some(
      (card) => card.code === REPLACED && card.sequence === drawn.sequence
    ),
    '再次重演后新卡仍应留在原位置'
  )

  console.log('[card-edit-returned-draw-smoke] ALL CHECKS PASSED')
  process.exit(0)
}

main().catch((err) => {
  console.error('[card-edit-returned-draw-smoke] FAILED:', err)
  process.exit(1)
})
