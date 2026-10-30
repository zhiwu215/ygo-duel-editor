/**
 * 注入并入初始场面冒烟：
 * 1. 我方抽卡后注入卡组顶，会写回初始场面并排在已抽走的卡之后
 * 2. 注入手牌、替换注入卡后，初始场面保留其他已并入的卡
 * 3. 首次抽卡回退不会误删刚刚并入的手牌
 * 4. 挂起 -> 回到初始局面 -> 从头开始 会用无注入的新会话重开，并保持抽卡顺序
 */
import { duelSession } from '../../src/main/services/duel/duel-session'
import {
  CardLocation,
  CardPosition,
  createLightweightSnapshot,
  normalizeDuelState,
  resolveOpeningSnapshot,
  type Answer,
  type DuelPuzzleState,
  type EngineBoardState,
  type EngineCard,
  type EngineRequest,
  type FieldCard,
  type LightweightCardSnapshot
} from '@shared/index'
import { applyInjectionToOpening } from '../../src/renderer/src/stores/duelEngine/openingInjection'
import { clearEditorSteps } from '../../src/renderer/src/stores/duelEngine/stepRecords'
import { useDuelEngineStore } from '../../src/renderer/src/stores/useDuelEngineStore'
import { useDuelStore } from '../../src/renderer/src/stores/useDuelStore'
import { cdbService } from './cdb-shim'

const BLUE_EYES = 89631139
const DARK_MAGICIAN = 46986414
const POT_OF_GREED = 55144522
const HAND_0 = 86120751
const HAND_1 = 99594764
const HAND_2 = 99659159
const DECK_1 = 23434538
const DECK_2 = 14558127
const DECK_3 = 70342110
const DECK_4 = 66518841
const DECK_5 = 97997309
const EXTRA_0 = 12307878
const EXTRA_1 = 75286621

function assert(condition: boolean, message: string): asserts condition {
  if (!condition) throw new Error(`断言失败: ${message}`)
}

function snapshotCard(
  instanceId: string,
  code: number,
  location: number,
  sequence: number,
  controller: 0 | 1 = 0
): LightweightCardSnapshot {
  return {
    instanceId,
    code,
    controller,
    owner: controller,
    location,
    sequence,
    position: CardPosition.FACEDOWN,
    overlayMaterials: [],
    duelistId: controller === 0 ? 'duelist_0_0' : 'duelist_1_0'
  }
}

function engineCard(
  instanceId: string,
  code: number,
  location: number,
  sequence: number,
  controller: 0 | 1 = 0
): EngineCard {
  return {
    instanceId,
    code,
    controller,
    owner: controller,
    location,
    sequence,
    position: CardPosition.FACEDOWN,
    overlayMaterials: [],
    duelistId: controller === 0 ? 'duelist_0_0' : 'duelist_1_0'
  }
}

function boardOf(cards: EngineCard[]): EngineBoardState {
  return { allCards: cards } as EngineBoardState
}

function deckCodes(opening: LightweightCardSnapshot[], controller: 0 | 1 = 0): number[] {
  return opening
    .filter((card) => card.controller === controller && card.location === CardLocation.DECK)
    .sort((left, right) => left.sequence - right.sequence)
    .map((card) => card.code)
}

function handCodes(opening: LightweightCardSnapshot[], controller: 0 | 1 = 0): number[] {
  return opening
    .filter((card) => card.controller === controller && card.location === CardLocation.HAND)
    .sort((left, right) => left.sequence - right.sequence)
    .map((card) => card.code)
}

