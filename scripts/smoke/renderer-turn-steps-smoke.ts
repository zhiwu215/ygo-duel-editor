/**
 * 渲染端回合同步联测：引擎模式经 store 真实链路（requestSlice → syncJumpToStepWrapped →
 * appendEngineStepFromAnswer → addStep）连续过回合
 *
 * 验证：
 * 1. 头部 currentTurn/activeTurnPlayer 始终等于引擎真值（不被 addStep 的手动重演推导打回）
 * 2. 步骤的 turn 字段保持作答时写入的值（先记录的步骤不被后续 addStep 重写）
 * 3. EP 手牌上限弃卡（kind=card 作答）要落成可见的送墓步骤，且头部仍正确
 */
import { duelSession } from '../../src/main/services/duel/duel-session'
import {
  CardLocation,
  CardPosition,
  Duelist,
  DuelStep,
  FieldCard,
  createLightweightSnapshot,
  normalizeDuelState
} from '@shared/index'
import type { EngineRequest, Answer } from '@shared/index'
import { useDuelEngineStore } from '../../src/renderer/src/stores/useDuelEngineStore'
import { useDuelStore } from '../../src/renderer/src/stores/useDuelStore'
import { cdbService } from './cdb-shim'

let fieldId = 0
function makeCard(
  code: number,
  controller: 0 | 1,
  location: number,
  sequence: number,
  position: number
): FieldCard {
  return {
    instanceId: `card-${++fieldId}`,
    code,
    controller,
    owner: controller,
    location,
    sequence,
    position,
    overlayMaterials: []
  }
}

