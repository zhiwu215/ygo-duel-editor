/**
 * 引擎启动复现冒烟：编排模式布置手牌/卡组（产生带 manualOps 的编排步骤）后启动引擎，
 * 验证：
 * 1. 启动后编辑器棋盘不翻倍（手牌/卡组数量不变），无重复 instanceId（选中不双高亮）
 * 2. 编排步骤被清空（布景步骤不是对局步骤）
 * 3. 卡组/手牌序号连续无重复
 * 4. 先退出再启动、连续启动两次，结果一致
 */
import { duelSession } from '../../src/main/services/duel/duel-session'
import {
  CardLocation,
  CardPosition,
  CdbCard,
  FieldCard,
  createLightweightSnapshot,
  normalizeDuelState
} from '@shared/index'
import type { EngineRequest, Answer } from '@shared/index'
import { useDuelEngineStore } from '../../src/renderer/src/stores/useDuelEngineStore'
import { useDuelStore } from '../../src/renderer/src/stores/useDuelStore'
import { cdbService } from './cdb-shim'

const BLUE_EYES = 89631139
const POT = 55144522

function assert(condition: boolean, message: string): void {
  if (!condition) throw new Error(`断言失败: ${message}`)
}

function installWindowApi(): void {
  ;(globalThis as unknown as { window: unknown }).window = {
    api: {
      duelEngineInit: (params: unknown) => Promise.resolve(duelSession.startDuel(params as never)),
      duelEngineSubmitAnswer: (answer: unknown) =>
        Promise.resolve(duelSession.submitAnswer(answer as never)),
      duelEngineSetPolicy: () => Promise.resolve(undefined),
      duelEngineGetTimeline: () => Promise.resolve(duelSession.getTimeline()),
      getCardsByIds: (ids: number[]) => {
        const out: Record<number, unknown> = {}
        for (const id of ids) out[id] = cdbService.getCardById(id)
        return Promise.resolve(out)
      },
      onCardImageUpdated: () => () => undefined,
      onCustomCardsUpdated: () => () => undefined
    }
  }
  ;(globalThis as unknown as { document: unknown }).document = {
    addEventListener: () => undefined,
    removeEventListener: () => undefined
  }
}

function autoAnswer(request: EngineRequest): Answer {
  switch (request.kind) {
    case 'rps':
      return { kind: 'rps', hand: 'paper' }
    case 'idle':
      return { kind: 'idle', cmd: 'TO_EP' }
    case 'battle':
      return { kind: 'battle', cmd: 'TO_EP' }
    case 'yesno':
      return { kind: 'yesno', yes: false }
    case 'chain':
      return { kind: 'chain', card: null }
    case 'card':
      return request.data.cancelable
        ? { kind: 'card', cards: null }
        : { kind: 'card', cards: request.data.cards.slice(0, Math.max(1, request.data.min)) }
    default:
      return { kind: 'chain', card: null }
  }
}

function boardSummary(): {
  hand: FieldCard[]
  deck: FieldCard[]
  steps: number
  dupIds: string[]
} {
  const cards = useDuelStore.getState().state.cards
  const byLoc = (location: number): FieldCard[] =>
    cards.filter((c) => c.location === location).sort((a, b) => a.sequence - b.sequence)
  const dupIds = cards
    .filter((c, i) => cards.some((o, j) => i !== j && o.instanceId === c.instanceId))
    .map((c) => c.instanceId)
  return {
    hand: byLoc(CardLocation.HAND),
    deck: byLoc(CardLocation.DECK),
    steps: useDuelStore.getState().state.steps?.length ?? 0,
    dupIds: [...new Set(dupIds)]
  }
}

function logBoard(label: string): void {
  const { hand, deck, steps, dupIds } = boardSummary()
  const fmt = (cards: FieldCard[]): string =>
    cards.map((c) => `${c.code}@${c.sequence}`).join(', ') || '（空）'
  console.log(`[${label}] 手牌(${hand.length}): ${fmt(hand)}`)
  console.log(`[${label}] 卡组(${deck.length}): ${fmt(deck)}`)
  console.log(`[${label}] 步骤 ${steps} 条, 重复 instanceId: ${dupIds.join(', ') || '无'}`)
}

function assertHealthy(context: string, handCount: number, deckCount: number): void {
  const { hand, deck, steps, dupIds } = boardSummary()
  assert(dupIds.length === 0, `${context}存在重复 instanceId: ${dupIds.join(', ')}`)
  assert(hand.length === handCount, `${context}手牌应为 ${handCount} 张，实际 ${hand.length} 张`)
  assert(deck.length === deckCount, `${context}卡组应为 ${deckCount} 张，实际 ${deck.length} 张`)
  const seqRange = (count: number): number[] => Array.from({ length: count }, (_, i) => i)
  assert(
    JSON.stringify(hand.map((c) => c.sequence)) === JSON.stringify(seqRange(hand.length)),
    `${context}手牌序号应连续 [0..${handCount - 1}]，实际 [${hand.map((c) => c.sequence).join(',')}]`
  )
  assert(
    JSON.stringify(deck.map((c) => c.sequence)) === JSON.stringify(seqRange(deck.length)),
    `${context}卡组序号应连续 [0..${deckCount - 1}]，实际 [${deck.map((c) => c.sequence).join(',')}]`
  )
  assert(steps === 0, `${context}编排步骤应被清空，实际残留 ${steps} 条`)
}