function pureChecks(): void {
  const deckOpening = [
    snapshotCard('card-0', HAND_0, CardLocation.DECK, 0),
    snapshotCard('card-1', HAND_1, CardLocation.DECK, 1),
    snapshotCard('card-2', HAND_2, CardLocation.DECK, 2),
    snapshotCard('card-3', DECK_1, CardLocation.DECK, 3)
  ]
  const drawn = engineCard('card-0', HAND_0, CardLocation.HAND, 0)
  const remainingDeck = [
    engineCard('card-3', DECK_1, CardLocation.DECK, 0),
    engineCard('card-2', HAND_2, CardLocation.DECK, 1),
    engineCard('card-1', HAND_1, CardLocation.DECK, 2)
  ]
  const topInject = engineCard('card-9', BLUE_EYES, CardLocation.DECK, 3)
  const topResult = applyInjectionToOpening({
    opening: deckOpening,
    before: boardOf([drawn, ...remainingDeck]),
    after: boardOf([drawn, ...remainingDeck, topInject]),
    command: { op: 'add-card', player: 0, code: BLUE_EYES, to: 'deck-top' },
    masterRule: 5
  })
  assert(topResult.baked === 1, '卡组顶注入应并入初始场面')
  assert(
    deckCodes(topResult.opening).join(',') ===
      [HAND_0, BLUE_EYES, HAND_1, HAND_2, DECK_1].join(','),
    `卡组顶注入应落在已抽走的卡之后: ${deckCodes(topResult.opening).join(',')}`
  )

  const emptyDeckInject = engineCard('card-10', BLUE_EYES, CardLocation.DECK, 0)
  const emptyDeckResult = applyInjectionToOpening({
    opening: deckOpening,
    before: boardOf([drawn]),
    after: boardOf([drawn, emptyDeckInject]),
    command: { op: 'add-card', player: 0, code: BLUE_EYES, to: 'deck-top' },
    masterRule: 5
  })
  assert(
    deckCodes(emptyDeckResult.opening).join(',') ===
      [BLUE_EYES, HAND_0, HAND_1, HAND_2, DECK_1].join(','),
    `空卡组顶注入应落到初始卡组最前: ${deckCodes(emptyDeckResult.opening).join(',')}`
  )

  const bottomInject = engineCard('card-9', DARK_MAGICIAN, CardLocation.DECK, 0)
  const bottomResult = applyInjectionToOpening({
    opening: deckOpening,
    before: boardOf([drawn, ...remainingDeck]),
    after: boardOf([drawn, bottomInject, ...remainingDeck]),
    command: { op: 'add-card', player: 0, code: DARK_MAGICIAN, to: 'deck-bottom' },
    masterRule: 5
  })
  assert(
    deckCodes(bottomResult.opening).join(',') ===
      [HAND_0, HAND_1, HAND_2, DECK_1, DARK_MAGICIAN].join(','),
    `卡组底注入应追加到初始卡组末尾: ${deckCodes(bottomResult.opening).join(',')}`
  )

  const handOpening = [
    snapshotCard('hand-0', HAND_0, CardLocation.HAND, 0),
    snapshotCard('hand-1', HAND_1, CardLocation.HAND, 1),
    snapshotCard('hand-2', HAND_2, CardLocation.HAND, 2)
  ]
  const handAfter = [
    engineCard('hand-0', HAND_0, CardLocation.HAND, 0),
    engineCard('hand-2', HAND_2, CardLocation.HAND, 1),
    engineCard('card-9', BLUE_EYES, CardLocation.HAND, 2)
  ]
  const handResult = applyInjectionToOpening({
    opening: handOpening,
    before: boardOf(handAfter.slice(0, 2)),
    after: boardOf(handAfter),
    command: { op: 'add-card', player: 0, code: BLUE_EYES, to: 'hand' },
    masterRule: 5
  })
  assert(
    handCodes(handResult.opening).join(',') === [HAND_0, HAND_1, HAND_2, BLUE_EYES].join(','),
    `手牌注入应追加到初始手牌末尾: ${handCodes(handResult.opening).join(',')}`
  )

  const duplicateOpening = [
    snapshotCard('dup-0', HAND_0, CardLocation.DECK, 0),
    snapshotCard('dup-1', HAND_0, CardLocation.DECK, 1),
    snapshotCard('dup-2', HAND_1, CardLocation.DECK, 2)
  ]
  const duplicateAfter = [
    engineCard('dup-2', HAND_1, CardLocation.DECK, 0),
    engineCard('dup-1', HAND_0, CardLocation.DECK, 1),
    engineCard('card-9', HAND_0, CardLocation.DECK, 2)
  ]
  const duplicateResult = applyInjectionToOpening({
    opening: duplicateOpening,
    before: boardOf(duplicateAfter.slice(0, 2)),
    after: boardOf(duplicateAfter),
    command: { op: 'add-card', player: 0, code: HAND_0, to: 'deck-top' },
    masterRule: 5
  })
  const duplicateDeck = duplicateResult.opening
    .filter((card) => card.location === CardLocation.DECK)
    .sort((left, right) => left.sequence - right.sequence)
  assert(
    duplicateDeck.map((card) => card.instanceId).join(',') === 'dup-0,card-9,dup-1,dup-2',
    `同名卡应向对应实例插入: ${duplicateDeck.map((card) => card.instanceId).join(',')}`
  )

  const zoneOpening = [snapshotCard('zone-0', HAND_1, CardLocation.MZONE, 0)]
  const zoneResult = applyInjectionToOpening({
    opening: zoneOpening,
    before: boardOf([]),
    after: boardOf([engineCard('card-9', BLUE_EYES, CardLocation.MZONE, 0)]),
    command: {
      op: 'add-card',
      player: 0,
      code: BLUE_EYES,
      to: 'mzone',
      sequence: 0
    },
    masterRule: 5
  })
  const zoneCard = zoneResult.opening.find((card) => card.instanceId === 'card-9')
  assert(zoneCard?.sequence === 1, `怪兽区冲突时应落到空位: ${zoneCard?.sequence}`)

  const pzoneResult = applyInjectionToOpening({
    opening: [snapshotCard('pzone-0', HAND_1, CardLocation.PZONE, 0)],
    before: boardOf([]),
    after: boardOf([engineCard('card-9', BLUE_EYES, CardLocation.SZONE, 0)]),
    command: {
      op: 'add-card',
      player: 0,
      code: BLUE_EYES,
      to: 'szone',
      sequence: 0,
      position: CardPosition.FACEUP
    },
    masterRule: 5
  })
  const pzoneCard = pzoneResult.opening.find((card) => card.instanceId === 'card-9')
  assert(pzoneCard?.sequence === 1, `灵摆区冲突时应落到相邻魔陷区: ${pzoneCard?.sequence}`)
}

