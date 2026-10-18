import { duelSession } from '../../src/main/services/duel/duel-session'
import {
  CardLocation,
  CardPosition,
  createInitialDuelState,
  Duelist,
  DuelPuzzleState,
  EngineBoardState,
  FieldCard,
  normalizeDuelState
} from '@shared/index'
import type { Answer, EngineRequest, TimingPolicy } from '@shared/engine/protocol'

const BLUE_EYES = 89631139
const BLUE_EYES_ALTERNATIVE = 38517737
const DARK_MAGICIAN = 46986414
const STRATOS = 40044918
const NEOS = 89943723
const ASH_BLOSSOM = 23434538

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

function buildDuelists(): Duelist[] {
  return [
    { id: 'duelist_0_0', team: 0, name: '我方', lp: 8000, isFirst: true, turnOrder: 1 },
    { id: 'duelist_1_0', team: 1, name: '对方', lp: 8000, isFirst: false, turnOrder: 2 }
  ]
}

function buildChainPuzzle(): DuelPuzzleState {
  const cards: FieldCard[] = [
    makeCard(BLUE_EYES, 0, CardLocation.DECK, 0, CardPosition.FACEDOWN_DEFENSE),
    makeCard(BLUE_EYES, 0, CardLocation.DECK, 1, CardPosition.FACEDOWN_DEFENSE),
    makeCard(BLUE_EYES, 0, CardLocation.DECK, 2, CardPosition.FACEDOWN_DEFENSE),
    makeCard(ASH_BLOSSOM, 0, CardLocation.DECK, 3, CardPosition.FACEDOWN_DEFENSE),
    makeCard(BLUE_EYES, 0, CardLocation.HAND, 0, CardPosition.FACEDOWN),
    makeCard(BLUE_EYES_ALTERNATIVE, 0, CardLocation.HAND, 1, CardPosition.FACEDOWN),
    makeCard(BLUE_EYES, 1, CardLocation.DECK, 0, CardPosition.FACEDOWN_DEFENSE),
    makeCard(ASH_BLOSSOM, 1, CardLocation.DECK, 1, CardPosition.FACEDOWN_DEFENSE),
    makeCard(ASH_BLOSSOM, 1, CardLocation.HAND, 0, CardPosition.FACEDOWN)
  ]

  return normalizeDuelState({
    ...createInitialDuelState(5, 'full'),
    title: '时点策略联测：连锁',
    turnPlayer: 0,
    firstTurnAttack: true,
    cards,
    duelists: buildDuelists()
  })
}

function buildAttackPuzzle(): DuelPuzzleState {
  const cards: FieldCard[] = [
    makeCard(BLUE_EYES, 0, CardLocation.MZONE, 0, CardPosition.FACEUP_ATTACK),
    makeCard(DARK_MAGICIAN, 1, CardLocation.MZONE, 0, CardPosition.FACEUP_ATTACK)
  ]
  for (let i = 0; i < 8; i++) {
    cards.push(makeCard(BLUE_EYES, 0, CardLocation.DECK, i, CardPosition.FACEDOWN_DEFENSE))
    cards.push(makeCard(DARK_MAGICIAN, 1, CardLocation.DECK, i, CardPosition.FACEDOWN_DEFENSE))
  }

  return normalizeDuelState({
    ...createInitialDuelState(5, 'full'),
    title: '时点策略联测：空连锁',
    turnPlayer: 0,
    firstTurnAttack: true,
    cards,
    duelists: buildDuelists()
  })
}

function buildEffectPuzzle(): DuelPuzzleState {
  const cards: FieldCard[] = [
    makeCard(STRATOS, 0, CardLocation.HAND, 0, CardPosition.FACEDOWN),
    makeCard(NEOS, 0, CardLocation.DECK, 0, CardPosition.FACEDOWN_DEFENSE),
    makeCard(BLUE_EYES, 0, CardLocation.DECK, 1, CardPosition.FACEDOWN_DEFENSE),
    makeCard(BLUE_EYES, 1, CardLocation.DECK, 0, CardPosition.FACEDOWN_DEFENSE),
    makeCard(ASH_BLOSSOM, 1, CardLocation.DECK, 1, CardPosition.FACEDOWN_DEFENSE)
  ]

  return normalizeDuelState({
    ...createInitialDuelState(5, 'full'),
    title: '时点策略联测：可选发动',
    turnPlayer: 0,
    firstTurnAttack: false,
    cards,
    duelists: buildDuelists()
  })
}

