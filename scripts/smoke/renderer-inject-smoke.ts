import { duelSession } from '../../src/main/services/duel/duel-session'
import {
  CardLocation,
  CardPosition,
  CardType,
  CardUtils,
  CdbCard,
  Duelist,
  FieldCard,
  normalizeDuelState
} from '@shared/index'
import type { Answer, EngineRequest } from '@shared/index'
import { useDuelEngineStore } from '../../src/renderer/src/stores/useDuelEngineStore'
import { useDuelStore } from '../../src/renderer/src/stores/useDuelStore'
import { cdbService } from './cdb-shim'
import { buildInjectCommand } from '../../src/renderer/src/utils/engineInject'
import { useEngineInjectDropStore } from '../../src/renderer/src/stores/useEngineInjectDropStore'

const EXTRA_CODES = [23995346, 44508094, 56840427, 1861629]

function cardOf(code: number): CdbCard {
  const card = cdbService.getCardById(code)
  assert(Boolean(card), `卡库应存在卡片 ${code}`)
  return card as CdbCard
}

function checkEditorExtraPlacements(): void {
  useDuelEngineStore.getState().stopEngine()
  useDuelStore.setState({
    state: buildPuzzle(),
    currentStepIndex: null,
    selectedStepId: null,
    previewReturn: null,
    sceneEditing: false
  })
  const deckCount = editorCards(CardLocation.DECK).length
  const ids: string[] = []
  for (const code of EXTRA_CODES) {
    const card = cardOf(code)
    assert(CardUtils.isExtraDeck(card.type), `${code} 应为额外卡组怪兽`)
    useDuelStore.getState().addCardToZone(card, 0, CardLocation.DECK, 0)
    const added = useDuelStore.getState().state.cards.find((item) => item.code === code)!
    assert(added.location === CardLocation.EXTRA, '编辑模式添加到主卡组应自动转入额外卡组')
    assert(added.sequence === 0, '自动转入额外卡组的新卡应放到顶部')
    assert(added.position === CardPosition.FACEDOWN_DEFENSE, '自动转入额外卡组应为里侧')
    ids.push(added.instanceId)
    const command = buildInjectCommand({
      card,
      controller: 0,
      location: CardLocation.DECK,
      sequence: 0,
      ctrlKey: false,
      masterRule: 5
    })
    assert(command?.op === 'add-card' && command.to === 'extra', '拖入主卡组应生成额外卡组指令')
    useEngineInjectDropStore.getState().open({
      card,
      controller: 0,
      location: CardLocation.DECK,
      sequence: 0
    })
    assert(
      useEngineInjectDropStore.getState().pending?.location === CardLocation.EXTRA,
      '引擎拖放选择应显示额外卡组目标'
    )
    useEngineInjectDropStore.getState().cancel()
  }
  assert(editorCards(CardLocation.DECK).length === deckCount, '自动归位不能改变主卡组')
  useDuelStore.getState().moveCard(ids[0], CardLocation.GRAVE, 0)
  useDuelStore.getState().moveCard(ids[0], CardLocation.DECK, 0)
  const moved = useDuelStore.getState().state.cards.find((card) => card.instanceId === ids[0])!
  const step = useDuelStore.getState().state.steps!.at(-1)!
  assert(moved.location === CardLocation.EXTRA, '已有卡片移入主卡组也应自动归位')
  assert(moved.sequence === 0, '已有卡片自动转入额外卡组时应放到顶部')
  assert(step.toLocation === CardLocation.EXTRA, '移动步骤应记录额外卡组')
  assert(step.toSequence === moved.sequence && step.toSequence >= 0, '步骤应记录实际插入序号')
  assert(step.description.includes('额外卡组'), '步骤说明应显示实际目标')
  const move = step.manualOps?.find((op) => op.type === 'move')
  assert(move?.type === 'move' && move.toLocation === CardLocation.EXTRA, '重放操作应使用额外卡组')
  useDuelStore.temporal.getState().undo()
  assert(
    useDuelStore.getState().state.cards.find((card) => card.instanceId === ids[0])?.location ===
      CardLocation.GRAVE,
    '撤销应恢复原区域'
  )
  useDuelStore.temporal.getState().redo()
  useDuelStore.getState().moveCards(
    ids.slice(1).map((instanceId) => ({
      instanceId,
      toLocation: CardLocation.GRAVE,
      toSequence: -1
    }))
  )
  useDuelStore.getState().moveCards(
    ids.slice(1).map((instanceId) => ({
      instanceId,
      toLocation: CardLocation.DECK,
      toSequence: 0
    }))
  )
  assert(
    ids.every(
      (id) =>
        useDuelStore.getState().state.cards.find((card) => card.instanceId === id)?.location ===
        CardLocation.EXTRA
    ),
    '批量移动也应自动归位'
  )
  assert(
    useDuelStore.getState().state.cards.find((card) => card.instanceId === ids.at(-1))?.sequence ===
      0,
    '批量移动时最后转入的卡应位于额外卡组顶部'
  )
  const pendulum = cdbService
    .findCardsByType(CardType.PENDULUM, 100)
    .find((card) => !CardUtils.isExtraDeck(card.type ?? 0))!
  assert(Boolean(pendulum), '应有主卡组灵摆怪兽作为对照')
  for (const code of [89631139, 54484652, pendulum.id]) {
    useDuelStore.getState().addCardToZone(cardOf(code), 0, CardLocation.DECK, 0)
    assert(editorCards(CardLocation.DECK, code).length > 0, '主卡组怪兽应保留在主卡组')
  }
  console.log('[renderer-inject] 编辑模式额外卡组自动归位: OK')
}

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
    makeCard(38517737, 0, CardLocation.HAND, 0, CardPosition.FACEUP_ATTACK),
    makeCard(53129443, 0, CardLocation.HAND, 1, CardPosition.FACEUP_ATTACK),
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
    title: '渲染端注入联测',
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
    case 'sum': {
      const picked = [...d.mustSelect]
      for (const card of d.cards) {
        if (picked.length >= d.count) break
        if (!picked.some((p) => p.code === card.code && p.sequence === card.sequence)) {
          picked.push(card)
        }
      }
      return { kind: 'sum', cards: picked }
    }
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
      duelEngineSetPolicy: () => Promise.resolve(undefined),
      duelEngineInject: (command: unknown) => Promise.resolve(duelSession.inject(command as never)),
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