function drawUndoCheck(): void {
  const openingHand = [
    snapshotCard('h0', HAND_0, CardLocation.HAND, 0),
    snapshotCard('h1', HAND_1, CardLocation.HAND, 1),
    snapshotCard('h2', HAND_2, CardLocation.HAND, 2),
    snapshotCard('injected-hand', DARK_MAGICIAN, CardLocation.HAND, 3),
    snapshotCard('h3', HAND_1, CardLocation.HAND, 4),
    snapshotCard('h4', HAND_2, CardLocation.HAND, 5)
  ]
  const afterHand = [
    ...openingHand.slice(0, 5),
    snapshotCard('drawn', HAND_0, CardLocation.HAND, 5)
  ]
  const state = {
    initialBoardSnapshot: openingHand,
    steps: [
      {
        id: 'draw-step',
        turn: 1,
        turnPlayer: 0,
        phase: 'DP',
        actionPlayer: 0,
        actionType: 'DRAW',
        instanceId: 'drawn',
        cardCode: HAND_0,
        boardAfter: afterHand,
        logEvents: [{ kind: 'draw', player: 0, cards: [{ code: HAND_0 }] }]
      }
    ]
  } as unknown as DuelPuzzleState
  const opening = resolveOpeningSnapshot(state)
  assert(opening?.length === 6, `首次抽卡回退不应误删并入的手牌: ${opening?.length}`)
  assert(
    opening.some((card) => card.instanceId === 'injected-hand'),
    '首次抽卡回退不应移除已并入的注入卡'
  )
}

