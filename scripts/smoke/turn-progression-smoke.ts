/**
 * 回合推进联测：连续提交 TO_EP 让双方各过若干回合
 *
 * 验证：
 * 1. 每次作答后 readBoard()/boardState.turn 是否随作答正确递增（不停留、不跳变）
 * 2. 每次作答是否都产生 timeline 节点（回合结束步骤存在于 steps）
 * 3. jumpToStep 重演路径（replayTo 重建对局）后 turn 是否还原正确
 */
import { duelSession } from '../../src/main/services/duel/duel-session'
import { normalizeDuelState, Duelist, DuelPuzzleState, FieldCard } from '@shared/index'
import type { EngineRequest, Answer } from '@shared/engine/protocol'

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

function buildPuzzle(): DuelPuzzleState {
  const cards: FieldCard[] = []
  for (const player of [0, 1] as const) {
    for (let i = 0; i < 30; i++) cards.push(makeCard(89631139, player, 0x01, i, 0xa))
    for (let i = 0; i < 5; i++) cards.push(makeCard(89631139, player, 0x02, i, 0xa))
  }

  const duelists: Duelist[] = [
    { id: 'duelist_0_0', team: 0, name: '我方', lp: 8000, isFirst: true, turnOrder: 1 },
    { id: 'duelist_1_0', team: 1, name: '对方', lp: 8000, turnOrder: 2 }
  ]

  return normalizeDuelState({
    version: '1.2.0',
    title: '回合推进联测',
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
    duelists,
    matchConfig: { mode: '1v1', team0Count: 1, team1Count: 1, sharedLp: false },
    scenarios: {}
  })
}

function autoAnswer(request: EngineRequest): Answer {
  const d = request.data
  switch (d.kind) {
    case 'idle':
      return { kind: 'idle', cmd: 'TO_EP' }
    case 'battle':
      return { kind: 'battle', cmd: 'TO_EP' }
    case 'rps':
      return { kind: 'rps', hand: 'paper' }
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
    case 'counter':
      return { kind: 'counter', counters: [] }
    case 'sum':
      return { kind: 'sum', cards: d.mustSelect.slice(0, Math.max(1, d.count)) }
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
    default:
      throw new Error(`autoAnswer 未覆盖 kind=${d satisfies never as string}`)
  }
}

interface AnswerRecord {
  nodeId: string
  turn: number
  turnPlayer: 0 | 1
}

