/**
 * 投骰子 / 投硬币联测：圣杯A、圣杯情侣双A与天使的骰子结算时，
 * 会话必须把 MSG_TOSS_COIN / MSG_TOSS_DICE 记成步骤事件与日志事件，
 * 界面才能像 ygopro 一样把「投掷硬币结果：[正面]」「投掷骰子结果：[3]」显示出来。
 */
import { duelSession } from '../../src/main/services/duel/duel-session'
import {
  CardLocation,
  CardPosition,
  Duelist,
  FieldCard,
  formatTossResult,
  normalizeDuelState
} from '@shared/index'
import type {
  Answer,
  DuelLogEvent,
  EngineRequest,
  EngineStepEvent,
  EngineTimelineNode
} from '@shared/index'
import { cdbService } from './cdb-shim'

const CUP_OF_ACE = 37812118
const COUPLE_OF_ACES = 26259179
const GRACEFUL_DICE = 74137509
const BLUE_EYES = 89631139

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

function buildPuzzle(coinCard: number): ReturnType<typeof normalizeDuelState> {
  const deck = [BLUE_EYES, 46986414, 70781052, 23434538, 14558127, 70342110, 66518841, 97997309]
  const cards: FieldCard[] = [
    makeCard(coinCard, 0, CardLocation.HAND, 0, CardPosition.FACEDOWN),
    makeCard(GRACEFUL_DICE, 0, CardLocation.HAND, 1, CardPosition.FACEDOWN),
    makeCard(BLUE_EYES, 0, CardLocation.HAND, 2, CardPosition.FACEDOWN),
    makeCard(BLUE_EYES, 0, CardLocation.MZONE, 0, CardPosition.FACEUP_ATTACK),
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
    title: '投掷联测',
    hint: [],
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

function autoAnswer(request: EngineRequest, activated: Set<number>, coinCard: number): Answer {
  const d = request.data
  switch (d.kind) {
    case 'rps':
      return { kind: 'rps', hand: 'paper' }
    case 'idle': {
      for (const code of [coinCard, GRACEFUL_DICE]) {
        if (activated.has(code)) continue
        const card = d.activatable.find((item) => item.code === code)
        if (card) {
          activated.add(code)
          return { kind: 'idle', cmd: 'ACTIVATE', card }
        }
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
          ? { kind: 'announce', value: BLUE_EYES }
          : { kind: 'announce', value: d.availableMask ? d.availableMask & -d.availableMask : 1 }
    default:
      throw new Error(`autoAnswer 未覆盖 kind=${d satisfies never as string}`)
  }
}

type TossStepEvent = Extract<EngineStepEvent, { kind: 'toss' }>
type TossLogEvent = Extract<DuelLogEvent, { kind: 'toss' }>

function tossEventsOf(node: EngineTimelineNode): TossStepEvent[] {
  return node.events.filter((event): event is TossStepEvent => event.kind === 'toss')
}

function tossLogEventsOf(node: EngineTimelineNode): TossLogEvent[] {
  return (node.logEvents ?? []).filter((event): event is TossLogEvent => event.kind === 'toss')
}

async function checkToss(coinCard: number, seed: number, expectedFace: 0 | 1): Promise<void> {
  const start = await duelSession.startDuel({
    puzzleState: buildPuzzle(coinCard),
    manualRandom: false,
    seed: [seed]
  })
  const nodes: EngineTimelineNode[] = [start.initialNode]
  const activated = new Set<number>()

  for (let step = 0; step < 40; step++) {
    const pending = duelSession.getPendingRequest()
    if (!pending || (pending.kind as string) === 'END' || (pending.kind as string) === 'WAITING')
      break
    const res = duelSession.submitAnswer(autoAnswer(pending, activated, coinCard))
    if (res.retry) {
      console.log('[toss-result-smoke] ⚠️ 答案被引擎拒绝（RETRY）')
      continue
    }
    if (res.node) nodes.push(res.node)
    const types = nodes.flatMap((node) => tossEventsOf(node).map((event) => event.type))
    if (types.includes('coin') && types.includes('dice')) break
  }

  const tossEvents = nodes.flatMap((node) => tossEventsOf(node))
  const coin = tossEvents.find((event) => event.type === 'coin')
  const dice = tossEvents.find((event) => event.type === 'dice')

  console.log(
    `[toss-result-smoke] 卡片=${coinCard} seed=${seed} 投掷事件=${JSON.stringify(tossEvents)}`
  )

  if (activated.size < 2) {
    throw new Error(`掷币卡与天使的骰子没有都能发动：${[...activated].join(', ')}`)
  }
  if (!coin) throw new Error('引擎投了硬币，但会话没有产生 toss 步骤事件。')
  if (!dice) throw new Error('引擎投了骰子，但会话没有产生 toss 步骤事件。')
  if (coin.results.length !== 1 || coin.results[0] !== expectedFace) {
    throw new Error(`硬币结果应为 ${expectedFace}，实际为 ${coin.results.join(', ')}`)
  }
  if (coinCard === COUPLE_OF_ACES) {
    const controller = expectedFace === 1 ? 0 : 1
    if (
      !duelSession.getBoardState().players[controller].mzone.some((card) => card?.code === coinCard)
    ) {
      throw new Error(`圣杯情侣双A应根据硬币结果特殊召唤到玩家 ${controller} 场上`)
    }
  }
  if (dice.results.some((result) => result < 1 || result > 6)) {
    throw new Error(`骰子结果不在 1-6：${dice.results.join(', ')}`)
  }

  for (const node of nodes) {
    const stepEvents = tossEventsOf(node)
    if (stepEvents.length === 0) continue
    const logEvents = tossLogEventsOf(node)
    if (logEvents.length !== stepEvents.length) {
      throw new Error(`步骤「${node.title}」投掷事件与日志事件数量不一致。`)
    }
    stepEvents.forEach((event, index) => {
      if (event.type !== logEvents[index].type) {
        throw new Error(`步骤「${node.title}」投掷类型与日志事件不一致。`)
      }
      if (event.results.join(',') !== logEvents[index].results.join(',')) {
        throw new Error(`步骤「${node.title}」投掷结果与日志事件不一致。`)
      }
    })
  }
}

async function main(): Promise<void> {
  await cdbService.ready()

  for (const coinCard of [CUP_OF_ACE, COUPLE_OF_ACES]) {
    await checkToss(coinCard, 1, 0)
    await checkToss(coinCard, 3, 1)
  }

  const expectedCoin = formatTossResult('coin', [1])
  const expectedTails = formatTossResult('coin', [0])
  const expectedDice = formatTossResult('dice', [6])
  console.log(`[toss-result-smoke] 文案：${expectedCoin} / ${expectedTails} / ${expectedDice}`)
  if (expectedCoin !== '投掷硬币结果：[正面]') throw new Error(`硬币文案错误：${expectedCoin}`)
  if (expectedTails !== '投掷硬币结果：[反面]') throw new Error(`硬币文案错误：${expectedTails}`)
  if (expectedDice !== '投掷骰子结果：[6]') throw new Error(`骰子文案错误：${expectedDice}`)

  console.log('[toss-result-smoke] PASS')
  process.exit(0)
}

main().catch((err) => {
  console.error('[toss-result-smoke] FAILED:', err)
  process.exit(1)
})
