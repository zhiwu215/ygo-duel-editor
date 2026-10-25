/**
 * 手牌切洗展示时序联测：走真实渲染端 store 链路，验证切洗效果只在应用“包含
 * MSG_SHUFFLE_HAND 的步骤”时入队，且回放/引擎跳步重看该步骤时也会重新入队，
 * 而不是像旧实现那样只认 submitAnswer、用 Date.now() 做一次性信号。
 */
import { duelSession } from '../../src/main/services/duel/duel-session'
import { CardLocation, CardPosition, Duelist, FieldCard, normalizeDuelState } from '@shared/index'
import type { Answer, EngineRequest, EngineTimelineNode } from '@shared/index'
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
  const deck = [23434538, 14558127, 70342110, 66518841, 97997309]
  const cards: FieldCard[] = [
    makeCard(38517737, 0, CardLocation.HAND, 0, CardPosition.FACEDOWN),
    makeCard(89631139, 0, CardLocation.HAND, 1, CardPosition.FACEDOWN),
    makeCard(46986414, 0, CardLocation.HAND, 2, CardPosition.FACEDOWN),
    makeCard(70781052, 0, CardLocation.HAND, 3, CardPosition.FACEDOWN),
    makeCard(89631139, 0, CardLocation.HAND, 4, CardPosition.FACEDOWN),
    ...deck.map((code, i) =>
      makeCard(code, 0, CardLocation.DECK, i, CardPosition.FACEDOWN_DEFENSE)
    ),
    ...deck.map((code, i) => makeCard(code, 1, CardLocation.DECK, i, CardPosition.FACEDOWN_DEFENSE))
  ]

  const duelists: Duelist[] = [
    { id: 'duelist_0_0', team: 0, name: '我方', lp: 8000, isFirst: true, turnOrder: 1 },
    { id: 'duelist_1_0', team: 1, name: '对方', lp: 8000, isFirst: false, turnOrder: 2 }
  ]

  return normalizeDuelState({
    version: '1.2.0',
    title: '切洗时序联测',
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

function autoAnswer(request: EngineRequest, state: { summoned: boolean }): Answer {
  const d = request.data
  switch (d.kind) {
    case 'rps':
      return { kind: 'rps', hand: 'paper' }
    case 'idle': {
      const alternative = d.spSummonable.find((c) => c.location === CardLocation.HAND)
      if (alternative && !state.summoned) {
        state.summoned = true
        return { kind: 'idle', cmd: 'SPSUMMON', card: alternative }
      }
      return { kind: 'idle', cmd: d.canEp ? 'TO_EP' : d.canBp ? 'TO_BP' : 'TO_EP' }
    }
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
      return d.selectable.length > 0
        ? { kind: 'unselect', card: d.selectable[0] }
        : { kind: 'unselect', card: null }
    case 'announce':
      return d.announceType === 'number'
        ? { kind: 'announce', value: d.numbers![0] }
        : d.announceType === 'card'
          ? { kind: 'announce', value: 89631139 }
          : { kind: 'announce', value: d.availableMask ? d.availableMask & -d.availableMask : 1 }
    default:
      throw new Error(`autoAnswer 未覆盖 kind=${d satisfies never as string}`)
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
      duelEngineJumpToStep: (stepId: string) => Promise.resolve(duelSession.jumpToStep(stepId)),
      duelEngineGetPendingRequest: () => Promise.resolve(duelSession.getPendingRequest()),
      duelEngineSetPolicy: () => Promise.resolve(undefined),
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

function shuffleNodeOf(): EngineTimelineNode | undefined {
  return useDuelEngineStore
    .getState()
    .timeline.find(
      (node) =>
        node.events.some((event) => event.kind === 'shuffle-hand' && event.player === 0) &&
        node.boardState.players[0].hand.length > 0
    )
}

async function main(): Promise<void> {
  installWindowApi()
  await cdbService.ready()

  const puzzle = buildPuzzle()
  useDuelStore.setState((prev) => ({ ...prev, state: puzzle }))
  useDuelEngineStore.getState().stopEngine()
  await useDuelEngineStore.getState().startEngine()
  assert(useDuelEngineStore.getState().isInitialized, 'startEngine 后引擎应处于激活状态')

  const state = { summoned: false }
  let shuffleStepIndex = -1
  for (let i = 0; i < 30; i++) {
    const pending = useDuelEngineStore.getState().pendingRequest
    if (!pending) break
    await useDuelEngineStore.getState().submitAnswer(autoAnswer(pending, state))
    assert(useDuelEngineStore.getState().error === null, '作答不应报错')
    if (shuffleNodeOf()) {
      shuffleStepIndex = i
      break
    }
  }

  const shuffleNode = shuffleNodeOf()
  assert(shuffleNode !== undefined, '对局中没有产生包含 shuffle-hand 的步骤')
  const effectsAtStep = useDuelEngineStore.getState().stepEffects
  assert(effectsAtStep.length >= 1, '切洗步骤没有把手牌切洗效果加入播放队列')
  assert(effectsAtStep[0].kind === 'shuffle-hand', '队列首项不是手牌切洗')
  assert(effectsAtStep[0].player === 0, '切洗玩家应为 0')
  assert(
    effectsAtStep[0].duelistId === undefined,
    '1v1 的切洗效果不应绑定双打座位，否则单人手牌栏匹配不到'
  )
  const effectCount = effectsAtStep.length
  console.log(
    `[shuffle-timing] 第 ${shuffleStepIndex + 1} 次作答后入队 ${effectCount} 项: ${JSON.stringify(
      effectsAtStep.map((effect) => ({ kind: effect.kind, player: effect.player }))
    )}`
  )

  useDuelEngineStore.getState().finishStepEffect(effectsAtStep[0].id)
  assert(
    useDuelEngineStore.getState().stepEffects.length === effectCount - 1,
    'finishStepEffect 没有把已播放的效果移出队列'
  )

  for (let i = 0; i < 4; i++) {
    const pending = useDuelEngineStore.getState().pendingRequest
    if (!pending) break
    await useDuelEngineStore.getState().submitAnswer(autoAnswer(pending, state))
    assert(useDuelEngineStore.getState().error === null, '作答不应报错')
  }
  assert(useDuelEngineStore.getState().stepEffects.length === 0, '不含切洗的步骤不应残留播放效果')

  const jumped = await useDuelEngineStore.getState().jumpToStep(shuffleNode.id)
  assert(jumped, '跳回切洗步骤失败')
  const jumpEffects = useDuelEngineStore.getState().stepEffects
  assert(jumpEffects.length === effectCount, '跳回切洗步骤时没有重新播放切洗效果')
  assert(jumpEffects[0].kind === 'shuffle-hand', '跳步后的队列首项不是手牌切洗')
  console.log(
    `[shuffle-timing] 跳回切洗步骤后重新入队 ${jumpEffects.length} 项，当前手牌: [${useDuelStore
      .getState()
      .state.cards.filter((card) => card.controller === 0 && card.location === CardLocation.HAND)
      .sort((a, b) => a.sequence - b.sequence)
      .map((card) => card.code)
      .join(', ')}]`
  )

  const tagNode: EngineTimelineNode = {
    ...shuffleNode,
    events: [
      { kind: 'shuffle-hand', player: 0 },
      { kind: 'shuffle-hand', player: 1 }
    ],
    boardState: {
      ...shuffleNode.boardState,
      activeDuelist: ['duelist_0_0', 'duelist_1_0']
    }
  }
  useDuelEngineStore.getState().playStepEffects(tagNode)
  const queued = useDuelEngineStore.getState().stepEffects
  assert(queued.length === 2, '同一批消息里的两次切洗应排队播放')
  assert(
    queued[0].duelistId === 'duelist_0_0' && queued[1].duelistId === 'duelist_1_0',
    '切洗效果应按当前座位映射到对应决斗者'
  )
  useDuelEngineStore.getState().finishStepEffect(queued[0].id)
  assert(
    useDuelEngineStore.getState().stepEffects[0]?.id === queued[1].id,
    '前一个切洗播完后应轮到后一个'
  )
  useDuelEngineStore.getState().finishStepEffect(queued[1].id)
  assert(useDuelEngineStore.getState().stepEffects.length === 0, '队列播空后应清空')

  const shuffleSteps = (useDuelStore.getState().state.steps ?? []).filter((step) =>
    step.description?.includes('手牌切洗')
  )
  console.log(
    `[shuffle-timing] 步骤列表中标注「手牌切洗」的步骤: ${shuffleSteps.length}${
      shuffleSteps[0] ? `（${shuffleSteps[0].description}）` : ''
    }`
  )
  assert(shuffleSteps.length > 0, '引擎模式下的切洗步骤没有在步骤列表里留下「手牌切洗」标注')

  console.log('[shuffle-timing] PASS')
  process.exit(0)
}

main().catch((err) => {
  console.error('[shuffle-timing] FAILED:', err)
  process.exit(1)
})