function installWindowApi(): void {
  ;(globalThis as unknown as { window: unknown }).window = {
    api: {
      duelEngineInit: (params: unknown) => Promise.resolve(duelSession.startDuel(params as never)),
      duelEngineSubmitAnswer: (answer: unknown) =>
        Promise.resolve(duelSession.submitAnswer(answer as never)),
      duelEngineInject: (command: unknown) => Promise.resolve(duelSession.inject(command as never)),
      duelEngineReplaceCard: (ref: unknown, newCode: number) =>
        Promise.resolve(duelSession.replaceCard(ref as never, newCode)),
      duelEngineRemoveCard: (ref: unknown) => Promise.resolve(duelSession.removeCard(ref as never)),
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

function cardsAt(cards: FieldCard[], controller: 0 | 1, location: number): FieldCard[] {
  return cards.filter((card) => card.controller === controller && card.location === location)
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

async function waitForIdle(player?: 0 | 1): Promise<void> {
  for (let guard = 0; guard < 30; guard++) {
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
    ...([EXTRA_0, EXTRA_1] as const).map((code, index) => ({
      instanceId: `extra-${index}`,
      code,
      controller: 0 as const,
      owner: 0 as const,
      location: CardLocation.EXTRA,
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
    title: '注入并入初始场面',
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
  pureChecks()
  drawUndoCheck()

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

  const beforeDeck = useDuelStore
    .getState()
    .state.initialBoardSnapshot!.filter(
      (card) => card.controller === 0 && card.location === CardLocation.DECK
    )
    .sort((left, right) => left.sequence - right.sequence)
  assert(beforeDeck[0]?.code === HAND_0, '开局卡组顶应是已知卡')

  const endTurn = { kind: 'idle', cmd: 'TO_EP' } as const
  await useDuelEngineStore.getState().submitAnswer(endTurn)
  await waitForIdle(1)
  await useDuelEngineStore.getState().submitAnswer(endTurn)
  await waitForIdle(0)
  const boardAfterDraw = useDuelEngineStore.getState().boardState
  assert(boardAfterDraw?.players[0].deckCount === 5, '我方第二回合应抽走卡组顶的 1 张')
  assert(boardAfterDraw?.players[0].hand.length === 4, '抽卡后我方手牌应为 4 张')

  const injectedTop = await useDuelEngineStore.getState().inject({
    op: 'add-card',
    player: 0,
    code: BLUE_EYES,
    to: 'deck-top'
  })
  assert(injectedTop, `注入卡组顶应成功: ${useDuelEngineStore.getState().error}`)
  const injectedHand = await useDuelEngineStore.getState().inject({
    op: 'add-card',
    player: 0,
    code: DARK_MAGICIAN,
    to: 'hand'
  })
  assert(injectedHand, `注入手牌应成功: ${useDuelEngineStore.getState().error}`)

  const openingAfterInject = useDuelStore.getState().state.initialBoardSnapshot!
  assert(
    deckCodes(openingAfterInject).join(',') ===
      [HAND_0, BLUE_EYES, DECK_1, DECK_2, DECK_3, DECK_4, DECK_5].join(','),
    `卡组顶注入应落在已抽走的卡之后: ${deckCodes(openingAfterInject).join(',')}`
  )
  assert(
    handCodes(openingAfterInject).join(',') === [HAND_0, HAND_1, HAND_2, DARK_MAGICIAN].join(','),
    `手牌注入后初始手牌顺序不对: ${handCodes(openingAfterInject).join(',')}`
  )

  const injectedHandCard = useDuelEngineStore
    .getState()
    .boardState?.allCards.find((card) => card.code === DARK_MAGICIAN && card.controller === 0)
  assert(Boolean(injectedHandCard), '应能在引擎盘面找到注入的手牌')
  const replaced = await useDuelEngineStore.getState().replaceCard(
    {
      instanceId: injectedHandCard!.instanceId,
      controller: injectedHandCard!.controller,
      location: injectedHandCard!.location,
      sequence: injectedHandCard!.sequence
    },
    POT_OF_GREED
  )
  assert(replaced, `替换注入卡应成功: ${useDuelEngineStore.getState().error}`)
  const openingAfterEdit = useDuelStore.getState().state.initialBoardSnapshot!
  assert(
    deckCodes(openingAfterEdit).join(',') ===
      [HAND_0, BLUE_EYES, DECK_1, DECK_2, DECK_3, DECK_4, DECK_5].join(','),
    `编辑注入卡后不应丢失其他已并入的卡: ${deckCodes(openingAfterEdit).join(',')}`
  )
  assert(
    handCodes(openingAfterEdit).join(',') === [HAND_0, HAND_1, HAND_2, POT_OF_GREED].join(','),
    `替换注入卡后初始手牌应更新: ${handCodes(openingAfterEdit).join(',')}`
  )

  await useDuelEngineStore.getState().suspendEngine()
  assert(!useDuelEngineStore.getState().isInitialized, '挂起后引擎应停止')
  useDuelStore.getState().previewTimelineStart()
  const previewHand = cardsAt(useDuelStore.getState().state.cards, 0, CardLocation.HAND)
  assert(
    previewHand.length === 4,
    `回到初始局面时手牌应是 4 张（含并入的 1 张），实际 ${previewHand.length}`
  )

  const restored = await useDuelEngineStore.getState().resumeSuspendedFromStart()
  assert(restored, `从头开始应成功: ${useDuelEngineStore.getState().error}`)
  assert(duelSession.hasInjectOps() === false, '新会话不应保留注入操作')
  assert(useDuelEngineStore.getState().suspendedDoc === null, '旧会话应被丢弃')

  const engineBoard = duelSession.getBoardState()
  const engineHand = engineBoard.players[0].hand
  const engineDeck = engineBoard.players[0].deck ?? []
  assert(
    engineHand.some((card) => card.code === POT_OF_GREED),
    '新开局手牌应包含注入卡'
  )
  assert(
    engineDeck.some((card) => card.code === BLUE_EYES),
    '新开局卡组应包含注入卡'
  )

  const editorCards = useDuelStore.getState().state.cards
  const dups = duplicatePositions(editorCards)
  assert(dups.length === 0, `同一位置不应出现两张卡:\n  ${dups.join('\n  ')}`)
  assert(
    editorCards.length === engineBoard.allCards.length,
    `编辑器卡数应与引擎一致（编辑器 ${editorCards.length} vs 引擎 ${engineBoard.allCards.length}）`
  )
  const finalOpening = useDuelStore.getState().state.initialBoardSnapshot!
  assert(
    deckCodes(finalOpening).join(',') ===
      [HAND_0, BLUE_EYES, DECK_1, DECK_2, DECK_3, DECK_4, DECK_5].join(','),
    `新开局后初始卡组顺序不应变化: ${deckCodes(finalOpening).join(',')}`
  )
  assert(engineDeck.at(-1)?.code === HAND_0, '新开局卡组顶应是被抽走的那张')
  assert(
    engineDeck.at(-2)?.code === BLUE_EYES,
    `新开局第二张应是注入卡: ${engineDeck
      .slice(-3)
      .map((card) => card.code)
      .join(',')}`
  )

  await waitForIdle(0)
  await useDuelEngineStore.getState().submitAnswer(endTurn)
  await waitForIdle(1)
  await useDuelEngineStore.getState().submitAnswer(endTurn)
  await waitForIdle(0)
  await useDuelEngineStore.getState().submitAnswer(endTurn)
  await waitForIdle(1)
  await useDuelEngineStore.getState().submitAnswer(endTurn)
  await waitForIdle(0)
  assert(
    duelSession.getBoardState().players[0].hand.some((card) => card.code === BLUE_EYES),
    '新开局应在原抽卡顺序的同一位置抽到注入卡'
  )

  await useDuelEngineStore.getState().suspendEngine()
  clearEditorSteps()
  assert(useDuelStore.getState().state.steps?.length === 0, '应清空步骤以模拟 0 步会话')
  await useDuelEngineStore.getState().startEngine()
  assert(useDuelEngineStore.getState().isInitialized, '从最终盘面开始的新会话应启动')
  assert(
    deckCodes(useDuelStore.getState().state.initialBoardSnapshot!).join(',') ===
      [HAND_0, BLUE_EYES, DECK_1, DECK_2, DECK_3, DECK_4, DECK_5].join(','),
    '从最终盘面开新会话不应覆盖初始场面'
  )
  await useDuelEngineStore.getState().suspendEngine()

  assert(useDuelStore.getState().enterSceneMode(), '0 步会话应能进入布景')
  const sceneHand = cardsAt(useDuelStore.getState().state.cards, 0, CardLocation.HAND)
  assert(sceneHand.length === 4, `布景应显示初始手牌 4 张，实际 ${sceneHand.length}`)
  assert(
    deckCodes(useDuelStore.getState().state.initialBoardSnapshot!).join(',') ===
      [HAND_0, BLUE_EYES, DECK_1, DECK_2, DECK_3, DECK_4, DECK_5].join(','),
    '布景不应改变初始场面'
  )

  const fromScene = await useDuelEngineStore.getState().resumeSuspendedFromStart()
  assert(fromScene, `布景中从头开始应成功: ${useDuelEngineStore.getState().error}`)
  const sceneRestartHand = duelSession.getBoardState().players[0].hand
  const sceneRestartDeck = duelSession.getBoardState().players[0].deck ?? []
  assert(sceneRestartHand.length === 4, '布景中从头开始应回到初始手牌')
  assert(
    sceneRestartHand.some((card) => card.code === POT_OF_GREED),
    '初始手牌应保留并入并替换后的卡'
  )
  assert(sceneRestartDeck.at(-1)?.code === HAND_0, '布景中从头开始应回到初始卡组顶')
  assert(sceneRestartDeck.at(-2)?.code === BLUE_EYES, '布景中从头开始应保留注入卡的位置')

  console.log('[opening-inject] ALL PASSED')
  process.exit(0)
}

void main().catch((err) => {
  console.error('[opening-inject] FAILED:', err)
  process.exit(1)
})
