/**
 * 会话挂起冒烟：验证退出引擎保留快照与盘面指纹、重开台本后指纹一致可继续、旧步骤降级为历史。
 */
import {
  CardLocation,
  CardPosition,
  boardFingerprintMatches,
  computeBoardFingerprint,
  normalizeDuelState,
  parseDuelDocumentJson,
  summarizeStepProvenance,
  type DuelDocument,
  type DuelStep,
  type EngineBoardState,
  type EngineSessionDoc,
  type EngineTimelineNode,
  type FieldCard
} from '@shared/index'
import { useDuelStore } from '../../src/renderer/src/stores/useDuelStore'
import { useDuelEngineStore } from '../../src/renderer/src/stores/useDuelEngineStore'
import { openDuelDocument } from '../../src/renderer/src/utils/duelDocumentActions'
import { buildDuelDocument } from '../../src/renderer/src/utils/duelDocumentBuild'
import { detachStepsFromTimeline } from '../../src/renderer/src/utils/stepHistory'

function assert(condition: boolean, message: string): void {
  if (!condition) throw new Error(`断言失败: ${message}`)
}

function makeDeckCard(instanceId: string, sequence: number): FieldCard {
  return {
    instanceId,
    code: 900000000,
    controller: 0,
    owner: 0,
    location: CardLocation.DECK,
    sequence,
    position: CardPosition.FACEDOWN_DEFENSE,
    overlayMaterials: []
  }
}

const engineBoard: EngineBoardState = {
  turn: 1,
  turnPlayer: 0,
  phase: 1,
  phaseName: '主要阶段 1',
  players: [
    {
      player: 0,
      lp: 8000,
      maxLp: 8000,
      deckCount: 2,
      extraCount: 0,
      graveCount: 0,
      removedCount: 0
    },
    {
      player: 1,
      lp: 8000,
      maxLp: 8000,
      deckCount: 0,
      extraCount: 0,
      graveCount: 0,
      removedCount: 0
    }
  ],
  allCards: []
}

const node: EngineTimelineNode = {
  id: 'step-1-test',
  parentId: null,
  stepNumber: 1,
  title: '决斗开局',
  player: 0,
  logs: [],
  events: [],
  logEvents: [],
  boardState: engineBoard,
  pendingRequest: null,
  opIndex: -1,
  createdAt: 1
}

const engineStep: DuelStep = {
  id: 'step_engine',
  turn: 1,
  turnPlayer: 0,
  phase: 'M1',
  actionPlayer: 0,
  actionType: 'NORMAL_SUMMON',
  cardName: '魔鬼机车',
  description: '我方：通常召唤 [魔鬼机车]',
  origin: 'engine',
  actId: 'step-2-test',
  startActId: 'step-2-test',
  endActId: 'step-3-test',
  boardAfter: [
    {
      instanceId: 'card-a',
      code: 900000000,
      controller: 0,
      location: CardLocation.DECK,
      sequence: 1,
      position: CardPosition.FACEDOWN_DEFENSE,
      overlayMaterials: []
    },
    {
      instanceId: 'card-b',
      code: 900000000,
      controller: 0,
      location: CardLocation.DECK,
      sequence: 0,
      position: CardPosition.FACEDOWN_DEFENSE,
      overlayMaterials: []
    }
  ]
}

const manualStep: DuelStep = {
  id: 'step_manual',
  turn: 1,
  turnPlayer: 0,
  phase: 'M1',
  actionPlayer: 0,
  actionType: 'EVENT',
  description: '场外说明',
  origin: 'manual'
}

const sessionDoc: EngineSessionDoc = {
  version: 1,
  seed: [1, 2, 3, 4, 5, 6, 7, 8],
  initParams: {},
  ops: [],
  timeline: [node],
  currentStepId: node.id,
  timingPolicy: { chain: 'smart', effectYn: 'ask' }
}

const engineOrderState = normalizeDuelState({
  version: '1.2.0',
  title: '会话挂起测试',
  hint: '',
  duelType: 'full',
  masterRule: 5,
  players: [
    { lp: 8000, maxHand: 0, startHand: 0 },
    { lp: 8000, maxHand: 0, startHand: 0 }
  ],
  turnPlayer: 0 as 0 | 1,
  firstTurnAttack: false,
  cards: [makeDeckCard('card-a', 1), makeDeckCard('card-b', 0)],
  steps: [engineStep, manualStep],
  duelists: [
    { id: 'duelist_0_0', team: 0, name: '我方', lp: 8000, isFirst: true, turnOrder: 1 },
    { id: 'duelist_1_0', team: 1, name: '对方', lp: 8000, turnOrder: 2 }
  ],
  matchConfig: { mode: '1v1', team0Count: 1, team1Count: 1, sharedLp: false },
  scenarios: {}
})

