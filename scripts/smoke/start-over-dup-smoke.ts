/**
 * 从头开始冒烟：编排起始盘面 -> 启动引擎 -> 召唤（手牌序号前移）
 * -> 注入一张手牌 -> 挂起 -> 回到初始局面 -> 从头开始。
 * 断言盘面与引擎初始步骤完全一致，不出现同一位置两张卡。
 */
import { duelSession } from '../../src/main/services/duel/duel-session'
import {
  CardLocation,
  CardPosition,
  CdbCard,
  FieldCard,
  createLightweightSnapshot,
  normalizeDuelState,
  type Answer,
  type EngineRequest
} from '@shared/index'
import { useDuelEngineStore } from '../../src/renderer/src/stores/useDuelEngineStore'
import { useDuelStore } from '../../src/renderer/src/stores/useDuelStore'
import { cdbService } from './cdb-shim'

const BLUE_EYES = 89631139

function assert(condition: boolean, message: string): void {
  if (!condition) throw new Error(`断言失败: ${message}`)
}

function installWindowApi(): void {
  ;(globalThis as unknown as { window: unknown }).window = {
    api: {
      duelEngineInit: (params: unknown) => Promise.resolve(duelSession.startDuel(params as never)),
      duelEngineSubmitAnswer: (answer: unknown) =>
        Promise.resolve(duelSession.submitAnswer(answer as never)),
      duelEngineInject: (command: unknown) => Promise.resolve(duelSession.inject(command as never)),
      duelEngineSetPolicy: () => Promise.resolve(undefined),
      duelEngineGetTimeline: () => Promise.resolve(duelSession.getTimeline()),
      getDuelEngineSessionDoc: () =>
        Promise.resolve({ success: true, doc: duelSession.exportSessionDoc() }),
      restoreDuelEngineSession: (doc: unknown) =>
        duelSession.importSessionDoc(doc as never).then((payload) => ({ success: true, payload })),
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
  const data = request.data
  switch (data.kind) {
    case 'rps':
      return { kind: 'rps', hand: 'paper' }
    case 'idle':
      return data.summonable.length > 0
        ? { kind: 'idle', cmd: 'SUMMON', card: data.summonable[0] }
        : { kind: 'idle', cmd: 'TO_EP' }
    case 'battle':
      return { kind: 'battle', cmd: 'TO_EP' }
    case 'yesno':
      return { kind: 'yesno', yes: false }
    case 'chain':
      return { kind: 'chain', card: null }
    case 'place':
      return { kind: 'place', places: data.places.slice(0, Math.max(1, data.count)) }
    case 'card':
      return data.cancelable
        ? { kind: 'card', cards: null }
        : { kind: 'card', cards: data.cards.slice(0, Math.max(1, data.min)) }
    default:
      return { kind: 'chain', card: null }
  }
}

function cardsAt(cards: FieldCard[], controller: 0 | 1, location: number): FieldCard[] {
  return cards.filter((c) => c.controller === controller && c.location === location)
}

function duplicatePositions(cards: FieldCard[]): string[] {
  const seen = new Map<string, string[]>()
  for (const card of cards) {
    const key = `${card.controller}:${card.location}:${card.sequence}`
    const list = seen.get(key) ?? []
    list.push(`${card.instanceId}(${card.code})`)
    seen.set(key, list)
  }
  return [...seen.entries()]
    .filter(([, list]) => list.length > 1)
    .map(([key, list]) => `${key} => ${list.join(' + ')}`)
}

async function main(): Promise<void> {
  installWindowApi()
  await cdbService.ready()

  const cardOf = (code: number): CdbCard => {
    const card = cdbService.getCardById(code) as unknown as CdbCard
    assert(Boolean(card?.id), `cdb 中必须能找到 ${code}`)
    return card
  }

  const base = normalizeDuelState({
    version: '1.2.0',
    title: '从头开始重复卡复现',
    hint: '',
    duelType: 'full',
    masterRule: 2,
    players: [
      { lp: 4000, maxHand: 0, startHand: 0 },
      { lp: 4000, maxHand: 0, startHand: 0 }
    ],
    turnPlayer: 0 as 0 | 1,
    firstTurnAttack: false,
    cards: [],
    steps: [],
    duelists: [
      { id: 'duelist_0_0', team: 0, name: '游乐', lp: 4000, isFirst: true, turnOrder: 1 },
      { id: 'duelist_1_0', team: 1, name: '薇儿', lp: 4000, turnOrder: 2 }
    ],
    matchConfig: { mode: '1v1', team0Count: 1, team1Count: 1, sharedLp: false },
    scenarios: {}
  })
  useDuelStore.setState((prev) => ({
    ...prev,
    state: { ...base, initialBoardSnapshot: createLightweightSnapshot(base.cards) },
    currentStepIndex: null,
    selectedStepId: null,
    previewReturn: null
  }))
  useDuelEngineStore.getState().stopEngine()

  const add = (
    code: number,
    controller: 0 | 1,
    location: number,
    sequence: number,
    position: number
  ): void => {
    useDuelStore
      .getState()
      .addCardToZone(
        cardOf(code),
        controller,
        location,
        sequence,
        position,
        controller === 0 ? 'duelist_0_0' : 'duelist_1_0'
      )
  }

  add(86120751, 0, CardLocation.HAND, 0, CardPosition.FACEDOWN)
  add(99594764, 0, CardLocation.HAND, 1, CardPosition.FACEDOWN)
  add(99659159, 0, CardLocation.HAND, 2, CardPosition.FACEDOWN)
  add(42956963, 0, CardLocation.HAND, 3, CardPosition.FACEDOWN)
  add(35167375, 0, CardLocation.HAND, 4, CardPosition.FACEDOWN)
  add(76714458, 0, CardLocation.DECK, 0, CardPosition.FACEDOWN_DEFENSE)
  add(74063034, 0, CardLocation.DECK, 1, CardPosition.FACEDOWN_DEFENSE)
  add(12307878, 0, CardLocation.EXTRA, 0, CardPosition.FACEDOWN_DEFENSE)
  add(75286621, 0, CardLocation.EXTRA, 1, CardPosition.FACEDOWN_DEFENSE)

  add(14558127, 1, CardLocation.HAND, 0, CardPosition.FACEDOWN)
  add(33782437, 1, CardLocation.HAND, 1, CardPosition.FACEDOWN)
  add(70226289, 1, CardLocation.HAND, 2, CardPosition.FACEDOWN)
  add(83301414, 1, CardLocation.HAND, 3, CardPosition.FACEDOWN)
  add(69140098, 1, CardLocation.HAND, 4, CardPosition.FACEDOWN)
  add(8842266, 1, CardLocation.DECK, 0, CardPosition.FACEDOWN_DEFENSE)
  add(21522601, 1, CardLocation.DECK, 1, CardPosition.FACEDOWN_DEFENSE)

  useDuelStore.setState((prev) => ({
    ...prev,
    state: { ...prev.state, initialBoardSnapshot: createLightweightSnapshot(prev.state.cards) }
  }))

  await useDuelEngineStore.getState().startEngine()
  assert(useDuelEngineStore.getState().isInitialized, '引擎应启动')

  for (let i = 0; i < 6; i++) {
    const pending = useDuelEngineStore.getState().pendingRequest
    if (!pending) break
    await useDuelEngineStore.getState().submitAnswer(autoAnswer(pending))
    assert(
      useDuelEngineStore.getState().error === null,
      `作答不应报错: ${useDuelEngineStore.getState().error}`
    )
  }

  const injected = await useDuelEngineStore
    .getState()
    .inject({ op: 'add-card', player: 0, code: BLUE_EYES, to: 'hand' })
  assert(injected, `注入应成功: ${useDuelEngineStore.getState().error}`)

  const handBefore = cardsAt(useDuelStore.getState().state.cards, 0, CardLocation.HAND)
  const injectedCard = handBefore.find((card) => /^card-\d+$/.test(card.instanceId))
  assert(Boolean(injectedCard), '注入卡应落在手牌并带有引擎分配的 instanceId')

  await useDuelEngineStore.getState().suspendEngine()
  assert(!useDuelEngineStore.getState().isInitialized, '挂起后引擎应停止')
  assert(useDuelEngineStore.getState().suspendedDoc !== null, '挂起后应有会话快照')

  useDuelStore.getState().previewTimelineStart()

  const restored = await useDuelEngineStore.getState().resumeSuspendedFromStart()
  assert(restored, `从头开始应成功: ${useDuelEngineStore.getState().error}`)
  const engineBoard = useDuelEngineStore.getState().boardState
  assert(engineBoard !== null, '引擎应有初始盘面')

  const cards = useDuelStore.getState().state.cards
  const dups = duplicatePositions(cards)
  assert(dups.length === 0, `同一位置不应出现两张卡:\n  ${dups.join('\n  ')}`)
  assert(
    cards.length === engineBoard.allCards.length,
    `编辑器卡数应与引擎一致（编辑器 ${cards.length} vs 引擎 ${engineBoard.allCards.length}）`
  )
  for (const controller of [0, 1] as const) {
    const hand = cardsAt(cards, controller, CardLocation.HAND)
    assert(
      hand.length === engineBoard.players[controller].hand.length,
      `P${controller} 手牌数应与引擎一致（编辑器 ${hand.length} vs 引擎 ${engineBoard.players[controller].hand.length}）`
    )
  }

  console.log('[start-over-dup] ALL PASSED')
  process.exit(0)
}

void main().catch((err) => {
  console.error('[start-over-dup] FAILED:', err)
  process.exit(1)
})
