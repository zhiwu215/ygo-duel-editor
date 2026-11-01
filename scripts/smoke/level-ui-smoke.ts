/**
 * 等级 UI 传导冒烟：
 * 1. 代价降低后祭品召唤青眼白龙，实时棋盘上的 customLevel 应为 6
 * 2. 该步骤的 boardAfter 快照必须保留 customLevel
 * 3. 步骤预览回到该步骤时，卡片等级不能退回 8
 * 4. 回合结束后引擎等级复位，UI 也应回到 8
 */
import { duelSession } from '../../src/main/services/duel/duel-session'
import {
  CardLocation,
  CardPosition,
  normalizeDuelState,
  type Answer,
  type Duelist,
  type EngineRequest,
  type FieldCard
} from '@shared/index'
import { useDuelEngineStore } from '../../src/renderer/src/stores/useDuelEngineStore'
import { useDuelStore } from '../../src/renderer/src/stores/useDuelStore'
import { cdbService } from './cdb-shim'

const COST_DOWN = 23265313
const BLUE_EYES = 89631139
const GARGOYLE = 24611934
const TRIBUTE = 97997309
const POT = 55144522

let fieldId = 0

function makeCard(code: number, controller: 0 | 1, location: number, sequence: number): FieldCard {
  const position =
    location === CardLocation.HAND
      ? CardPosition.FACEDOWN
      : location === CardLocation.MZONE
        ? CardPosition.FACEUP_ATTACK
        : CardPosition.FACEDOWN_DEFENSE
  return {
    instanceId: `card-${++fieldId}`,
    code,
    controller,
    owner: controller,
    location,
    sequence,
    position,
    overlayMaterials: [],
    duelistId: controller === 0 ? 'duelist_0_0' : 'duelist_1_0'
  }
}

function buildPuzzle(): ReturnType<typeof normalizeDuelState> {
  const cards: FieldCard[] = [
    makeCard(COST_DOWN, 0, CardLocation.HAND, 0),
    makeCard(BLUE_EYES, 0, CardLocation.HAND, 1),
    makeCard(GARGOYLE, 0, CardLocation.HAND, 2),
    makeCard(POT, 0, CardLocation.HAND, 3),
    makeCard(TRIBUTE, 0, CardLocation.MZONE, 0),
    ...Array.from({ length: 8 }, (_, index) => makeCard(BLUE_EYES, 0, CardLocation.DECK, index)),
    ...Array.from({ length: 8 }, (_, index) => makeCard(BLUE_EYES, 1, CardLocation.DECK, index))
  ]
  const duelists: Duelist[] = [
    { id: 'duelist_0_0', team: 0, name: '我方', lp: 8000, isFirst: true, turnOrder: 1 },
    { id: 'duelist_1_0', team: 1, name: '对方', lp: 8000, isFirst: false, turnOrder: 2 }
  ]
  return normalizeDuelState({
    version: '1.2.0',
    title: '等级 UI 传导联测',
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
    duelists,
    matchConfig: { mode: '1v1', team0Count: 1, team1Count: 1, sharedLp: false },
    scenarios: {}
  })
}

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
      duelEngineReplaceCard: (ref: unknown, newCode: number) =>
        Promise.resolve(duelSession.replaceCard(ref as never, newCode)),
      duelEngineRemoveCard: (ref: unknown) => Promise.resolve(duelSession.removeCard(ref as never)),
      duelEngineSetPolicy: () => Promise.resolve(undefined),
      duelEngineGetTimeline: () => Promise.resolve(duelSession.getTimeline()),
      duelEngineGetPendingRequest: () => Promise.resolve(duelSession.getPendingRequest()),
      duelEngineJumpToStep: (stepId: string) => Promise.resolve(duelSession.jumpToStep(stepId)),
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

function answerFor(request: EngineRequest): Answer {
  const data = request.data
  switch (data.kind) {
    case 'idle': {
      const spell = data.activatable.find((card) => card.code === COST_DOWN)
      if (spell) return { kind: 'idle', cmd: 'ACTIVATE', card: spell }
      const monster = data.summonable.find((card) => card.code === BLUE_EYES)
      if (monster) return { kind: 'idle', cmd: 'SUMMON', card: monster }
      return { kind: 'idle', cmd: 'TO_EP' }
    }
    case 'card': {
      const fodder = data.cards.find((card) => card.code === GARGOYLE)
      assert(Boolean(fodder), '丢弃候选中应有石像怪')
      return { kind: 'card', cards: [fodder!] }
    }
    case 'tribute': {
      const picks = data.cards.filter((card) => card.code === TRIBUTE)
      return { kind: 'tribute', cards: picks.slice(0, Math.max(1, data.min)) }
    }
    case 'place':
      return { kind: 'place', places: data.places.slice(0, Math.max(1, data.count)) }
    case 'chain':
      return { kind: 'chain', card: null }
    case 'yesno':
      return { kind: 'yesno', yes: false }
    case 'unselect':
      return { kind: 'unselect', card: null }
    case 'position':
      return { kind: 'position', position: data.positions[0] }
    case 'option':
      return { kind: 'option', index: 0 }
    case 'rps':
      return { kind: 'rps', hand: 'paper' }
    default:
      throw new Error(`未覆盖 kind=${data.kind}`)
  }
}