const normalOrderState = normalizeDuelState({
  ...engineOrderState,
  cards: [makeDeckCard('card-a', 0), makeDeckCard('card-b', 1)]
})

let storedDocument: DuelDocument | null = null
let engineSupported = true

;(globalThis as unknown as { localStorage: unknown }).localStorage = {
  getItem: () => null,
  setItem: () => undefined,
  removeItem: () => undefined
}
;(globalThis as unknown as { window: unknown }).window = {
  api: {
    getDuelEngineSessionDoc: async () => ({ success: true, doc: sessionDoc }),
    restoreDuelEngineSession: async () => ({
      success: true,
      payload: {
        initParams: sessionDoc.initParams,
        boardState: engineBoard,
        pendingRequest: null,
        timeline: [node],
        currentStepId: node.id
      }
    }),
    getDuelEngineSupport: async () => ({ supported: engineSupported }),
    readDuelDocument: async (filePath: string) =>
      storedDocument
        ? { success: true, filePath, document: storedDocument }
        : { success: false, filePath, error: '没有存档' },
    saveDuelDocument: async (filePath: string) => ({ success: true, filePath }),
    duelEngineExitReplay: async () => ({ success: true })
  }
}

useDuelStore.setState({
  state: engineOrderState,
  currentProjectPath: 'C:/tmp/session-suspend.ygoduel',
  previewReturn: null,
  currentStepIndex: null,
  selectedStepId: null
})
useDuelEngineStore.setState({
  isInitialized: true,
  engineMode: 'running',
  loading: false,
  replayInfo: null,
  preReplay: null,
  suspendedDoc: null,
  timeline: [node],
  currentStepId: node.id,
  boardState: engineBoard,
  pendingRequest: null
})

async function checkSuspend(): Promise<DuelDocument> {
  await useDuelEngineStore.getState().suspendEngine()
  const engine = useDuelEngineStore.getState()
  assert(engine.isInitialized === false, '挂起后引擎应停止')
  assert(engine.suspendedDoc !== null, '挂起后应保留会话快照')
  assert(engine.suspendedDoc?.suspended === true, '快照应标记为已挂起')
  const suspendedFingerprint = engine.suspendedDoc?.boardFingerprint
  assert(Boolean(suspendedFingerprint), '快照应带盘面指纹')
  assert(
    boardFingerprintMatches(suspendedFingerprint, computeBoardFingerprint(normalOrderState)),
    '引擎内牌序与正常牌序应得到相同指纹'
  )

  const cards = useDuelStore.getState().state.cards
  assert(
    cards.find((card) => card.instanceId === 'card-a')?.sequence === 0,
    '挂起后主卡组应恢复正常牌序'
  )
  const step = useDuelStore.getState().state.steps?.[0]
  assert(step?.boardAfter?.[0]?.sequence === 0, '挂起后步骤快照应恢复正常牌序')

  const document = await buildDuelDocument()
  assert(document.engine === engine.suspendedDoc, '挂起保存的文档应携带会话快照')
  const roundTrip = parseDuelDocumentJson(JSON.stringify(document))
  assert(roundTrip.engine?.suspended === true, '存档应保留挂起标记')
  assert(Boolean(roundTrip.engine?.boardFingerprint), '存档应保留盘面指纹')
  return document
}

async function checkReopen(document: DuelDocument): Promise<void> {
  storedDocument = document
  const result = await openDuelDocument('C:/tmp/session-suspend.ygoduel')
  assert(result.success, '应能重新打开挂起中的台本')
  const engine = useDuelEngineStore.getState()
  assert(engine.isInitialized === false, '重开后不应自动恢复引擎')
  assert(engine.suspendedDoc !== null, '重开后应保留可继续的会话快照')
  assert(
    boardFingerprintMatches(
      engine.suspendedDoc?.boardFingerprint,
      computeBoardFingerprint(useDuelStore.getState().state)
    ),
    '重开后盘面指纹应一致'
  )
  const opened = useDuelStore.getState()
  assert(opened.previewReturn === null, '重开后不应进入步骤预览')
  assert(opened.currentStepIndex === 1, '重开后应停在最后一条步骤')
  assert((opened.state.steps ?? []).length === 2, '重开后步骤不应丢失')
  assert(opened.state.steps?.[0]?.actId === 'step-2-test', '重开后引擎步骤仍应保留时间线引用')
}