async function main(): Promise<void> {
  const { cdbService } = await import('./cdb-shim')
  await cdbService.ready()

  const start = await duelSession.startDuel({ puzzleState: buildPuzzle() })
  console.log(
    `[turn-smoke] 开局: turn=${start.boardState.turn} turnPlayer=${start.boardState.turnPlayer} phase=${start.boardState.phaseName} P0手牌=${start.boardState.players[0].hand.length} P1手牌=${start.boardState.players[1].hand.length} 节点=${duelSession.getTimeline().length}`
  )

  const records: AnswerRecord[] = []
  let retryCount = 0
  let nodeMisses = 0
  const MAX_ANSWERS = 80

  for (let i = 0; i < MAX_ANSWERS; i++) {
    const pending = duelSession.getPendingRequest()
    const kind = pending?.kind as string | undefined
    if (!pending || kind === 'END' || kind === 'WAITING') {
      console.log(`[turn-smoke] 第 ${i + 1} 次作答前无待答请求 (kind=${kind ?? 'null'})，停止`)
      break
    }
    const res = duelSession.submitAnswer(autoAnswer(pending))
    if (res.retry) {
      retryCount++
      console.log(`[turn-smoke] ⚠️ 第 ${i + 1} 次作答被引擎拒绝 (RETRY) kind=${kind}`)
      continue
    }
    if (!res.node) nodeMisses++
    if (!res.boardState) {
      console.log(`[turn-smoke] ⚠️ 第 ${i + 1} 次作答未返回 boardState`)
      continue
    }
    const b = res.boardState
    const p0 = b.players[0]
    const p1 = b.players[1]
    records.push({ nodeId: res.node!.id, turn: b.turn, turnPlayer: b.turnPlayer })
    console.log(
      `[turn-smoke] #${String(i + 1).padStart(2, '0')} kind=${kind.padEnd(7)} player=${pending.player} → turn=${b.turn} turnPlayer=${b.turnPlayer} phase=${b.phaseName} | LP=${p0.lp}/${p1.lp} 手牌=${p0.hand.length}/${p1.hand.length} 墓地=${p0.graveyard.length}/${p1.graveyard.length} 节点=${duelSession.getTimeline().length}${res.node ? '' : ' (无新节点)'}`
    )
    const last = records[records.length - 1]
    if (b.turn > last.turn && records.length > 1) {
      const prev = records[records.length - 2]
      if (b.turn !== prev.turn + 1) {
        console.log(
          `[turn-smoke] ❌ 回合跳变: ${prev.turn} → ${b.turn} (应 +1)`
        )
      }
    }
    if (duelSession.getPendingRequest() === null) {
      console.log('[turn-smoke] 对局已无待答请求（可能结束），停止')
      break
    }
  }

  const finalBoard = duelSession.getBoardState()
  const distinctTurns = new Set(records.map((r) => r.turn))
  console.log(
    `[turn-smoke] 终态: turn=${finalBoard.turn} turnPlayer=${finalBoard.turnPlayer} phase=${finalBoard.phaseName} | 作答=${records.length + retryCount} RETRY=${retryCount} 无节点作答=${nodeMisses} 出现过的回合值=[${[...distinctTurns].join(',')}]`
  )

  let failed = false
  const maxObserved = Math.max(...records.map((r) => r.turn), start.boardState.turn)
  if (maxObserved < 6) {
    console.log(`[turn-smoke] ❌ FAIL: 80 次作答内回合只推进到 ${maxObserved}，期望 ≥ 6`)
    failed = true
  } else {
    console.log(`[turn-smoke] ✅ turn 随作答递增至 ${maxObserved}`)
  }
  if (nodeMisses > 0) {
    console.log(`[turn-smoke] ❌ FAIL: ${nodeMisses} 次作答未产生 timeline 节点`)
    failed = true
  } else {
    console.log('[turn-smoke] ✅ 每次作答均产生 timeline 节点')
  }

  const timeline = duelSession.getTimeline()
  const firstNode = timeline[0]
  const lastNode = timeline[timeline.length - 1]
  const midNode = timeline[Math.floor(timeline.length / 2)]
  const midRecord = records.find((r) => r.nodeId === midNode.id)

  await duelSession.jumpToStep(firstNode.id)
  const firstTurn = duelSession.getBoardState().turn
  if (firstTurn === start.boardState.turn) {
    console.log(`[turn-smoke] ✅ 跳回首节点后 turn=${firstTurn}（与开局一致）`)
  } else {
    console.log(`[turn-smoke] ❌ 跳回首节点后 turn=${firstTurn}，开局时为 ${start.boardState.turn}`)
    failed = true
  }

  if (midRecord) {
    await duelSession.jumpToStep(midNode.id)
    const midTurn = duelSession.getBoardState().turn
    if (midTurn === midRecord.turn) {
      console.log(`[turn-smoke] ✅ 跳到中间节点后 turn=${midTurn}（与作答时一致）`)
    } else {
      console.log(`[turn-smoke] ❌ 跳到中间节点后 turn=${midTurn}，作答时为 ${midRecord.turn}`)
      failed = true
    }
  }

  await duelSession.jumpToStep(lastNode.id)
  const lastTurn = duelSession.getBoardState().turn
  const expectedLast = records[records.length - 1]?.turn ?? start.boardState.turn
  if (lastTurn === expectedLast) {
    console.log(`[turn-smoke] ✅ 跳回最新节点后 turn=${lastTurn}（与作答时一致）`)
  } else {
    console.log(`[turn-smoke] ❌ 跳回最新节点后 turn=${lastTurn}，作答时为 ${expectedLast}`)
    failed = true
  }

  console.log(failed ? '[turn-smoke] FAILED' : '[turn-smoke] ALL PASSED')
  process.exit(failed ? 1 : 0)
}

main().catch((err) => {
  console.error('[turn-smoke] FAILED:', err)
  process.exit(1)
})
