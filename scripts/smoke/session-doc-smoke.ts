import assert from 'node:assert/strict'
import { DuelSession } from '../../src/main/services/duel/duel-session'
import {
  CardLocation,
  CardPosition,
  Duelist,
  EngineBoardState,
  FieldCard,
  normalizeDuelState,
  type Answer,
  type EngineRequest
} from '@shared/index'
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
    ...p0Deck.map((code, index) =>
      makeCard(code, 0, CardLocation.DECK, index, CardPosition.FACEDOWN_DEFENSE)
    ),
    makeCard(38517737, 0, CardLocation.HAND, 0, CardPosition.FACEUP_ATTACK),
    makeCard(53129443, 0, CardLocation.HAND, 1, CardPosition.FACEUP_ATTACK),
    ...p1Deck.map((code, index) =>
      makeCard(code, 1, CardLocation.DECK, index, CardPosition.FACEDOWN_DEFENSE)
    )
  ]
  const duelists: Duelist[] = [
    { id: 'duelist_0_0', team: 0, name: '我方', lp: 8000, isFirst: true, turnOrder: 1 },
    { id: 'duelist_1_0', team: 1, name: '对方', lp: 8000, turnOrder: 2 }
  ]
  return normalizeDuelState({
    version: '1.2.0',
    title: '剧本存档联测',
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
  const data = request.data
  switch (data.kind) {
    case 'rps':
      return { kind: 'rps', hand: 'paper' }
    case 'idle':
      return { kind: 'idle', cmd: data.canEp ? 'TO_EP' : data.canBp ? 'TO_BP' : 'TO_EP' }
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
      return data.finishable
        ? { kind: 'unselect', card: null }
        : data.selectable.length > 0
          ? { kind: 'unselect', card: data.selectable[0] }
          : { kind: 'unselect', card: null }
    case 'announce':
      return data.announceType === 'number'
        ? { kind: 'announce', value: data.numbers![0] }
        : data.announceType === 'card'
          ? { kind: 'announce', value: 89631139 }
          : {
              kind: 'announce',
              value: data.availableMask ? data.availableMask & -data.availableMask : 1
            }
    case 'counter':
      return { kind: 'counter', counters: [] }
    case 'sum': {
      const picked = [...data.mustSelect]
      for (const card of data.cards) {
        if (picked.length >= data.count) break
        if (!picked.some((item) => item.code === card.code && item.sequence === card.sequence)) {
          picked.push(card)
        }
      }
      return { kind: 'sum', cards: picked }
    }
    default:
      throw new Error(`autoAnswer 未覆盖 kind=${request.kind}`)
  }
}

function summarize(board: EngineBoardState): Record<string, unknown> {
  return {
    turn: board.turn,
    turnPlayer: board.turnPlayer,
    phase: board.phase,
    lp: board.players.map((player) => player.lp),
    hand: board.players.map((player) => player.hand.length),
    deck: board.players.map((player) => player.deckCount),
    extra: board.players.map((player) => player.extraCount),
    grave: board.players.map((player) => player.graveyard.length),
    mzone: board.players.map((player) => player.mzone.filter(Boolean).length),
    szone: board.players.map((player) => player.szone.filter(Boolean).length),
    removed: board.players.map((player) => player.banished.length)
  }
}

function answerTimes(session: DuelSession, times: number): number {
  let answers = 0
  let retries = 0
  let guard = 0
  while (answers < times && guard++ < times * 4) {
    const pending = session.getPendingRequest()
    if (!pending) break
    const res = session.submitAnswer(autoAnswer(pending))
    if (res.retry) {
      retries += 1
      continue
    }
    answers += 1
  }
  assert.equal(answers, times, `应完成 ${times} 次有效作答`)
  return retries
}

async function main(): Promise<void> {
  await cdbService.ready()

  const source = new DuelSession()
  const start = await source.startDuel({ puzzleState: buildPuzzle() })
  console.log(
    `[session-doc-smoke] 开局: P0 手牌=${start.boardState.players[0].hand.length} 卡组=${start.boardState.players[0].deckCount} 回合=${start.boardState.turn}`
  )

  let guard = 0
  let retries = 0
  while (source.getPendingRequest()?.kind !== 'idle' && guard++ < 40) {
    const pending = source.getPendingRequest()
    if (!pending) throw new Error('开局阶段没有待答请求')
    const res = source.submitAnswer(autoAnswer(pending))
    if (res.retry) retries += 1
  }

  retries += answerTimes(source, 4)

  const handInject = await source.inject({
    op: 'add-card',
    player: 0,
    code: 89631139,
    to: 'hand'
  })
  const deckInject = await source.inject({
    op: 'add-card',
    player: 0,
    code: 46986414,
    to: 'deck-top'
  })
  console.log(
    `[session-doc-smoke] 注入后: 手牌=${handInject.boardState.players[0].hand.length} 卡组=${deckInject.boardState.players[0].deckCount} 节点=${deckInject.node.stepNumber}`
  )

  const doc = source.exportSessionDoc()
  const json = JSON.stringify(doc, null, 2)
  const roundTrip = JSON.parse(json) as typeof doc
  const sourceBoard = source.getBoardState()
  const sourcePending = source.getPendingRequest()

  console.log(
    `[session-doc-smoke] 导出: 字节=${json.length} 节点=${doc.timeline.length} 操作=${doc.ops.length} 当前步=${doc.currentStepId}`
  )
  assert.ok(
    doc.ops.some((op) => op.type === 'answer'),
    '剧本应包含 answer 操作'
  )
  assert.ok(
    doc.ops.some((op) => op.type === 'inject'),
    '剧本应包含 inject 操作'
  )

  const target = new DuelSession()
  const imported = await target.importSessionDoc(roundTrip)
  const importedBoard = imported.boardState
  const importedPending = imported.pendingRequest

  assert.equal(imported.currentStepId, doc.currentStepId, 'currentStepId 一致')
  assert.deepEqual(summarize(importedBoard), summarize(sourceBoard), '导入后场地一致')
  assert.equal(imported.timeline.length, doc.timeline.length, '时间线节点数一致')
  assert.equal(importedPending?.kind, sourcePending?.kind, 'pendingRequest.kind 一致')
  const currentNode = imported.timeline.find((node) => node.id === imported.currentStepId)
  assert.equal(currentNode?.pendingRequest?.kind, importedPending?.kind, '当前节点请求一致')

  const reexported = target.exportSessionDoc()
  assert.equal(reexported.ops.length, doc.ops.length, 'ops 数一致')
  assert.equal(reexported.timeline.length, doc.timeline.length, '重导出时间线节点数一致')
  assert.equal(reexported.currentStepId, doc.currentStepId, '重导出当前步一致')

  const currentIndex = imported.timeline.findIndex((node) => node.id === imported.currentStepId)
  const previousNode = imported.timeline[currentIndex - 1]
  assert.ok(previousNode, '当前步之前应存在可回退节点')

  const rewind = await target.jumpToStep(previousNode.id)
  assert.equal(rewind.currentStepId, previousNode.id, '回退一步成功')
  assert.deepEqual(
    summarize(rewind.boardState),
    summarize(previousNode.boardState),
    '回退一步场地与节点快照一致'
  )

  const forward = await target.jumpToStep(imported.currentStepId)
  assert.equal(forward.currentStepId, imported.currentStepId, '前进回当前步成功')
  assert.deepEqual(summarize(forward.boardState), summarize(sourceBoard), '前进后场地一致')
  assert.equal(target.getPendingRequest()?.kind, importedPending?.kind, '前进后请求一致')

  const broken = structuredClone(roundTrip)
  if (broken.initParams.puzzleState) {
    broken.initParams.puzzleState.cards = null as unknown as FieldCard[]
  }
  let failed = false
  try {
    await target.importSessionDoc(broken)
  } catch (err) {
    failed = true
    assert.match(String(err), /导入对局剧本失败/, '损坏剧本应给出可读错误')
  }
  assert.ok(failed, '损坏剧本必须导入失败')
  assert.deepEqual(
    summarize(target.getBoardState()),
    summarize(imported.boardState),
    '失败后保留原对局'
  )
  assert.equal(target.getTimeline().length, imported.timeline.length, '失败后时间线不变')
  assert.equal(target.getPendingRequest()?.kind, importedPending?.kind, '失败后请求不变')
  console.log('[session-doc-smoke] 损坏剧本导入失败并已回滚原对局')

  assert.equal(retries, 0, 'RETRY 计数必须为 0')
  console.log(`[session-doc-smoke] 回退/前进: ${previousNode.id} -> ${imported.currentStepId} 正常`)
  console.log(`[session-doc-smoke] RETRY=${retries}`)
  console.log('[session-doc-smoke] ALL CHECKS PASSED')
  process.exit(0)
}

main().catch((err) => {
  console.error('[session-doc-smoke] FAILED:', err)
  process.exit(1)
})
