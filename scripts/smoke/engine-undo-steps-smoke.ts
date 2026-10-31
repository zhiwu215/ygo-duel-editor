/**
 * 引擎撤销与步骤行联测：
 *
 * 1. 诱发类效果以「是否发动」作答时要单独记成一步（否则整条连锁塌进上一个动作，Ctrl+Z 会回退整个阶段）
 * 2. 单次撤销只回到上一个已记录步骤的节点
 * 3. 撤销后继续作答时，步骤行只由保留的时间线节点重算：不含被丢弃节点的行，也不重复追加
 */
import { duelSession } from '../../src/main/services/duel/duel-session'
import {
  CardLocation,
  CardPosition,
  DuelLogEvent,
  DuelStep,
  FieldCard,
  createLightweightSnapshot,
  normalizeDuelState
} from '@shared/index'
import type { EngineRequest, Answer } from '@shared/index'
import { useDuelEngineStore } from '../../src/renderer/src/stores/useDuelEngineStore'
import { useDuelStore } from '../../src/renderer/src/stores/useDuelStore'
import { cdbService } from './cdb-shim'

const SPINODIONAEA = 35272499
const SARRACENIANT = 44932065
const DARLINGTONIA = 61677004
const FILLER = 89631139

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
  const hand = [SPINODIONAEA, FILLER, FILLER, FILLER, FILLER]
  hand.forEach((code, i) =>
    cards.push(makeCard(code, 0, CardLocation.HAND, i, CardPosition.FACEDOWN))
  )
  for (let i = 0; i < 5; i++) {
    cards.push(makeCard(FILLER, 1, CardLocation.HAND, i, CardPosition.FACEDOWN))
  }
  const deck = [SARRACENIANT, DARLINGTONIA, SARRACENIANT, DARLINGTONIA]
  for (let i = 0; i < 30; i++) {
    cards.push(makeCard(deck[i] ?? FILLER, 0, CardLocation.DECK, i, CardPosition.FACEDOWN_DEFENSE))
  }
  for (let i = 0; i < 30; i++) {
    cards.push(makeCard(FILLER, 1, CardLocation.DECK, i, CardPosition.FACEDOWN_DEFENSE))
  }
  return normalizeDuelState({
    version: '1.2.0',
    title: '引擎撤销联测',
    hint: '',
    duelType: 'full',
    masterRule: 5,
    players: [
      { lp: 8000, maxHand: 0, startHand: 5 },
      { lp: 8000, maxHand: 0, startHand: 5 }
    ],
    turnPlayer: 0 as 0 | 1,
    firstTurnAttack: true,
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

function answerOf(request: EngineRequest): Answer {
  const d = request.data
  switch (d.kind) {
    case 'rps':
      return { kind: 'rps', hand: 'paper' }
    case 'idle': {
      const normal = d.summonable[0]
      if (normal) return { kind: 'idle', cmd: 'SUMMON', card: normal }
      const activate = d.activatable[0]
      if (activate) return { kind: 'idle', cmd: 'ACTIVATE', card: activate }
      return { kind: 'idle', cmd: 'TO_EP' }
    }
    case 'battle':
      return { kind: 'battle', cmd: 'TO_EP' }
    case 'yesno':
      return { kind: 'yesno', yes: true }
    case 'chain':
      return d.chains.length > 0
        ? { kind: 'chain', card: d.chains[0] }
        : { kind: 'chain', card: null }
    case 'card': {
      const target = request.title.includes('特殊召唤')
        ? d.cards.find((card) => card.code === DARLINGTONIA)
        : undefined
      const picked = target ?? d.cards[0]
      return picked ? { kind: 'card', cards: [picked] } : { kind: 'card', cards: null }
    }
    case 'place':
      return { kind: 'place', places: d.places.slice(0, Math.max(1, d.count)) }
    case 'position':
      return { kind: 'position', position: d.positions[0] }
    case 'option':
      return { kind: 'option', index: 0 }
    case 'tribute':
      return d.cancelable
        ? { kind: 'tribute', cards: null }
        : { kind: 'tribute', cards: d.cards.slice(0, Math.max(1, d.min)) }
    case 'disfield':
      return { kind: 'disfield', places: d.places.slice(0, Math.max(1, d.count)) }
    case 'sort':
      return { kind: 'sort', cards: null }
    case 'unselect':
      return { kind: 'unselect', card: null }
    case 'counter':
      return { kind: 'counter', counters: [] }
    case 'sum':
      return { kind: 'sum', cards: [...d.mustSelect] }
    case 'announce':
      return d.announceType === 'number'
        ? { kind: 'announce', value: d.numbers![0] }
        : d.announceType === 'card'
          ? { kind: 'announce', value: FILLER }
          : { kind: 'announce', value: d.availableMask ? d.availableMask & -d.availableMask : 1 }
    default:
      throw new Error(`answerOf 未覆盖 kind=${request.kind}`)
  }
}

function installWindowApi(): void {
  ;(globalThis as unknown as { window: unknown }).window = {
    api: {
      duelEngineInit: (params: unknown) => Promise.resolve(duelSession.startDuel(params as never)),
      duelEngineSubmitAnswer: (answer: unknown) =>
        Promise.resolve(duelSession.submitAnswer(answer as never)),
      duelEngineJumpToStep: (stepId: string) => Promise.resolve(duelSession.jumpToStep(stepId)),
      duelEngineGetPendingRequest: () => Promise.resolve(duelSession.getPendingRequest()),
      duelEngineSetPolicy: (policy: unknown) =>
        Promise.resolve(duelSession.setTimingPolicy(policy as never)),
      duelEngineGetTimeline: () => Promise.resolve(duelSession.getTimeline()),
      getDuelEngineSupport: () => Promise.resolve({ supported: true }),
      getCardsByIds: (ids: number[]) => {
        const out: Record<number, unknown> = {}
        for (const id of ids) out[id] = cdbService.getCardById(id)
        return Promise.resolve(out)
      },
      saveConfig: () => Promise.resolve(),
      getConfig: () => Promise.resolve({}),
      onCardImageUpdated: () => () => undefined,
      onCustomCardsUpdated: () => () => undefined
    }
  }
  ;(globalThis as unknown as { document: unknown }).document = {
    addEventListener: () => undefined,
    removeEventListener: () => undefined
  }
}

function assert(condition: boolean, message: string): void {
  if (!condition) throw new Error(`断言失败: ${message}`)
}

function steps(): DuelStep[] {
  return useDuelStore.getState().state.steps || []
}

function eventKinds(step: DuelStep): string[] {
  return (step.logEvents ?? []).map((event: DuelLogEvent) => event.kind)
}

async function answers(): Promise<void> {
  const pending = useDuelEngineStore.getState().pendingRequest
  if (!pending) return
  await useDuelEngineStore.getState().submitAnswer(answerOf(pending))
  const error = useDuelEngineStore.getState().error
  assert(error === null, `作答不应报错：${error}`)
}

async function main(): Promise<void> {
  installWindowApi()
  await cdbService.ready()

  const puzzle = buildPuzzle()
  useDuelStore.setState((prev) => ({
    ...prev,
    state: { ...puzzle, initialBoardSnapshot: createLightweightSnapshot(puzzle.cards) }
  }))
  useDuelEngineStore.getState().stopEngine()
  await useDuelEngineStore.getState().startEngine()
  assert(useDuelEngineStore.getState().isInitialized, 'startEngine 后引擎应处于激活状态')

  let activationSeen = false
  let activationStep: DuelStep | undefined
  let summonStep: DuelStep | undefined
  for (let i = 0; i < 14; i++) {
    const pending = useDuelEngineStore.getState().pendingRequest
    if (!pending) break
    const wasIdle = pending.kind === 'idle'
    await answers()
    const recorded = steps().find((step) => step.actionType === 'ACTIVATE')
    if (recorded && !activationSeen) {
      activationSeen = true
      activationStep = recorded
      summonStep = steps().find((step) => step.actionType === 'NORMAL_SUMMON')
      assert(Boolean(summonStep), '通常召唤应记录为一步')
      assert(
        !eventKinds(summonStep!).includes('activate'),
        '诱发类效果的发动不应再并进召唤步骤的行'
      )
      console.log(
        `[undo-steps] ✅ 诱发类效果单独成步：${recorded.cardName} logEvents=${eventKinds(recorded).length}`
      )
    }
    if (wasIdle && activationSeen) break
  }
  assert(activationSeen, '未遇到「是否发动」的诱发类效果询问，无法验证单独成步')

  const stepCount = steps().length
  const beforeNode = useDuelEngineStore.getState().currentStepId
  const timeline = useDuelEngineStore.getState().timeline
  const beforeIndex = timeline.findIndex((node) => node.id === beforeNode)
  const summonIndex = timeline.findIndex(
    (node) => node.id === (summonStep!.startActId ?? summonStep!.actId)
  )
  assert(beforeIndex > 0, '撤销前应停在时间线末端')

  await useDuelEngineStore.getState().undo()
  const afterNode = useDuelEngineStore.getState().currentStepId
  const afterIndex = timeline.findIndex((node) => node.id === afterNode)
  const activationNow = steps().find((step) => step.id === activationStep!.id)
  assert(Boolean(activationNow), '撤销后步骤不应丢失')
  assert(
    afterNode === activationStep!.startActId,
    '单次撤销应回到上一个已记录步骤的起始节点，而不是更早的节点'
  )
  assert(summonIndex >= 0 && summonIndex < afterIndex, '撤销不应越过召唤步骤、退回到阶段起点')
  assert(steps().length === stepCount, '仅撤销不应删除后续步骤')
  assert(
    eventKinds(activationNow!).join(',') === 'activate',
    `撤销到该步骤起点时只应保留发动行，实际 ${eventKinds(activationNow!).join(',')}`
  )
  console.log(
    `[undo-steps] ✅ 单次撤销 ${beforeIndex} → ${afterIndex}（落在发动步骤起点），该步骤行已收缩到发动`
  )

  const activationId = activationStep!.id
  await answers()
  const extended = steps().find((step) => step.id === activationId)
  assert(Boolean(extended), '撤销后继续作答应沿用同一步骤，而不是新增重复步骤')
  const kinds = eventKinds(extended!)
  assert(kinds[0] === 'activate', '继续作答后仍应从发动行开头')
  assert(kinds.filter((kind) => kind === 'activate').length === 1, '继续作答后不应重复出现发动行')
  assert(kinds.includes('chain-solving'), '继续作答后应补上效果处理行')
  assert(!kinds.includes('chain-end'), '被丢弃的连锁结束行不应残留')
  assert(kinds.filter((kind) => kind === 'summon').length <= 1, '被丢弃的特殊召唤行不应残留')
  assert(
    steps().every((step) => step.id === activationId || step.actionType !== 'PHASE_CHANGE'),
    '撤销后继续作答应丢弃之后的阶段步骤'
  )
  console.log(`[undo-steps] ✅ 继续作答后行重算正确：${kinds.join(',')}`)

  console.log('[undo-steps] ALL PASSED')
  process.exit(0)
}

void main().catch((err) => {
  console.error('[undo-steps] FAILED:', err)
  process.exit(1)
})