interface RequestLog {
  kind: string
  player: 0 | 1
  identifier: number
  chains?: number
  forced?: boolean
}

function logRequest(request: EngineRequest): RequestLog {
  const log: RequestLog = {
    kind: request.kind,
    player: request.player,
    identifier: request.identifier
  }
  if (request.data.kind === 'chain') {
    log.chains = request.data.chains.length
    log.forced = request.data.forced
  }
  return log
}

interface ChainState {
  idleCount: number
  unselectPicked: boolean
}

function chainAnswer(request: EngineRequest, state: ChainState): Answer {
  const data = request.data
  switch (data.kind) {
    case 'idle': {
      state.idleCount += 1
      const handActivatable = data.activatable.find((card) => card.location === CardLocation.HAND)
      if (handActivatable && state.idleCount === 1) {
        return { kind: 'idle', cmd: 'ACTIVATE', card: handActivatable }
      }
      const handSpSummon = data.spSummonable.find((card) => card.location === CardLocation.HAND)
      if (handSpSummon && state.idleCount === 1) {
        return { kind: 'idle', cmd: 'SPSUMMON', card: handSpSummon }
      }
      return { kind: 'idle', cmd: 'TO_EP' }
    }
    case 'battle':
      return { kind: 'battle', cmd: 'TO_EP' }
    case 'yesno':
      return { kind: 'yesno', yes: false }
    case 'chain':
      return { kind: 'chain', card: null }
    case 'card':
      return data.cancelable
        ? { kind: 'card', cards: null }
        : { kind: 'card', cards: data.cards.slice(0, Math.max(1, data.min)) }
    case 'tribute':
      return data.cancelable
        ? { kind: 'tribute', cards: null }
        : { kind: 'tribute', cards: data.cards.slice(0, Math.max(1, data.min)) }
    case 'place':
      return { kind: 'place', places: data.places.slice(0, Math.max(1, data.count)) }
    case 'disfield':
      return { kind: 'disfield', places: data.places.slice(0, Math.max(1, data.count)) }
    case 'position':
      return { kind: 'position', position: data.positions[0] }
    case 'option':
      return { kind: 'option', index: 0 }
    case 'sort':
      return { kind: 'sort', cards: null }
    case 'unselect':
      if (!state.unselectPicked && data.selectable.length > 0) {
        state.unselectPicked = true
        return { kind: 'unselect', card: data.selectable[0] }
      }
      return { kind: 'unselect', card: null }
    case 'rps':
      return { kind: 'rps', hand: 'paper' }
    case 'announce':
      return data.announceType === 'number'
        ? { kind: 'announce', value: data.numbers?.[0] ?? 1 }
        : data.announceType === 'card'
          ? { kind: 'announce', value: BLUE_EYES }
          : {
              kind: 'announce',
              value: data.availableMask ? data.availableMask & -data.availableMask : 1
            }
    case 'counter':
      return {
        kind: 'counter',
        counters: data.cards.slice(0, Math.max(1, data.count)).map((card) => ({ card, count: 1 }))
      }
    case 'sum':
      return { kind: 'sum', cards: data.cards.slice(0, Math.max(1, data.min)) }
  }
}

interface AttackState {
  declared: boolean
  targetPicked: boolean
}

function attackAnswer(request: EngineRequest, state: AttackState): Answer {
  const data = request.data
  switch (data.kind) {
    case 'idle':
      return { kind: 'idle', cmd: data.canBp ? 'TO_BP' : 'TO_EP' }
    case 'battle': {
      const attacker = data.attackable[0]
      if (!attacker) return { kind: 'battle', cmd: 'TO_EP' }
      state.declared = true
      return { kind: 'battle', cmd: 'ATTACK', card: attacker }
    }
    case 'yesno':
      return { kind: 'yesno', yes: data.desc === 31 }
    case 'card': {
      const target = data.cards.find((card) => card.controller === 1)
      if (request.descHint === 549 && target) {
        state.targetPicked = true
        return { kind: 'card', cards: [target] }
      }
      return data.cancelable
        ? { kind: 'card', cards: null }
        : { kind: 'card', cards: data.cards.slice(0, Math.max(1, data.min)) }
    }
    case 'chain':
      return { kind: 'chain', card: null }
    default:
      return chainAnswer(request, { idleCount: 0, unselectPicked: false })
  }
}

