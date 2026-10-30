/**
 * 自动重打冒烟：
 * 1. 对局中注入卡组顶，之后继续用结束回合产生应答
 * 2. 挂起后自动重打：把注入卡并入初始场面，再重演旧应答
 * 3. 新会话没有注入操作，最终盘面包含注入卡
 */
import { duelSession } from '../../src/main/services/duel/duel-session'
import {
  CardLocation,
  CardPosition,
  createLightweightSnapshot,
  normalizeDuelState,
  type Answer,
  type EngineRequest,
  type FieldCard
} from '@shared/index'
import { useDuelEngineStore } from '../../src/renderer/src/stores/useDuelEngineStore'
import { useDuelStore } from '../../src/renderer/src/stores/useDuelStore'
import { cdbService } from './cdb-shim'

const BLUE_EYES = 89631139
const HAND_0 = 86120751
const HAND_1 = 99594764
const HAND_2 = 99659159
const DECK_1 = 23434538
const DECK_2 = 14558127
const DECK_3 = 70342110
const DECK_4 = 66518841
const DECK_5 = 97997309

function assert(condition: boolean, message: string): asserts condition {
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
      return { kind: 'idle', cmd: 'TO_EP' }
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

async function waitForIdle(player?: 0 | 1): Promise<void> {
  for (let guard = 0; guard < 40; guard++) {
    const pending = useDuelEngineStore.getState().pendingRequest
    if (!pending) break
    if (pending.data.kind === 'idle' && (player === undefined || pending.player === player)) return
    await useDuelEngineStore.getState().submitAnswer(autoAnswer(pending))
    assert(
      useDuelEngineStore.getState().error === null,
      `作答不应报错: ${useDuelEngineStore.getState().error}`
    )
  }
  const pending = useDuelEngineStore.getState().pendingRequest
  assert(
    pending?.data.kind === 'idle' && (player === undefined || pending.player === player),
    '应进入主要阶段'
  )
}

function buildBaseState(): ReturnType<typeof normalizeDuelState> {
  const cards: FieldCard[] = [
    ...([HAND_0, HAND_1, HAND_2] as const).map((code, index) => ({
      instanceId: `hand-${index}`,
      code,
      controller: 0 as const,
      owner: 0 as const,
      location: CardLocation.HAND,
      sequence: index,
      position: CardPosition.FACEDOWN,
      overlayMaterials: []
    })),
    ...([HAND_0, DECK_1, DECK_2, DECK_3, DECK_4, DECK_5] as const).map((code, index) => ({
      instanceId: `deck-${index}`,
      code,
      controller: 0 as const,
      owner: 0 as const,
      location: CardLocation.DECK,
      sequence: index,
      position: CardPosition.FACEDOWN_DEFENSE,
      overlayMaterials: []
    })),
    ...([HAND_1, HAND_2, DECK_1] as const).map((code, index) => ({
      instanceId: `p1-hand-${index}`,
      code,
      controller: 1 as const,
      owner: 1 as const,
      location: CardLocation.HAND,
      sequence: index,
      position: CardPosition.FACEDOWN,
      overlayMaterials: []
    })),
    ...([DECK_2, DECK_3, DECK_4] as const).map((code, index) => ({
      instanceId: `p1-deck-${index}`,
      code,
      controller: 1 as const,
      owner: 1 as const,
      location: CardLocation.DECK,
      sequence: index,
      position: CardPosition.FACEDOWN_DEFENSE,
      overlayMaterials: []
    }))
  ]
  return normalizeDuelState({
    version: '1.2.0',
    title: '自动重打',
    hint: '',
    duelType: 'full',
    masterRule: 5,
    players: [
      { lp: 8000, maxHand: 0, startHand: 0 },
      { lp: 8000, maxHand: 0, startHand: 0 }
    ],
    turnPlayer: 0 as 0 | 1,
    firstTurnAttack: false,
    cards,
    steps: [],
    duelists: [
      { id: 'duelist_0_0', team: 0, name: '我方', lp: 8000, isFirst: true, turnOrder: 1 },
      { id: 'duelist_1_0', team: 1, name: '对方', lp: 8000, turnOrder: 2 }
    ],
    matchConfig: { mode: '1v1', team0Count: 1, team1Count: 1, sharedLp: false },
    scenarios: {}
  })
}

async function main(): Promise<void> {
  installWindowApi()
  await cdbService.ready()

  useDuelEngineStore.getState().stopEngine()
  const base = buildBaseState()
  useDuelStore.setState((prev) => ({
    ...prev,
    state: { ...base, initialBoardSnapshot: createLightweightSnapshot(base.cards) },
    currentStepIndex: null,
    selectedStepId: null,
    previewReturn: null
  }))
  await useDuelEngineStore.getState().startEngine()
  assert(useDuelEngineStore.getState().isInitialized, '引擎应启动')
  await waitForIdle(0)

  const endTurn = { kind: 'idle', cmd: 'TO_EP' } as const
  await useDuelEngineStore.getState().submitAnswer(endTurn)
  await waitForIdle(1)
  await useDuelEngineStore.getState().submitAnswer(endTurn)
  await waitForIdle(0)
  assert(duelSession.getBoardState().players[0].deckCount === 5, '我方应抽走 1 张')

  const injected = await useDuelEngineStore.getState().inject({
    op: 'add-card',
    player: 0,
    code: BLUE_EYES,
    to: 'deck-top'
  })
  assert(injected, `注入应成功: ${useDuelEngineStore.getState().error}`)

  await useDuelEngineStore.getState().submitAnswer(endTurn)
  await waitForIdle(1)
  await useDuelEngineStore.getState().submitAnswer(endTurn)
  await waitForIdle(0)
  assert(
    duelSession.getBoardState().players[0].hand.some((card) => card.code === BLUE_EYES),
    '原对局应已抽到注入卡'
  )

  await useDuelEngineStore.getState().suspendEngine()
  assert(useDuelEngineStore.getState().suspendedDoc !== null, '挂起后应有会话快照')
  assert(duelSession.hasInjectOps(), '旧会话应包含注入操作')

  const replayed = await useDuelEngineStore.getState().replaySuspendedToClean()
  assert(replayed, `自动重打应成功: ${useDuelEngineStore.getState().error}`)
  assert(!duelSession.hasInjectOps(), '自动重打后不应有注入操作')
  assert(useDuelEngineStore.getState().suspendedDoc === null, '自动重打后应丢弃旧会话')

  const board = duelSession.getBoardState()
  assert(board.turn >= 5, `自动重打应推进到原回合，实际 ${board.turn}`)
  assert(
    board.players[0].hand.some((card) => card.code === BLUE_EYES),
    '自动重打后的手牌应包含注入卡'
  )
  assert(duelSession.getAllTimelineResponses().length > 0, '自动重打后应有可导出的应答流')
  assert(
    board.players[0].hand.length === 5,
    `自动重打后的手牌数应与原对局一致，实际 ${board.players[0].hand.length}`
  )

  console.log('[auto-replay] ALL PASSED')
  process.exit(0)
}

void main().catch((err) => {
  console.error('[auto-replay] FAILED:', err)
  process.exit(1)
})
