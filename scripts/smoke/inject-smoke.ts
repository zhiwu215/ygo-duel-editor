import { duelSession } from '../../src/main/services/duel/duel-session'
import { normalizeDuelState, Duelist, FieldCard, CardLocation, CardPosition, CardType } from '@shared/index'
import type { Answer, EngineRequest, EngineBoardState } from '@shared/index'
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
    ...p0Deck.map((code, i) => makeCard(code, 0, CardLocation.DECK, i, CardPosition.FACEDOWN_DEFENSE)),
    makeCard(38517737, 0, CardLocation.HAND, 0, CardPosition.FACEUP_ATTACK),
    makeCard(53129443, 0, CardLocation.HAND, 1, CardPosition.FACEUP_ATTACK),
    ...p1Deck.map((code, i) => makeCard(code, 1, CardLocation.DECK, i, CardPosition.FACEDOWN_DEFENSE))
  ]

  const duelists: Duelist[] = [
    { id: 'duelist_0_0', team: 0, name: '我方', lp: 8000, isFirst: true, turnOrder: 1 },
    { id: 'duelist_1_0', team: 1, name: '对方', lp: 8000, turnOrder: 2 }
  ]

  return normalizeDuelState({
    version: '1.2.0',
    title: '注入联测',
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

function handHas(board: EngineBoardState, player: 0 | 1, code: number): boolean {
  return board.players[player].hand.some((card) => card.code === code)
}

function lastNodeId(): string {
  const timeline = duelSession.getTimeline()
  const node = timeline.at(-1)
  if (!node) throw new Error('时间线为空')
  return node.id
}

function assert(condition: boolean, message: string): void {
  if (!condition) throw new Error(`断言失败: ${message}`)
}

async function main(): Promise<void> {
  await cdbService.ready()
  const state = buildPuzzle()
  const start = await duelSession.startDuel({ puzzleState: state })
  console.log(
    `[inject-smoke] 开局: P0 手牌=${start.boardState.players[0].hand.length} 卡组=${start.boardState.players[0].deckCount} LP=${start.boardState.players[0].lp}`
  )

  let guard = 0
  while (duelSession.getPendingRequest()?.kind !== 'idle' && guard++ < 40) {
    const pending = duelSession.getPendingRequest()
    if (!pending) throw new Error('引擎没有待答请求')
    const res = duelSession.submitAnswer(autoAnswer(pending))
    if (res.retry) throw new Error('开局阶段被引擎拒绝')
  }

  const beforeInjectId = lastNodeId()
  const beforeInject = duelSession.getBoardState()
  const beforeHand = beforeInject.players[0].hand.length
  const beforeDeck = beforeInject.players[0].deckCount
  const beforeLp = beforeInject.players[0].lp
  console.log(
    `[inject-smoke] 注入前: 节点=${beforeInjectId} 手牌=${beforeHand} 卡组=${beforeDeck} LP=${beforeLp}`
  )

  const handInject = await duelSession.inject({
    op: 'add-card',
    player: 0,
    code: 89631139,
    to: 'hand'
  })
  assert(handInject.boardState.players[0].hand.length === beforeHand + 1, '加入手牌数量 +1')
  assert(handHas(handInject.boardState, 0, 89631139), '加入手牌的卡可查询到')
  console.log(
    `[inject-smoke] 注入手牌: 手牌=${handInject.boardState.players[0].hand.length} 节点=${handInject.node.stepNumber} opIndex=${handInject.node.opIndex} warning=${handInject.warning ?? '无'}`
  )

  const deckInject = await duelSession.inject({
    op: 'add-card',
    player: 0,
    code: 46986414,
    to: 'deck-top'
  })
  assert(deckInject.boardState.players[0].deckCount === beforeDeck + 1, '卡组顶数量 +1')
  console.log(
    `[inject-smoke] 注入卡组顶: 卡组=${deckInject.boardState.players[0].deckCount} 节点=${deckInject.node.stepNumber} opIndex=${deckInject.node.opIndex}`
  )

  const lpInject = await duelSession.inject({ op: 'set-lp', player: 0, lp: 5000 })
  const lpEffective = lpInject.boardState.players[0].lp === 5000
  console.log(
    `[inject-smoke] 设置 LP: 结果=${lpInject.boardState.players[0].lp} 生效=${lpEffective ? '是' : '否'} warning=${lpInject.warning ?? '无'}`
  )
  if (!lpEffective) {
    assert(Boolean(lpInject.warning), 'LP 未生效时必须返回 warning')
  }

  const latestInjectId = lastNodeId()
  console.log(`[inject-smoke] 最新注入节点: ${latestInjectId}`)

  const rewind = await duelSession.jumpToStep(beforeInjectId)
  assert(rewind.boardState.players[0].hand.length === beforeHand, '回退后手牌恢复')
  assert(rewind.boardState.players[0].deckCount === beforeDeck, '回退后卡组恢复')
  assert(rewind.boardState.players[0].lp === beforeLp, '回退后 LP 恢复')
  console.log(
    `[inject-smoke] 回退到注入前: 手牌=${rewind.boardState.players[0].hand.length} 卡组=${rewind.boardState.players[0].deckCount} LP=${rewind.boardState.players[0].lp}`
  )

  const forward = await duelSession.jumpToStep(latestInjectId)
  assert(forward.boardState.players[0].hand.length === beforeHand + 1, '前进后手牌重新出现')
  assert(forward.boardState.players[0].deckCount === beforeDeck + 1, '前进后卡组重新出现')
  assert(
    forward.boardState.players[0].lp === lpInject.boardState.players[0].lp,
    '前进后 LP 重放一致'
  )
  console.log(
    `[inject-smoke] 前进到最新注入: 手牌=${forward.boardState.players[0].hand.length} 卡组=${forward.boardState.players[0].deckCount} LP=${forward.boardState.players[0].lp}`
  )

  let drewInjected = false
  let drawSteps = 0
  while (!drewInjected && drawSteps++ < 80) {
    const pending = duelSession.getPendingRequest()
    if (!pending) break
    const res = duelSession.submitAnswer(autoAnswer(pending))
    if (res.retry) {
      console.log('[inject-smoke] ⚠️ RETRY，停止抽卡验证')
      break
    }
    if (res.boardState && handHas(res.boardState, 0, 46986414)) {
      drewInjected = true
      console.log(
        `[inject-smoke] 抽卡验证: 第 ${drawSteps} 次作答后抽到注入的卡组顶卡片 46986414`
      )
      break
    }
  }
  assert(drewInjected, '卡组顶注入的卡应被下一次抽到')

  const afterDrawId = lastNodeId()
  const replayBack = await duelSession.jumpToStep(beforeInjectId)
  assert(!handHas(replayBack.boardState, 0, 46986414), '回退后未抽到的卡不应在手牌')
  assert(replayBack.boardState.players[0].lp === beforeLp, '回退后 LP 恢复原值')
  const replayForward = await duelSession.jumpToStep(afterDrawId)
  assert(handHas(replayForward.boardState, 0, 46986414), '混合重放后抽到的卡重新出现')
  assert(
    replayForward.boardState.players[0].lp === lpInject.boardState.players[0].lp,
    '混合重放后 LP 一致'
  )
  console.log(
    `[inject-smoke] 混合重放: 回退手牌=${replayBack.boardState.players[0].hand.length} -> 前进手牌=${replayForward.boardState.players[0].hand.length} LP=${replayForward.boardState.players[0].lp}`
  )

  const matrix: Array<{ name: string; command: Parameters<typeof duelSession.inject>[0]; check: (b: EngineBoardState) => boolean }> = [
    {
      name: 'grave-top',
      command: { op: 'add-card', player: 0, code: 23434538, to: 'grave-top' },
      check: (b) => b.players[0].graveyard.some((c) => c.code === 23434538)
    },
    {
      name: 'removed',
      command: { op: 'add-card', player: 0, code: 14558127, to: 'removed' },
      check: (b) => b.players[0].banished.some((c) => c.code === 14558127)
    },
    {
      name: 'mzone',
      command: { op: 'add-card', player: 0, code: 89631139, to: 'mzone', sequence: 0 },
      check: (b) => b.players[0].mzone[0]?.code === 89631139
    },
    {
      name: 'szone',
      command: { op: 'add-card', player: 0, code: 53129443, to: 'szone', sequence: 1 },
      check: (b) => b.players[0].szone[1]?.code === 53129443
    },
    {
      name: 'fzone',
      command: { op: 'add-card', player: 0, code: 59197169, to: 'fzone' },
      check: (b) => {
        console.log(
          `[inject-smoke] fzone 查询: fzone=${b.players[0].fzone?.code ?? '空'} szone5=${b.players[0].szone[5]?.code ?? '空'}`
        )
        return (
          b.players[0].fzone?.code === 59197169 || b.players[0].szone[5]?.code === 59197169
        )
      }
    },
    {
      name: 'deck-bottom',
      command: { op: 'add-card', player: 0, code: 89631139, to: 'deck-bottom' },
      check: (b) => b.players[0].deck?.some((c) => c.code === 89631139) === true
    },
    {
      name: 'deck-shuffle',
      command: { op: 'add-card', player: 0, code: 46986414, to: 'deck-shuffle' },
      check: (b) => b.players[0].deck?.some((c) => c.code === 46986414) === true
    }
  ]

  for (const item of matrix) {
    const before = duelSession.getBoardState()
    const result = await duelSession.inject(item.command)
    const ok = item.check(result.boardState)
    console.log(
      `[inject-smoke] 注入 ${item.name}: ${ok ? '成功' : '失败'} warning=${result.warning ?? '无'}`
    )
    if (!ok && !result.warning) {
      throw new Error(`注入 ${item.name} 未生效且没有 warning`)
    }
    if (ok) {
      assert(result.node.opIndex === duelSession.getTimeline().at(-1)!.opIndex, '节点关联 opIndex')
      assert(result.boardState.players[0].lp === before.players[0].lp, '普通注入不改变 LP')
    }
  }

  const extraCard = cdbService.findCardsByType(CardType.FUSION, 1)[0]
  if (extraCard) {
    const before = duelSession.getBoardState()
    const result = await duelSession.inject({
      op: 'add-card',
      player: 0,
      code: extraCard.id,
      to: 'hand'
    })
    const handDelta = result.boardState.players[0].hand.length - before.players[0].hand.length
    const extraDelta = result.boardState.players[0].extraCount - before.players[0].extraCount
    console.log(
      `[inject-smoke] 额外卡组怪兽塞手牌: code=${extraCard.id} 手牌变化=${handDelta} 额外卡组变化=${extraDelta} warning=${result.warning ?? '无'}`
    )
    assert(handDelta === 0 && extraDelta === 1, '额外卡组怪兽应被重定向到额外卡组')
    assert(Boolean(result.warning), '额外卡组重定向必须返回 warning')
  }

  const beforeBulk = duelSession.getBoardState().players[0].deckCount
  for (let i = 0; i < 60; i++) {
    await duelSession.inject({ op: 'add-card', player: 0, code: 23434538, to: 'deck-top' })
  }
  const afterBulk = duelSession.getBoardState().players[0].deckCount
  console.log(
    `[inject-smoke] 卡组无上限: 注入前 ${beforeBulk} 张 -> 注入 60 张后 ${afterBulk} 张`
  )
  assert(afterBulk === beforeBulk + 60, '卡组注入 60 张不应被数量上限拦截')

  const timeline = duelSession.getTimeline()
  let lastOpIndex = -1
  for (const node of timeline) {
    assert(node.opIndex >= lastOpIndex, '节点 opIndex 单调递增')
    lastOpIndex = node.opIndex
  }
  console.log(
    `[inject-smoke] 时间线: ${timeline.length} 节点, 最后 opIndex=${timeline.at(-1)!.opIndex}, answer 响应 ${duelSession.getAllTimelineResponses().length} 条`
  )
  console.log('[inject-smoke] ALL CHECKS PASSED')
  process.exit(0)
}

main().catch((err) => {
  console.error('[inject-smoke] FAILED:', err)
  process.exit(1)
})