interface EffectState {
  summoned: boolean
  effectAsked: boolean
}

function effectAnswer(request: EngineRequest, state: EffectState): Answer {
  const data = request.data
  switch (data.kind) {
    case 'idle': {
      if (!state.summoned && data.summonable.length > 0) {
        state.summoned = true
        return { kind: 'idle', cmd: 'SUMMON', card: data.summonable[0] }
      }
      return { kind: 'idle', cmd: data.canEp ? 'TO_EP' : 'TO_BP' }
    }
    case 'yesno':
      if (request.identifier === 12) {
        state.effectAsked = true
      }
      return { kind: 'yesno', yes: true }
    case 'card':
      return data.cancelable
        ? { kind: 'card', cards: null }
        : { kind: 'card', cards: data.cards.slice(0, Math.max(1, data.min)) }
    default:
      return chainAnswer(request, { idleCount: 0, unselectPicked: false })
  }
}

interface RunNode {
  id: string
  boardState: unknown
}

interface RunResult {
  requests: RequestLog[]
  nodes: RunNode[]
  retries: number
  boardState: string
}

async function runChain(policy: TimingPolicy, stopTurn: number): Promise<RunResult> {
  duelSession.setTimingPolicy(policy)
  const start = await duelSession.startDuel({ puzzleState: buildChainPuzzle(), seed: [1, 2, 3, 4] })
  const requests: RequestLog[] = []
  const nodes: RunNode[] = [{ id: start.initialNode.id, boardState: start.initialNode.boardState }]
  const state: ChainState = { idleCount: 0, unselectPicked: false }
  let retries = 0

  for (let step = 0; step < 200; step++) {
    const pending = duelSession.getPendingRequest()
    if (!pending) break
    requests.push(logRequest(pending))
    const res = duelSession.submitAnswer(chainAnswer(pending, state))
    if (res.retry) retries += 1
    if (res.node) nodes.push({ id: res.node.id, boardState: res.node.boardState })
    if (duelSession.getBoardState().turn >= stopTurn) break
  }

  return {
    requests,
    nodes,
    retries,
    boardState: JSON.stringify(duelSession.getBoardState())
  }
}

async function runAttack(policy: TimingPolicy): Promise<RunResult> {
  duelSession.setTimingPolicy(policy)
  const start = await duelSession.startDuel({
    puzzleState: buildAttackPuzzle(),
    seed: [1, 2, 3, 4]
  })
  const requests: RequestLog[] = []
  const nodes: RunNode[] = [{ id: start.initialNode.id, boardState: start.initialNode.boardState }]
  const state: AttackState = { declared: false, targetPicked: false }
  let retries = 0

  for (let step = 0; step < 80; step++) {
    const pending = duelSession.getPendingRequest()
    if (!pending) break
    requests.push(logRequest(pending))
    const res = duelSession.submitAnswer(attackAnswer(pending, state))
    if (res.retry) retries += 1
    if (res.node) nodes.push({ id: res.node.id, boardState: res.node.boardState })
    const board = duelSession.getBoardState()
    if (board.players[1].lp < 8000) {
      const next = duelSession.getPendingRequest()
      if (!next || next.kind === 'idle') break
    }
  }

  return {
    requests,
    nodes,
    retries,
    boardState: JSON.stringify(duelSession.getBoardState())
  }
}

async function runEffect(effectYn: TimingPolicy['effectYn']): Promise<RunResult> {
  duelSession.setTimingPolicy({ chain: 'ignore', effectYn })
  const start = await duelSession.startDuel({
    puzzleState: buildEffectPuzzle(),
    seed: [1, 2, 3, 4]
  })
  const requests: RequestLog[] = []
  const nodes: RunNode[] = [{ id: start.initialNode.id, boardState: start.initialNode.boardState }]
  const state: EffectState = { summoned: false, effectAsked: false }
  let retries = 0

  for (let step = 0; step < 80; step++) {
    const pending = duelSession.getPendingRequest()
    if (!pending) break
    requests.push(logRequest(pending))
    const res = duelSession.submitAnswer(effectAnswer(pending, state))
    if (res.retry) retries += 1
    if (res.node) nodes.push({ id: res.node.id, boardState: res.node.boardState })
    if (state.effectAsked && requests.length > 8) break
  }

  return {
    requests,
    nodes,
    retries,
    boardState: JSON.stringify(duelSession.getBoardState())
  }
}