function editorCards(location: number, code?: number): FieldCard[] {
  return useDuelStore
    .getState()
    .state.cards.filter(
      (c) =>
        c.controller === 0 && c.location === location && (code === undefined || c.code === code)
    )
}

async function main(): Promise<void> {
  installWindowApi()
  await cdbService.ready()
  checkEditorExtraPlacements()

  useDuelStore.setState((prev) => ({
    ...prev,
    state: buildPuzzle(),
    currentStepIndex: null,
    selectedStepId: null,
    previewReturn: null
  }))
  useDuelEngineStore.getState().stopEngine()
  await useDuelEngineStore.getState().startEngine()
  assert(useDuelEngineStore.getState().isInitialized, 'startEngine 后引擎应处于激活状态')
  assert(useDuelEngineStore.getState().error === null, 'startEngine 不应报错')

  let guard = 0
  while (duelSession.getPendingRequest()?.kind !== 'idle' && guard++ < 40) {
    const pending = duelSession.getPendingRequest()
    if (!pending) throw new Error('引擎没有待答请求')
    duelSession.submitAnswer(autoAnswer(pending))
  }

  const beforeHand = editorCards(CardLocation.HAND).length
  const handOk = await useDuelEngineStore.getState().inject({
    op: 'add-card',
    player: 0,
    code: 89631139,
    to: 'hand'
  })
  assert(handOk, '加入手牌注入应成功')
  assert(editorCards(CardLocation.HAND).length === beforeHand + 1, '引擎注入后编辑器手牌应 +1')
  assert(editorCards(CardLocation.HAND, 89631139).length === 1, '编辑器手牌中应出现注入卡')
  assert(useDuelEngineStore.getState().injectNotice !== null, '注入成功后应写入 toast 提示')
  console.log(
    `[renderer-inject] 加入手牌: 手牌 ${beforeHand} -> ${editorCards(CardLocation.HAND).length}`
  )

  const graveOk = await useDuelEngineStore.getState().inject({
    op: 'add-card',
    player: 0,
    code: 46986414,
    to: 'grave-top'
  })
  assert(graveOk, '置于墓地注入应成功')
  assert(editorCards(CardLocation.GRAVE, 46986414).length === 1, '编辑器墓地中应出现注入卡')
  console.log('[renderer-inject] 置于墓地: 编辑器墓地已出现注入卡')

  const fieldOk = await useDuelEngineStore.getState().inject({
    op: 'add-card',
    player: 0,
    code: 38517737,
    to: 'mzone',
    sequence: 2
  })
  assert(fieldOk, '放置到怪兽区注入应成功')
  assert(
    editorCards(CardLocation.MZONE, 38517737).some((c) => c.sequence === 2),
    '编辑器怪兽区应出现注入卡'
  )
  console.log('[renderer-inject] 放置到怪兽区: 编辑器场上已出现注入卡')

  const beforeExtraNode = duelSession.getTimeline().at(-1)!
  const beforeExtraCount = editorCards(CardLocation.EXTRA).length
  const beforeDeckCount = editorCards(CardLocation.DECK).length
  for (const code of EXTRA_CODES) {
    for (const to of ['deck-top', 'deck-bottom', 'deck-shuffle'] as const) {
      const beforeCount = editorCards(CardLocation.EXTRA).length
      const ok = await useDuelEngineStore.getState().inject({ op: 'add-card', player: 0, code, to })
      assert(ok, '额外怪兽注入主卡组应成功')
      assert(editorCards(CardLocation.EXTRA).length === beforeCount + 1, '额外卡组数量应增加')
      assert(editorCards(CardLocation.DECK).length === beforeDeckCount, '主卡组数量应不变')
      const notice = useDuelEngineStore.getState().injectNotice!
      assert(notice.kind === 'success', '自动归位应提示成功')
      assert(notice.message.includes('加入额外卡组'), '提示应说明实际加入额外卡组')
      assert(!notice.message.includes('引擎未将卡片'), '不应误报放置失败')
      assert(
        useDuelStore
          .getState()
          .state.initialBoardSnapshot!.filter((card) => card.location === CardLocation.EXTRA)
          .length ===
          beforeCount + 1,
        '初始布景应同步额外卡组中的注入卡'
      )
    }
  }
  const afterExtraNode = duelSession.getTimeline().at(-1)!
  const doc = duelSession.exportSessionDoc()
  await duelSession.importSessionDoc(doc)
  assert(
    duelSession.getBoardState().players[0].extraCount === beforeExtraCount + 12,
    '恢复会话应保留归位结果'
  )
  await duelSession.jumpToStep(beforeExtraNode.id)
  assert(duelSession.getBoardState().players[0].extraCount === beforeExtraCount, '回退应移除注入卡')
  await duelSession.jumpToStep(afterExtraNode.id)
  assert(
    duelSession.getBoardState().players[0].extraCount === beforeExtraCount + 12,
    '重放应恢复归位结果'
  )
  console.log('[renderer-inject] 引擎模式自动归位、成功提示与会话重放: OK')

  assert(useDuelEngineStore.getState().error === null, '注入链全程不应报错')
  console.log('[renderer-inject] ALL CHECKS PASSED')
}

void main().catch((err) => {
  console.error('[renderer-inject] FAILED:', err)
  process.exit(1)
})
