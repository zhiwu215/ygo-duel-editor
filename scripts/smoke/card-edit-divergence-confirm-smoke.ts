/**
 * 卡片编辑分歧确认冒烟：
 * 1. 用「天使的施舍」丢弃占位卡，让历史应答记住那张卡
 * 2. 替换墓地里的占位卡，重演会在丢弃应答处对不齐
 * 3. 未确认时必须原样回滚，返回分歧信息；确认后才回退并丢弃后续步骤
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
const REPLACED_CODE = 36361633

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
  for (let guard = 0; guard < 40; guard++) {
    const pending = duelSession.getPendingRequest()
    if (!pending) return
    if (pending.kind === 'idle') return
    duelSession.submitAnswer(answerFor(pending))
  }
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
    if (pending!.kind === 'card') {
      const data = pending!.data
      if (data.kind === 'card' && !data.cancelable) {
        const placeholder = data.cards.find((card) => card.code === PLACEHOLDER_CARD_CODE)
        assert(Boolean(placeholder), '丢弃候选中应有占位卡')
        const others = data.cards.filter((card) => card !== placeholder)
        const picks = [placeholder!, ...others].slice(0, Math.max(1, data.min))
        duelSession.submitAnswer({ kind: 'card', cards: picks })
        continue
      }
    }
    duelSession.submitAnswer(answerFor(pending!))
  }
}

function handCodes(cards: EngineCard[]): string {
  return cards.map((card) => card.code).join(',')
}

async function main(): Promise<void> {
  await cdbService.ready()
  await duelSession.startDuel({ puzzleState: buildPuzzle(), seed: [1, 2, 3, 4, 5, 6, 7, 8] })
  await settleToIdle()

  await activateCharityAndDiscardPlaceholder()
  await settleToIdle()

  const board = duelSession.getBoardState()
  const graveCard = board.players[0].graveyard.find((card) => card.code === PLACEHOLDER_CARD_CODE)
  assert(Boolean(graveCard), '墓地应有被丢弃的占位卡')
  const timelineBefore = duelSession.getTimeline()
  const handBefore = handCodes(board.players[0].hand)

  const rejected = await duelSession.replaceCard(refOf(graveCard!), REPLACED_CODE)
  assert(Boolean(rejected.conflict), '重演无法对齐时应返回分歧信息')
  assert(!rejected.error, `未确认时不应报错: ${rejected.error ?? ''}`)
  assert(!rejected.editedCard, '未确认时应回滚编辑')

  const afterReject = duelSession.getBoardState()
  assert(
    afterReject.players[0].graveyard.some((card) => card.code === PLACEHOLDER_CARD_CODE),
    '未确认时墓地占位卡应保持不变'
  )
  assert(!afterReject.allCards.some((card) => card.code === REPLACED_CODE), '未确认时不应出现新卡')
  assert(handCodes(afterReject.players[0].hand) === handBefore, '未确认时手牌应保持不变')
  assert(duelSession.getTimeline().length === timelineBefore.length, '未确认时不应丢弃任何步骤')
  assert(duelSession.getPendingRequest() !== undefined, '未确认时引擎应恢复到可继续的状态')
  console.log(
    `[card-edit-conflict] 分歧确认: 第 ${rejected.conflict!.opIndex + 1} 条操作, 会丢弃 ${rejected.conflict!.discardedSteps} 步`
  )

  const accepted = await duelSession.replaceCard(refOf(graveCard!), REPLACED_CODE, true)
  assert(!accepted.conflict, '确认后不应再要求确认')
  assert(Boolean(accepted.warning), '确认后应提示已回退')
  assert(
    accepted.boardState!.players[0].hand.some((card) => card.code === REPLACED_CODE),
    '确认后新卡应留在分歧点的位置'
  )
  assert(
    duelSession.getTimeline().length === accepted.node!.stepNumber,
    '确认后应只保留到分歧点步骤'
  )
  console.log('[card-edit-divergence-confirm-smoke] ALL CHECKS PASSED')
  process.exit(0)
}

main().catch((err) => {
  console.error('[card-edit-divergence-confirm-smoke] FAILED:', err)
  process.exit(1)
})