async function checkResume(): Promise<void> {
  const restored = await useDuelEngineStore.getState().resumeSuspended()
  assert(restored, '应能继续挂起的会话')
  const engine = useDuelEngineStore.getState()
  assert(engine.isInitialized === true, '继续后引擎应恢复运行')
  assert(engine.suspendedDoc === null, '继续后应清空挂起快照')
  const step = useDuelStore.getState().state.steps?.[0]
  assert(step?.boardAfter?.[0]?.sequence === 1, '继续后步骤快照应回到引擎内牌序')
  assert(step?.actId === 'step-2-test', '继续后步骤仍应绑定引擎时间线')
}

async function checkEngineReopen(): Promise<void> {
  const document = await buildDuelDocument()
  assert(Boolean(document.engine), '运行中保存应带会话快照')
  assert(document.engine?.suspended !== true, '运行中保存不应标记为挂起')
  storedDocument = document
  const result = await openDuelDocument('C:/tmp/session-running.ygoduel')
  assert(result.success, '应能重新打开运行中的台本')
  const engine = useDuelEngineStore.getState()
  assert(engine.isInitialized === true, '运行中台本重开应自动恢复引擎')
  assert(engine.suspendedDoc === null, '自动恢复后不应保留挂起快照')
  assert(engine.currentStepId === node.id, '自动恢复后应停在原步骤')
}

async function checkUnsupportedReopen(): Promise<void> {
  engineSupported = false
  storedDocument = {
    state: structuredClone(engineOrderState),
    engine: structuredClone(sessionDoc)
  }
  const result = await openDuelDocument('C:/tmp/session-unsupported.ygoduel')
  assert(result.success, '不支持内置引擎时也应能打开台本')
  const engine = useDuelEngineStore.getState()
  assert(engine.isInitialized === false, '不支持内置引擎时不应恢复会话')
  assert(engine.suspendedDoc?.suspended === true, '不支持内置引擎时应把会话保留为挂起')
  const card = useDuelStore.getState().state.cards.find((item) => item.instanceId === 'card-a')
  assert(card?.sequence === 0, '不支持内置引擎时应恢复正常牌序')
  assert(
    boardFingerprintMatches(
      engine.suspendedDoc?.boardFingerprint,
      computeBoardFingerprint(useDuelStore.getState().state)
    ),
    '不支持内置引擎时挂起快照应记录正常牌序的指纹'
  )
  engineSupported = true
  const restored = await engine.resumeSuspended()
  assert(restored, '恢复引擎支持后应能继续该会话')
  assert(useDuelEngineStore.getState().isInitialized === true, '继续后引擎应恢复运行')
}

function checkDetach(): void {
  const [detachedEngine, detachedManual] = detachStepsFromTimeline([engineStep, manualStep])
  assert(!detachedEngine.actId && !detachedEngine.endActId, '历史步骤应移除时间线引用')
  assert(detachedEngine.origin === 'engine', '历史步骤应保留引擎来源')
  assert(detachedEngine.description === engineStep.description, '历史步骤应保留台本描述')
  assert(detachedEngine.boardAfter?.length === 2, '历史步骤应保留场面快照')
  assert(detachedManual.origin === 'manual', '手动步骤不应被改写')
  const provenance = summarizeStepProvenance([detachedEngine, detachedManual])
  assert(provenance.stepCount === 2, `来源统计应覆盖全部步骤，实际 ${provenance.stepCount}`)
  assert(
    provenance.engineStepCount === 1,
    `来源统计应保留引擎步骤，实际 ${provenance.engineStepCount}`
  )
  assert(
    provenance.manualStepCount === 1,
    `来源统计应保留手动步骤，实际 ${provenance.manualStepCount}`
  )
  const legacy = summarizeStepProvenance([{ ...engineStep, origin: undefined }])
  assert(legacy.engineStepCount === 1, '旧文档中带时间线引用的步骤应视为引擎步骤')
}

async function main(): Promise<void> {
  const document = await checkSuspend()
  await checkReopen(document)
  await checkResume()
  await checkEngineReopen()
  await checkUnsupportedReopen()
  checkDetach()
  console.log('[session-suspend-smoke] ok')
}

void main()
