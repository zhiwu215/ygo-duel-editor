import { duelSession } from '../../src/main/services/duel/duel-session'
import {
  CardLocation,
  CardPosition,
  Duelist,
  DuelStep,
  FieldCard,
  normalizeDuelState
} from '@shared/index'
import type { Answer, EngineRequest } from '@shared/index'
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
  const p0Deck = [23434538, 14558127, 70342110, 66518841, 97997309]
  const p1Deck = [23434538, 14558127, 70342110, 66518841, 97997309]
  const cards: FieldCard[] = [
    ...p0Deck.map((code, i) =>
      makeCard(code, 0, CardLocation.DECK, i, CardPosition.FACEDOWN_DEFENSE)
    ),
    makeCard(89631139, 0, CardLocation.MZONE, 0, CardPosition.FACEUP_ATTACK),
    makeCard(38517737, 0, CardLocation.HAND, 0, CardPosition.FACEUP_ATTACK),
    ...p1Deck.map((code, i) =>
      makeCard(code, 1, CardLocation.DECK, i, CardPosition.FACEDOWN_DEFENSE)
    )
  ]
  const duelists: Duelist[] = [
    { id: 'duelist_0_0', team: 0, name: '我方', lp: 8000, isFirst: true, turnOrder: 1 },
    { id: 'duelist_1_0', team: 1, name: '对方', lp: 8000, turnOrder: 2 }
  ]
  return normalizeDuelState({
    version: '1.2.0',
    title: '渲染端攻守转换联测',
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
      return { kind: 'idle', cmd: d.canEp ? 'TO_EP' : d.canBp ? 'TO_BP' : 'TO_EP' }
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
      return d.finishable
        ? { kind: 'unselect', card: null }
        : d.selectable.length > 0
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

  useDuelStore.setState((prev) => ({ ...prev, state: buildPuzzle() }))
  useDuelEngineStore.getState().stopEngine()
  await useDuelEngineStore.getState().startEngine()
  assert(useDuelEngineStore.getState().isInitialized, 'startEngine 后引擎应处于激活状态')

  let guard = 0
  while (duelSession.getPendingRequest()?.kind !== 'idle' && guard++ < 40) {
    const pending = duelSession.getPendingRequest()
    if (!pending) throw new Error('引擎没有待答请求')
    duelSession.submitAnswer(autoAnswer(pending))
  }
  assert(duelSession.getPendingRequest()?.kind === 'idle', '引擎应停在一个询问面板')

  const before = (useDuelStore.getState().state.steps || []).filter(
    (s) => s.actionType === 'CHANGE_POS'
  ).length

  await useDuelEngineStore.getState().submitAnswer({
    kind: 'idle',
    cmd: 'REPOS',
    card: { code: 89631139, controller: 0, location: CardLocation.MZONE, sequence: 0 }
  })

  assert(
    useDuelEngineStore.getState().error === null,
    `攻守转换不应报错: ${useDuelEngineStore.getState().error}`
  )
  const steps: DuelStep[] = useDuelStore.getState().state.steps || []
  const changePos = steps.filter((s) => s.actionType === 'CHANGE_POS')
  assert(
    changePos.length === before + 1,
    `变更表示形式应恰好记录一条，实际记录 ${changePos.length - before} 条`
  )
  console.log(
    `[renderer-repos] 攻守转换步骤记录 ${changePos.length - before} 条 - ALL CHECKS PASSED`
  )
}

void main().catch((err) => {
  console.error('[renderer-repos] FAILED:', err)
  process.exit(1)
})