async function waitIdle(): Promise<void> {
  for (let guard = 0; guard < 40; guard++) {
    const pending = useDuelEngineStore.getState().pendingRequest
    if (!pending) return
    if (pending.data.kind === 'idle') return
    await useDuelEngineStore.getState().submitAnswer(answerFor(pending))
    assert(
      useDuelEngineStore.getState().error === null,
      `作答不应报错: ${useDuelEngineStore.getState().error}`
    )
  }
}

async function endTurn(): Promise<void> {
  await useDuelEngineStore.getState().submitAnswer({ kind: 'idle', cmd: 'TO_EP' })
  await waitIdle()
}

function boardBewd(): FieldCard | undefined {
  return useDuelStore
    .getState()
    .state.cards.find((card) => card.code === BLUE_EYES && card.location === CardLocation.MZONE)
}

async function main(): Promise<void> {
  installWindowApi()
  await cdbService.ready()
  useDuelStore.setState((prev) => ({ ...prev, state: buildPuzzle() }))
  useDuelEngineStore.getState().stopEngine()
  await useDuelEngineStore.getState().startEngine()
  assert(useDuelEngineStore.getState().isInitialized, '引擎应启动')
  await waitIdle()

  const idle = useDuelEngineStore.getState().pendingRequest
  assert(idle?.data.kind === 'idle', '应进入主要阶段')
  const spell = idle.data.activatable.find((card) => card.code === COST_DOWN)
  assert(Boolean(spell), '主要阶段应能发动代价降低')
  await useDuelEngineStore.getState().submitAnswer({
    kind: 'idle',
    cmd: 'ACTIVATE',
    card: spell!
  })
  await waitIdle()

  const handBewd = useDuelStore
    .getState()
    .state.cards.find((card) => card.code === BLUE_EYES && card.location === CardLocation.HAND)
  const engineHand = useDuelEngineStore
    .getState()
    .boardState?.allCards.find(
      (card) => card.code === BLUE_EYES && card.location === CardLocation.HAND
    )
  console.log('[level-ui] 引擎手牌青眼 level:', engineHand?.level)
  assert(engineHand?.level === 6, '代价降低后引擎手牌青眼等级应为 6')
  assert(Boolean(handBewd), '手牌应仍有青眼')

  const summonIdle = useDuelEngineStore.getState().pendingRequest
  assert(summonIdle?.data.kind === 'idle', '结算后应回到主要阶段')
  const monster = summonIdle.data.summonable.find((card) => card.code === BLUE_EYES)
  assert(Boolean(monster), '青眼应可祭品召唤')
  await useDuelEngineStore.getState().submitAnswer({
    kind: 'idle',
    cmd: 'SUMMON',
    card: monster!
  })
  await waitIdle()

  const fieldBewd = boardBewd()
  console.log('[level-ui] 召唤后场上青眼 customLevel:', fieldBewd?.customLevel)
  assert(fieldBewd?.customLevel === 6, '召唤后场上青眼 customLevel 应为 6')
  const summonNodeId = useDuelEngineStore.getState().currentStepId
  assert(Boolean(summonNodeId), '应能拿到召唤步骤节点')

  const steps = useDuelStore.getState().state.steps
  const summonIndex = steps.findIndex((step) =>
    step.boardAfter?.some((card) => card.code === BLUE_EYES && card.location === CardLocation.MZONE)
  )
  assert(summonIndex >= 0, '应记录青眼召唤步骤')
  const snapshotCard = steps[summonIndex].boardAfter?.find(
    (card) => card.code === BLUE_EYES && card.location === CardLocation.MZONE
  )
  console.log('[level-ui] 召唤步骤快照 customLevel:', snapshotCard?.customLevel)
  assert(snapshotCard?.customLevel === 6, '召唤步骤快照应保留 customLevel 6')

  useDuelStore.getState().previewStepBoard(summonIndex)
  const previewBewd = useDuelStore
    .getState()
    .state.cards.find((card) => card.code === BLUE_EYES && card.location === CardLocation.MZONE)
  console.log('[level-ui] 步骤预览场上青眼 customLevel:', previewBewd?.customLevel)
  assert(previewBewd?.customLevel === 6, '步骤预览应显示 customLevel 6')
  useDuelStore.getState().exitPreview()

  await endTurn()
  await endTurn()
  const afterTurn = boardBewd()
  console.log('[level-ui] 下一回合场上青眼 customLevel:', afterTurn?.customLevel)
  assert(afterTurn?.customLevel === undefined, '回合结束后 customLevel 应复位')

  await useDuelEngineStore.getState().jumpToStep(summonNodeId!)
  const jumpedBewd = boardBewd()
  console.log('[level-ui] 跳回召唤步骤场上青眼 customLevel:', jumpedBewd?.customLevel)
  assert(jumpedBewd?.customLevel === 6, '跳回召唤步骤应恢复 customLevel 6')

  console.log('[level-ui-smoke] ALL CHECKS PASSED')
  process.exit(0)
}

main().catch((err) => {
  console.error('[level-ui-smoke] FAILED:', err)
  process.exit(1)
})
