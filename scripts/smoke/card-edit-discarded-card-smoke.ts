/**
 * 替换已被历史丢弃的占位卡：
 * 1. 用「天使的施舍」丢弃一张占位卡
 * 2. 替换墓地里的这张占位卡
 * 3. 历史里那次丢弃应改为丢弃替换后的卡，新卡落在墓地原位置，步骤不丢
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
  const p0Deck = [23434538, 14558127, 70342110, 66518841, 97997309]
  const p1Deck = [23434538, 14558127, 70342110, 66518841, 97997309]
  const cards: FieldCard[] = [
    makeCard(PLACEHOLDER_CARD_CODE, 0, CardLocation.HAND, 0),
    makeCard(GRACEFUL_CHARITY, 0, CardLocation.HAND, 1),
    ...p0Deck.map((code, index) => makeCard(code, 0, CardLocation.DECK, index)),
    ...p1Deck.map((code, index) => makeCard(code, 1, CardLocation.DECK, index))
  ]
  const duelists: Duelist[] = [
    { id: 'duelist_0_0', team: 0, name: '我方', lp: 8000, isFirst: true, turnOrder: 1 },
    { id: 'duelist_1_0', team: 1, name: '对方', lp: 8000, isFirst: false, turnOrder: 2 }
  ]
  return normalizeDuelState({
    version: '1.2.0',
    title: '替换已丢弃的占位卡联测',
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
      if (data.cancelable) return { kind: 'card', cards: null }
      const picks = [...data.cards]
        .filter((card) => card.location === CardLocation.HAND && card.controller === 0)
        .sort((left, right) => left.sequence - right.sequence)
        .slice(0, Math.max(1, data.min))
      return { kind: 'card', cards: picks }
    }
    default:
      throw new Error(`未覆盖 kind=${data.kind}`)
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

async function activateCharityAndDiscard(): Promise<void> {
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
      const placeholder = data.cards.find((card) => card.code === PLACEHOLDER_CARD_CODE)
      assert(Boolean(placeholder), '丢弃候选中应有占位卡')
      const others = data.cards.filter((card) => card !== placeholder)
      const picks = [placeholder!, ...others].slice(0, Math.max(1, data.min))
      duelSession.submitAnswer({ kind: 'card', cards: picks })
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
  await activateCharityAndDiscard()
  await settleToIdle()

  const board = duelSession.getBoardState()
  const graveCard = board.players[0].graveyard.find((card) => card.code === PLACEHOLDER_CARD_CODE)
  assert(Boolean(graveCard), '墓地应有被丢弃的占位卡')
  const timelineBefore = duelSession.getTimeline()
  const graveBefore = board.players[0].graveyard.length

  const res = await duelSession.replaceCard(refOf(graveCard!), REPLACED)
  assert(!res.error, `替换已丢弃的占位卡失败: ${res.error ?? ''}`)
  assert(!res.conflict, '不应要求回退确认')
  assert(!res.warning, `不应出现落点警告: ${res.warning ?? ''}`)

  const after = res.boardState!
  const replaced = after.players[0].graveyard.find(
    (card) => card.code === REPLACED && card.sequence === graveCard!.sequence
  )
  assert(Boolean(replaced), '新卡应落在墓地原位置')
  assert(after.players[0].graveyard.length === graveBefore, '替换后墓地数量不变')
  assert(duelSession.getTimeline().length === timelineBefore.length, '替换不应丢弃步骤')
  const replacedName = cdbService.getCardById(REPLACED)?.name
  assert(Boolean(replacedName), '替换目标卡应有卡名')
  assert(
    duelSession.getTimeline().some((node) => node.title.includes(replacedName!)),
    '历史步骤应改为显示替换后的卡'
  )

  const currentStepId = res.currentStepId!
  await duelSession.jumpToStep(currentStepId)
  const replayed = duelSession.getBoardState()
  assert(
    replayed.players[0].graveyard.some(
      (card) => card.code === REPLACED && card.sequence === graveCard!.sequence
    ),
    '再次重演后新卡仍应在墓地原位置'
  )

  console.log('[card-edit-discarded-card-smoke] ALL CHECKS PASSED')
  process.exit(0)
}

main().catch((err) => {
  console.error('[card-edit-discarded-card-smoke] FAILED:', err)
  process.exit(1)
})