async function startEngineAndAssert(
  context: string,
  handCount: number,
  deckCount: number
): Promise<void> {
  await useDuelEngineStore.getState().startEngine()
  assert(useDuelEngineStore.getState().isInitialized, `${context}启动后引擎应处于激活状态`)
  logBoard(`${context}启动后`)
  assertHealthy(context, handCount, deckCount)
}

async function main(): Promise<void> {
  installWindowApi()
  await cdbService.ready()

  const beCard = cdbService.getCardById(BLUE_EYES) as unknown as CdbCard
  const potCard = cdbService.getCardById(POT) as unknown as CdbCard
  assert(Boolean(beCard?.id && potCard?.id), 'cdb 中必须能找到测试卡')

  const base = normalizeDuelState({
    version: '1.2.0',
    title: '引擎启动翻倍复现',
    hint: '',
    duelType: 'full',
    masterRule: 5,
    players: [
      { lp: 8000, maxHand: 0, startHand: 0 },
      { lp: 8000, maxHand: 0, startHand: 0 }
    ],
    turnPlayer: 0 as 0 | 1,
    firstTurnAttack: false,
    cards: [],
    steps: [],
    duelists: [
      { id: 'duelist_0_0', team: 0, name: '我方', lp: 8000, isFirst: true, turnOrder: 1 },
      { id: 'duelist_1_0', team: 1, name: '对方', lp: 8000, turnOrder: 2 }
    ],
    matchConfig: { mode: '1v1', team0Count: 1, team1Count: 1, sharedLp: false },
    scenarios: {}
  })
  useDuelStore.setState((prev) => ({
    ...prev,
    state: { ...base, initialBoardSnapshot: createLightweightSnapshot(base.cards) },
    currentStepIndex: null,
    selectedStepId: null
  }))
  useDuelEngineStore.getState().stopEngine()

  useDuelStore
    .getState()
    .addCardToZone(beCard, 0, CardLocation.HAND, 0, CardPosition.FACEDOWN, 'duelist_0_0')
  useDuelStore
    .getState()
    .addCardToZone(potCard, 0, CardLocation.HAND, 1, CardPosition.FACEDOWN, 'duelist_0_0')
  useDuelStore
    .getState()
    .addCardToZone(potCard, 0, CardLocation.DECK, 0, CardPosition.FACEDOWN, 'duelist_0_0')
  useDuelStore
    .getState()
    .addCardToZone(beCard, 0, CardLocation.DECK, 1, CardPosition.FACEDOWN, 'duelist_0_0')
  useDuelStore
    .getState()
    .addCardToZone(beCard, 0, CardLocation.DECK, 2, CardPosition.FACEDOWN, 'duelist_0_0')
  const deckBottom = useDuelStore
    .getState()
    .state.cards.filter((c) => c.location === CardLocation.DECK)
    .sort((a, b) => b.sequence - a.sequence)[0]
  useDuelStore.getState().moveCard(deckBottom.instanceId, CardLocation.HAND, 2)
  useDuelStore.getState().moveCard(deckBottom.instanceId, CardLocation.DECK, 3)

  logBoard('启动前')
  const before = useDuelStore.getState().state
  assert(before.cards.length === 5, `布置后棋盘应有 5 张卡，实际 ${before.cards.length} 张`)
  assert(
    (before.steps || []).length === 7,
    `布置后应有 7 条编排步骤，实际 ${(before.steps || []).length} 条`
  )

  await startEngineAndAssert('首次启动：', 2, 3)

  for (let i = 0; i < 2; i++) {
    const pending = useDuelEngineStore.getState().pendingRequest
    if (!pending) break
    await useDuelEngineStore.getState().submitAnswer(autoAnswer(pending))
    assert(
      useDuelEngineStore.getState().error === null,
      `引擎作答不应报错: ${useDuelEngineStore.getState().error}`
    )
    const { dupIds, steps } = boardSummary()
    assert(dupIds.length === 0, `作答后出现重复 instanceId: ${dupIds.join(', ')}`)
    assert(steps > 0, `作答后应产生引擎步骤，实际 ${steps} 条`)
  }
  logBoard('作答后')

  const afterAnswers = boardSummary()
  await useDuelEngineStore.getState().startEngine()
  logBoard('引擎内重启后')
  {
    const { hand, deck, steps, dupIds } = boardSummary()
    assert(dupIds.length === 0, `引擎内重启后出现重复 instanceId: ${dupIds.join(', ')}`)
    assert(
      hand.length === afterAnswers.hand.length && deck.length === afterAnswers.deck.length,
      `引擎内重启不应改变卡量: 手牌 ${hand.length}/${afterAnswers.hand.length}，卡组 ${deck.length}/${afterAnswers.deck.length}`
    )
    assert(
      steps === afterAnswers.steps,
      `引擎内重启应保留步骤列表（以这一步为起点继续编排），实际 ${steps}/${afterAnswers.steps} 条`
    )
  }

  const { hand: midHand, deck: midDeck } = boardSummary()
  useDuelEngineStore.getState().stopEngine()
  assert(!useDuelEngineStore.getState().isInitialized, 'stopEngine 后引擎应退出')
  await startEngineAndAssert('退出后再启动：', midHand.length, midDeck.length)

  await startEngineAndAssert('连续再启动：', midHand.length, midDeck.length)

  console.log('[engine-start-dup] ALL PASSED')
  process.exit(0)
}

void main().catch((err) => {
  console.error('[engine-start-dup] FAILED:', err)
  process.exit(1)
})