function chainRequests(result: RunResult): RequestLog[] {
  return result.requests.filter((request) => request.kind === 'chain')
}

function boardDiff(expected: unknown, actual: unknown): string {
  const left = JSON.stringify(expected)
  const right = JSON.stringify(actual)
  let index = 0
  while (index < left.length && index < right.length && left[index] === right[index]) index += 1
  return `偏移 ${index} 长度 ${left.length}/${right.length}\n    期望 ${left.slice(Math.max(0, index - 80), index + 120)}\n    实际 ${right.slice(Math.max(0, index - 80), index + 120)}\n    期望尾 ${left.slice(-160)}\n    实际尾 ${right.slice(-160)}`
}

function normalizeBoardForReplay(board: EngineBoardState): string {
  const copy = structuredClone(board)
  for (const player of copy.players) {
    player.hand.sort((a, b) => a.code - b.code)
    for (const card of player.hand) card.sequence = -1
  }
  for (const card of copy.allCards) {
    if (card.location === CardLocation.HAND) card.sequence = -1
  }
  copy.allCards.sort(
    (a, b) => a.code - b.code || a.controller - b.controller || a.sequence - b.sequence
  )
  return JSON.stringify(copy)
}

function summarizeBoard(result: RunResult): string {
  const board = JSON.parse(result.boardState) as {
    turn: number
    phase: number
    players: { lp: number; hand: unknown[]; graveyard: unknown[] }[]
  }
  return `turn=${board.turn} phase=${board.phase} lp=${board.players.map((player) => player.lp).join('/')} hand=${board.players.map((player) => player.hand.length).join('/')} grave=${board.players.map((player) => player.graveyard.length).join('/')}`
}

function outcomeOf(result: RunResult): string {
  const board = JSON.parse(result.boardState) as {
    turn: number
    players: {
      lp: number
      hand: unknown[]
      graveyard: unknown[]
      banished: unknown[]
      mzone: unknown[]
      szone: unknown[]
      deckCount: number
      extraCount: number
    }[]
  }
  return JSON.stringify({
    turn: board.turn,
    players: board.players.map((player) => ({
      lp: player.lp,
      hand: player.hand.length,
      grave: player.graveyard.length,
      removed: player.banished.length,
      mzone: player.mzone.filter(Boolean).length,
      szone: player.szone.filter(Boolean).length,
      deck: player.deckCount,
      extra: player.extraCount
    }))
  })
}

const failures: string[] = []

function assert(condition: boolean, message: string): void {
  if (!condition) failures.push(message)
  console.log(`  ${condition ? '✅' : '❌'} ${message}`)
}

