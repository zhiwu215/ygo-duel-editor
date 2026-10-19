/**
 * 手牌菜单冒烟测试：模拟「拖卡进手牌 → 启动规则校验 → 点击手卡」的渲染端匹配链路
 * 对比引擎 idle 清单与渲染端 deriveCardEngineActions 的结果
 */
import { duelSession } from '../../src/main/services/duel/duel-session'
import {
  CardLocation,
  CardPosition,
  Duelist,
  FieldCard,
  normalizeDuelState
} from '@shared/index'
import {
  deriveCardEngineActions,
  hasCardEngineActions
} from '../../src/renderer/src/utils/engineActions'
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
    // 模拟「拖进手牌」：FACEDOWN 位置 + 拖放产生的 sequence
    makeCard(38517737, 0, CardLocation.HAND, 0, CardPosition.FACEDOWN),
    makeCard(53129443, 0, CardLocation.HAND, 1, CardPosition.FACEDOWN),
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
    title: '手牌菜单联测',
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

function installWindowApi(): void {
  ;(globalThis as unknown as { window: unknown }).window = {
    api: {
      duelEngineInit: (params: unknown) => Promise.resolve(duelSession.startDuel(params as never)),
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

  const engine = useDuelEngineStore.getState()
  const request = engine.pendingRequest
  console.log('[hand-menu] pendingRequest kind:', request?.kind, 'player:', request?.player)

  const handCards = useDuelStore
    .getState()
    .state.cards.filter((c) => c.controller === 0 && c.location === CardLocation.HAND)
  console.log(
    '[hand-menu] 编辑器手牌:',
    handCards.map((c) => `${c.code}@seq${c.sequence}`).join(', ')
  )

  if (request?.data.kind === 'idle') {
    const d = request.data
    console.log(
      '[hand-menu] 引擎 idle 清单:',
      JSON.stringify({
        summonable: d.summonable.map((c) => `${c.code}@seq${c.sequence}`),
        spSummonable: d.spSummonable.map((c) => `${c.code}@seq${c.sequence}`),
        msetable: d.msetable.map((c) => `${c.code}@seq${c.sequence}`),
        ssetable: d.ssetable.map((c) => `${c.code}@seq${c.sequence}`),
        activatable: d.activatable.map((c) => `${c.code}@seq${c.sequence}`)
      })
    )
  }

  for (const card of handCards) {
    const actions = deriveCardEngineActions(request, card)
    console.log(
      `[hand-menu] 手卡 ${card.code}@seq${card.sequence}: hasActions=${hasCardEngineActions(request, card)}`,
      actions
        ? `summon=${Boolean(actions.summon)} spSummon=${Boolean(actions.spSummon)} activate=${actions.activate.length}`
        : '（请求不适用）'
    )
  }

  console.log('[hand-menu] DONE')
  process.exit(0)
}

void main().catch((err) => {
  console.error('[hand-menu] FAILED:', err)
  process.exit(1)
})
