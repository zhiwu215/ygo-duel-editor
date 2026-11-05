/**
 * 手动指定随机结果联测：关闭「引擎随机结果」后，
 * 圣杯A（投硬币）与天使的骰子（投骰子）必须先用询问再结算，
 * いたずら好きな双子悪魔（随机选卡）必须先用选卡询问，不允许先结算再由客户端改写。
 */
import { duelSession } from '../../src/main/services/duel/duel-session'
import {
  CardLocation,
  CardPosition,
  Duelist,
  FieldCard,
  formatTossFaces,
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
const GRACEFUL_DICE = 74137509
const DELINQUENT_DUO = 44763025
const BLUE_EYES = 89631139
const DARK_MAGICIAN = 46986414
const RED_EYES = 70781052

const DECK = [BLUE_EYES, DARK_MAGICIAN, RED_EYES, 23434538, 14558127, 70342110, 66518841, 97997309]

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

function buildPuzzle(options: {
  handCode: number
  field?: FieldCard[]
  opponentHand?: number[]
}): ReturnType<typeof normalizeDuelState> {
  const duelists: Duelist[] = [
    { id: 'duelist_0_0', team: 0, name: '我方', lp: 8000, isFirst: true, turnOrder: 1 },
    { id: 'duelist_1_0', team: 1, name: '对方', lp: 8000, isFirst: false, turnOrder: 2 }
  ]
  const cards: FieldCard[] = [
    makeCard(options.handCode, 0, CardLocation.HAND, 0, CardPosition.FACEDOWN),
    ...(options.field ?? []),
    ...(options.opponentHand ?? []).map((code, index) =>
      makeCard(code, 1, CardLocation.HAND, index, CardPosition.FACEDOWN)
    ),
    ...DECK.map((code, i) =>
      makeCard(code, 0, CardLocation.DECK, i, CardPosition.FACEDOWN_DEFENSE)
    ),
    ...DECK.map((code, i) => makeCard(code, 1, CardLocation.DECK, i, CardPosition.FACEDOWN_DEFENSE))
  ]

  return normalizeDuelState({
    version: '1.2.0',
    title: '随机指定联测',
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

function autoAnswer(request: EngineRequest, cardCode: number): Answer {
  const d = request.data
  switch (d.kind) {
    case 'rps':
      return { kind: 'rps', hand: 'paper' }
    case 'idle': {
      const target = d.activatable.find((card) => card.code === cardCode)
      if (target) return { kind: 'idle', cmd: 'ACTIVATE', card: target }
      return { kind: 'idle', cmd: d.canEp ? 'TO_EP' : d.canBp ? 'TO_BP' : 'TO_EP' }
    }
    case 'battle':
      return { kind: 'battle', cmd: 'TO_EP' }
    case 'yesno':
      return { kind: 'yesno', yes: false }
    case 'chain':
      return { kind: 'chain', card: null }
    case 'option':
      return { kind: 'option', index: 0 }
    case 'position':
      return { kind: 'position', position: d.positions[0] }
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
    case 'sort':
      return { kind: 'sort', cards: null }
    case 'unselect':
      return d.selectable.length > 0
        ? { kind: 'unselect', card: d.selectable[0] }
        : { kind: 'unselect', card: null }
    case 'announce':
      return d.announceType === 'number'
        ? { kind: 'announce', value: d.numbers![0] }
        : { kind: 'announce', value: d.availableMask ? d.availableMask & -d.availableMask : 1 }
    default:
      throw new Error(`autoAnswer 未覆盖 kind=${d satisfies never as string}`)
  }
}

type TossStepEvent = Extract<EngineStepEvent, { kind: 'toss' }>
type TossLogEvent = Extract<DuelLogEvent, { kind: 'toss' }>
type DrawLogEvent = Extract<DuelLogEvent, { kind: 'draw' }>

function tossEventsOf(node: EngineTimelineNode): TossStepEvent[] {
  return node.events.filter((event): event is TossStepEvent => event.kind === 'toss')
}

function tossLogEventsOf(node: EngineTimelineNode): TossLogEvent[] {
  return (node.logEvents ?? []).filter((event): event is TossLogEvent => event.kind === 'toss')
}

function drawsOf(node: EngineTimelineNode): DrawLogEvent[] {
  return (node.logEvents ?? []).filter((event): event is DrawLogEvent => event.kind === 'draw')
}

async function driveUntilAsk(params: {
  puzzle: ReturnType<typeof normalizeDuelState>
  cardCode: number
}): Promise<EngineRequest> {
  await duelSession.startDuel({ puzzleState: params.puzzle })
  for (let step = 0; step < 30; step++) {
    const pending = duelSession.getPendingRequest()
    if (!pending) break
    if (pending.kind === 'option' || pending.kind === 'announce') {
      if (!pending.manualRandom) throw new Error('随机询问没有标记 manualRandom')
      if (pending.title !== '关闭引擎随机结果，请手动选择') {
        throw new Error(`随机询问标题不对：${pending.title}`)
      }
      return pending
    }
    const res = duelSession.submitAnswer(autoAnswer(pending, params.cardCode))
    if (res.retry) throw new Error('应答被引擎拒绝（RETRY）')
  }
  throw new Error('没有等到引擎询问随机结果')
}

async function runCoin(
  chooseIndex: number
): Promise<{ options: string[]; node: EngineTimelineNode | null }> {
  const ask = await driveUntilAsk({
    puzzle: buildPuzzle({
      handCode: CUP_OF_ACE,
      field: [makeCard(BLUE_EYES, 0, CardLocation.MZONE, 0, CardPosition.FACEUP_ATTACK)]
    }),
    cardCode: CUP_OF_ACE
  })
  const options =
    ask.data.kind === 'option'
      ? ask.data.options.map((option) => option.text ?? String(option.code))
      : []
  const res = duelSession.submitAnswer({ kind: 'option', index: chooseIndex })
  if (res.retry) throw new Error('选项应答被引擎拒绝（RETRY）')
  return { options, node: res.node ?? null }
}

async function caseCoin(): Promise<void> {
  const heads = await runCoin(0)
  const tails = await runCoin(1)

  console.log(
    `[random-force-smoke] 硬币选项=${JSON.stringify(heads.options)} 文案=${formatTossFaces('coin', [1])}/${formatTossFaces('coin', [0])}`
  )
  if (heads.options.join(',') !== '正面,反面') {
    throw new Error(`硬币选项文案不对：${heads.options.join(',')}`)
  }

  const headsToss = heads.node ? tossEventsOf(heads.node)[0] : undefined
  const tailsToss = tails.node ? tossEventsOf(tails.node)[0] : undefined
  const headsLog = heads.node ? tossLogEventsOf(heads.node)[0] : undefined
  const tailsLog = tails.node ? tossLogEventsOf(tails.node)[0] : undefined
  if (headsToss?.results.join(',') !== '1' || headsLog?.results.join(',') !== '1') {
    throw new Error(
      `选正面后的投掷记录不对：${JSON.stringify(headsToss)} / ${JSON.stringify(headsLog)}`
    )
  }
  if (tailsToss?.results.join(',') !== '0' || tailsLog?.results.join(',') !== '0') {
    throw new Error(
      `选反面后的投掷记录不对：${JSON.stringify(tailsToss)} / ${JSON.stringify(tailsLog)}`
    )
  }

  const headsDraw = heads.node
    ? drawsOf(heads.node).find((draw) => draw.cards.length === 2)
    : undefined
  const tailsDraw = tails.node
    ? drawsOf(tails.node).find((draw) => draw.cards.length === 2)
    : undefined
  if (!headsDraw || !tailsDraw) throw new Error('选完硬币后没有产生抽 2 张结算')
  if (headsDraw.player === tailsDraw.player) {
    throw new Error('选正面与反面后抽卡方没有变化，硬币结果没有真正进入引擎')
  }
}

async function caseDice(): Promise<void> {
  const ask = await driveUntilAsk({
    puzzle: buildPuzzle({
      handCode: GRACEFUL_DICE,
      field: [makeCard(BLUE_EYES, 0, CardLocation.MZONE, 0, CardPosition.FACEUP_ATTACK)]
    }),
    cardCode: GRACEFUL_DICE
  })
  if (ask.data.kind !== 'announce' || ask.data.announceType !== 'number') {
    throw new Error('骰子没有用数字询问的方式提问')
  }
  const numbers = ask.data.numbers ?? []
  const res = duelSession.submitAnswer({ kind: 'announce', value: 6 })
  if (res.retry) throw new Error('数字应答被引擎拒绝（RETRY）')
  const toss = res.node ? tossEventsOf(res.node)[0] : undefined
  console.log(
    `[random-force-smoke] 骰子候选项=${JSON.stringify(numbers)} 记录=${JSON.stringify(toss)}`
  )
  if (numbers.join(',') !== '1,2,3,4,5,6') {
    throw new Error(`骰子候选不对：${numbers.join(',')}`)
  }
  if (toss?.results.join(',') !== '6') {
    throw new Error(`选 6 后的投掷记录不对：${JSON.stringify(toss)}`)
  }
}

async function caseSelect(): Promise<void> {
  const opponentHand = [BLUE_EYES, DARK_MAGICIAN, RED_EYES]
  const wanted = DARK_MAGICIAN
  await duelSession.startDuel({
    puzzleState: buildPuzzle({ handCode: DELINQUENT_DUO, opponentHand })
  })

  for (let step = 0; step < 30; step++) {
    const pending = duelSession.getPendingRequest()
    if (!pending) break
    if (pending.kind === 'card' && pending.data.kind === 'card') {
      if (!pending.manualRandom) throw new Error('随机选卡没有标记 manualRandom')
      const target = pending.data.cards.find((card) => card.code === wanted)
      if (!target) {
        throw new Error(
          `随机选卡的候选里没有指定的卡：${pending.data.cards.map((card) => card.code).join(',')}`
        )
      }
      const res = duelSession.submitAnswer({ kind: 'card', cards: [target] })
      if (res.retry) throw new Error('选卡应答被引擎拒绝（RETRY）')
      const board = duelSession.getBoardState()
      const grave = board.allCards.filter(
        (card) => card.controller === 1 && card.location === CardLocation.GRAVE
      )
      console.log(
        `[random-force-smoke] 随机选卡 候选=${pending.data.cards.map((card) => card.code).join(',')} 墓地=${grave.map((card) => card.code).join(',')}`
      )
      if (grave.length !== 1 || grave[0].code !== wanted) {
        throw new Error('指定随机选卡后，送去墓地的不是指定的那张')
      }
      return
    }
    const res = duelSession.submitAnswer(autoAnswer(pending, DELINQUENT_DUO))
    if (res.retry) throw new Error('应答被引擎拒绝（RETRY）')
  }
  throw new Error('随机选卡没有先询问就结算了')
}

async function main(): Promise<void> {
  await cdbService.ready()
  await caseCoin()
  await caseDice()
  await caseSelect()
  console.log('[random-force-smoke] PASS')
  process.exit(0)
}

main().catch((err) => {
  console.error('[random-force-smoke] FAILED:', err)
  process.exit(1)
})