async function main(): Promise<void> {
  const { cdbService } = await import('./cdb-shim')
  await cdbService.ready()

  console.log('\n[policy-smoke] === 连锁三档 ===')
  const ignore = await runChain({ chain: 'ignore', effectYn: 'ask' }, 2)
  const available = await runChain({ chain: 'available', effectYn: 'ask' }, 2)
  const all = await runChain({ chain: 'all', effectYn: 'ask' }, 2)

  const ignoreChains = chainRequests(ignore)
  const availableChains = chainRequests(available)
  const allChains = chainRequests(all)

  console.log(
    `  ignore chain=${ignoreChains.length}  available chain=${availableChains.length}  all chain=${allChains.length}`
  )
  console.log(`  ignore 终态: ${summarizeBoard(ignore)}`)
  console.log(`  available 终态: ${summarizeBoard(available)}`)
  console.log(`  all 终态: ${summarizeBoard(all)}`)
  console.log(
    `  available 请求序列: ${available.requests.map((request) => `${request.kind}${request.chains === undefined ? '' : `[${request.chains}]`}`).join(' → ')}`
  )
  console.log(
    `  all 请求序列: ${all.requests.map((request) => `${request.kind}${request.chains === undefined ? '' : `[${request.chains}]`}`).join(' → ')}`
  )
  assert(ignoreChains.length === 0, 'ignore：没有任何连锁询问（无强制连锁）')
  assert(availableChains.length > 0, 'available：有卡可连锁时仍询问')
  assert(
    availableChains.every((request) => (request.chains ?? 0) > 0),
    'available：出现的连锁询问都有可连锁卡'
  )
  assert(allChains.length >= availableChains.length, 'all：连锁询问数量不少于 available')
  assert(
    allChains.some((request) => request.chains === 0),
    'all：出现空连锁询问（时点检查点）'
  )
  assert(
    outcomeOf(ignore) === outcomeOf(available) && outcomeOf(available) === outcomeOf(all),
    '三档最终局面一致（自动放弃不改变对局结果）'
  )
  assert(ignore.retries === 0 && available.retries === 0 && all.retries === 0, '三档均无 RETRY')

  console.log('\n[policy-smoke] === 空连锁检查点（攻击宣言） ===')
  const attackAvailable = await runAttack({ chain: 'available', effectYn: 'ask' })
  const attackAll = await runAttack({ chain: 'all', effectYn: 'ask' })
  const attackAvailableChains = chainRequests(attackAvailable)
  const attackAllChains = chainRequests(attackAll)
  console.log(`  available 终态: ${summarizeBoard(attackAvailable)}`)
  console.log(`  all 终态: ${summarizeBoard(attackAll)}`)
  console.log(
    `  available 请求序列: ${attackAvailable.requests.map((request) => `${request.kind}${request.chains === undefined ? '' : `[${request.chains}]`}`).join(' → ')}`
  )
  console.log(
    `  all 请求序列: ${attackAll.requests.map((request) => `${request.kind}${request.chains === undefined ? '' : `[${request.chains}]`}`).join(' → ')}`
  )
  assert(attackAvailableChains.length === 0, 'available：攻击宣言的空连锁被自动放弃')
  assert(
    attackAllChains.some((request) => request.chains === 0),
    'all：攻击宣言出现空连锁询问'
  )
  assert(outcomeOf(attackAll) === outcomeOf(attackAvailable), 'all 的空连锁询问不影响战斗结果')
  assert(attackAvailable.retries === 0 && attackAll.retries === 0, '攻击链路无 RETRY')

  console.log('\n[policy-smoke] === 可选发动效果 ===')
  const effectAsk = await runEffect('ask')
  const effectNever = await runEffect('never')
  const effectYnAsk = effectAsk.requests.filter(
    (request) => request.kind === 'yesno' && request.identifier === 12
  )
  const effectYnNever = effectNever.requests.filter(
    (request) => request.kind === 'yesno' && request.identifier === 12
  )
  console.log(
    `  ask SelectEffectYn=${effectYnAsk.length}  never SelectEffectYn=${effectYnNever.length}`
  )
  assert(effectYnAsk.length > 0, 'effectYn=ask：SelectEffectYn 正常询问')
  assert(effectYnNever.length === 0, 'effectYn=never：SelectEffectYn 不再出现')
  assert(effectAsk.retries === 0 && effectNever.retries === 0, '可选发动链路无 RETRY')

  console.log('\n[policy-smoke] === 自动应答重放一致性 ===')
  const replayRun = await runChain({ chain: 'ignore', effectYn: 'ask' }, 2)
  const earlyNode = replayRun.nodes[Math.max(1, Math.floor(replayRun.nodes.length / 2))]
  const lateNode = replayRun.nodes[replayRun.nodes.length - 1]

  duelSession.setTimingPolicy({ chain: 'all', effectYn: 'never' })
  console.log(`  回退节点: ${earlyNode.id}  前进节点: ${lateNode.id}`)
  const earlyBoard = await duelSession.jumpToStep(earlyNode.id)
  const earlyMatch =
    normalizeBoardForReplay(earlyBoard.boardState) === normalizeBoardForReplay(earlyNode.boardState)
  assert(earlyMatch, '回退到中间步骤场面一致')
  if (!earlyMatch) console.log(`  ${boardDiff(earlyNode.boardState, earlyBoard.boardState)}`)
  const lateBoard = await duelSession.jumpToStep(lateNode.id)
  const lateMatch =
    normalizeBoardForReplay(lateBoard.boardState) === normalizeBoardForReplay(lateNode.boardState)
  assert(lateMatch, '回退后再前进到最新步骤场面一致')
  if (!lateMatch) console.log(`  ${boardDiff(lateNode.boardState, lateBoard.boardState)}`)
  assert(lateBoard.currentStepId === lateNode.id, '重放后当前步骤指针正确')

  console.log(
    `\n[policy-smoke] ${failures.length === 0 ? '全部通过' : `失败 ${failures.length} 项`}`
  )
  if (failures.length > 0) {
    for (const failure of failures) console.log(`  - ${failure}`)
    process.exit(1)
  }
  process.exit(0)
}

main().catch((err) => {
  console.error('[policy-smoke] FAILED:', err)
  process.exit(1)
})