function buildPuzzle(): ReturnType<typeof normalizeDuelState> {
  const cards: FieldCard[] = []
  for (const player of [0, 1] as const) {
    for (let i = 0; i < 30; i++) {
      cards.push(makeCard(89631139, player, CardLocation.DECK, i, CardPosition.FACEDOWN_DEFENSE))
    }
    for (let i = 0; i < 5; i++) {
      cards.push(makeCard(89631139, player, CardLocation.HAND, i, CardPosition.FACEDOWN))
    }
  }
  const duelists: Duelist[] = [
    { id: 'duelist_0_0', team: 0, name: '我方', lp: 8000, isFirst: true, turnOrder: 1 },
    { id: 'duelist_1_0', team: 1, name: '对方', lp: 8000, turnOrder: 2 }
  ]
  return normalizeDuelState({
    version: '1.2.0',
    title: '渲染端回合同步联测',
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

function autoAnswer(request: EngineRequest): Answer {
  const d = request.data
  switch (d.kind) {
    case 'rps':
      return { kind: 'rps', hand: 'paper' }
    case 'idle':
      return d.ssetable.length > 0
        ? { kind: 'idle', cmd: 'SSET', card: d.ssetable[0] }
        : { kind: 'idle', cmd: 'TO_EP' }
    case 'battle':
      return { kind: 'battle', cmd: 'TO_EP' }
    case 'yesno':
      return { kind: 'yesno', yes: false }
    case 'chain':
      return { kind: 'chain', card: null }
    case 'card':
      return d.cancelable
        ? { kind: 'card', cards: null }
        : { kind: 'card', cards: d.cards.slice(0, Math.max(1, d.min)) }
    case 'tribute':
      return d.cancelable
        ? { kind: 'tribute', cards: null }
        : { kind: 'tribute', cards: d.cards.slice(0, Math.max(1, d.min)) }
    case 'place':
      return { kind: 'place', places: d.places.slice(0, Math.max(1, d.count)) }
    case 'disfield':
      return { kind: 'disfield', places: d.places.slice(0, Math.max(1, d.count)) }
    case 'position':
      return { kind: 'position', position: d.positions[0] }
    case 'option':
      return { kind: 'option', index: 0 }
    case 'sort':
      return { kind: 'sort', cards: null }
    case 'unselect':
      return d.selectable.length > 0 && !d.finishable
        ? { kind: 'unselect', card: d.selectable[0] }
        : { kind: 'unselect', card: null }
    case 'announce':
      return d.announceType === 'number'
        ? { kind: 'announce', value: d.numbers![0] }
        : d.announceType === 'card'
          ? { kind: 'announce', value: 89631139 }
          : { kind: 'announce', value: d.availableMask ? d.availableMask & -d.availableMask : 1 }
    case 'counter':
      return { kind: 'counter', counters: [] }
    case 'sum':
      return { kind: 'sum', cards: [...d.mustSelect] }
    default:
      throw new Error(`autoAnswer 未覆盖 kind=${request.kind}`)
  }
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

async function main(): Promise<void> {
  installWindowApi()
  await cdbService.ready()

  const puzzle = buildPuzzle()
  useDuelStore.setState((prev) => ({
    ...prev,
    state: {
      ...puzzle,
      initialBoardSnapshot: createLightweightSnapshot(puzzle.cards)
    }
  }))
  useDuelEngineStore.getState().stopEngine()
  await useDuelEngineStore.getState().startEngine()
  assert(useDuelEngineStore.getState().isInitialized, 'startEngine 后引擎应处于激活状态')

  let ssetStepTurn: number | null = null
  let ssetStepTurnPlayer: number | null = null
  let cardAnswerSeen = false
  let answers = 0

  for (let i = 0; i < 24; i++) {
    const pending = useDuelEngineStore.getState().pendingRequest
    if (!pending || !duelSession.getPendingRequest()) {
      console.log(`[renderer-turn] 第 ${i + 1} 次作答前无待答请求，停止`)
      break
    }
    await useDuelEngineStore.getState().submitAnswer(autoAnswer(pending))
    answers++
    const err = useDuelEngineStore.getState().error
    assert(err === null, `作答不应报错: ${err}`)

    const store = useDuelStore.getState()
    const engineBoard = duelSession.getBoardState()
    const steps: DuelStep[] = store.state.steps || []
    const stepTurns = steps.map((s) => s.turn)
    const ssetStep = steps.find((s) => s.actionType === 'SET_SPELL_TRAP')
    if (ssetStep && ssetStepTurn === null) {
      ssetStepTurn = ssetStep.turn
      ssetStepTurnPlayer = ssetStep.turnPlayer
    }
    if (pending.kind === 'card') cardAnswerSeen = true
    console.log(
      `[renderer-turn] #${String(i + 1).padStart(2, '0')} ask=${pending.kind.padEnd(6)} → 头部=第${store.currentTurn}回合/行动方${store.activeTurnPlayer}/${store.currentPhase} 引擎=turn${engineBoard.turn}/player${engineBoard.turnPlayer} | 步骤${steps.length}条 turns=[${stepTurns.join(',')}]`
    )
    assert(
      store.currentTurn === engineBoard.turn,
      `头部回合(${store.currentTurn})与引擎回合(${engineBoard.turn})不同步`
    )
    assert(
      store.activeTurnPlayer === engineBoard.turnPlayer,
      `头部行动方(${store.activeTurnPlayer})与引擎(${engineBoard.turnPlayer})不同步`
    )
  }

  const store = useDuelStore.getState()
  const steps: DuelStep[] = store.state.steps || []
  const distinctTurns = new Set(steps.map((s) => s.turn))
  const engineTurn = duelSession.getBoardState().turn
  console.log(
    `[renderer-turn] 终态: 头部=第${store.currentTurn}回合 引擎=turn${engineTurn} 步骤${steps.length}条 回合值=[${[...distinctTurns].join(',')}] 弃卡作答=${cardAnswerSeen}`
  )

  let failed = false
  if (answers < 10) {
    console.log(`[renderer-turn] ❌ FAIL: 仅完成 ${answers} 次作答，样本不足`)
    failed = true
  }
  if (!cardAnswerSeen) {
    console.log('[renderer-turn] ❌ FAIL: 未覆盖 EP 弃卡（kind=card）作答路径')
    failed = true
  }
  const discardStep = steps.find(
    (s) => s.actionType === 'TO_GRAVE' && s.fromLocation === CardLocation.HAND
  )
  if (!discardStep) {
    console.log('[renderer-turn] ❌ FAIL: EP 手牌上限弃卡没有记录成送墓步骤')
    failed = true
  } else if (discardStep.phase !== 'EP') {
    console.log(`[renderer-turn] ❌ FAIL: 弃卡步骤阶段为 ${discardStep.phase}，期望 EP`)
    failed = true
  } else {
    console.log(
      `[renderer-turn] ✅ 弃卡步骤已记录: turn=${discardStep.turn} phase=${discardStep.phase} card=${discardStep.cardCode}`
    )
  }
  if (distinctTurns.size < 3) {
    console.log(
      `[renderer-turn] ❌ FAIL: 步骤回合值只有 ${distinctTurns.size} 种（[${[...distinctTurns].join(',')}]），步骤回合未随回合推进`
    )
    failed = true
  }
  if (store.currentTurn !== engineTurn) {
    console.log(
      `[renderer-turn] ❌ FAIL: 终态头部回合 ${store.currentTurn} ≠ 引擎回合 ${engineTurn}`
    )
    failed = true
  }
  if (ssetStepTurn !== null && ssetStepTurn !== 1) {
    console.log(
      `[renderer-turn] ❌ FAIL: 首个盖放步骤 turn=${ssetStepTurn}（作答时为第 1 回合），被后续推导重写`
    )
    failed = true
  } else if (ssetStepTurn === 1) {
    console.log('[renderer-turn] ✅ 首个盖放步骤保持 turn=1 未被重写')
  }
  if (ssetStepTurnPlayer !== null && ssetStepTurnPlayer !== 0) {
    console.log(
      `[renderer-turn] ❌ FAIL: 首个盖放步骤 turnPlayer=${ssetStepTurnPlayer}（作答时行动方为我方 0），被重写`
    )
    failed = true
  }

  console.log(failed ? '[renderer-turn] FAILED' : '[renderer-turn] ALL PASSED')
  process.exit(failed ? 1 : 0)
}

void main().catch((err) => {
  console.error('[renderer-turn] FAILED:', err)
  process.exit(1)
})
