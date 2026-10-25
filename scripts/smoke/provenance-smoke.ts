import { duelSession } from '../../src/main/services/duel/duel-session'
import {
  normalizeDuelState,
  Duelist,
  FieldCard,
  CardLocation,
  CardPosition,
  EngineBoardState,
  EngineCard,
  EngineCardRef,
  EngineProvenance,
  PLACEHOLDER_CARD_CODE
} from '@shared/index'
import { cdbService } from './cdb-shim'
import { autoAnswer } from './autoAnswer'
import { settleToIdle } from './settleToIdle'

const INITIAL_HAND = 53129443
const INJECT_HAND = 46986414
const INJECT_HAND_REPLACED = 70781052
const INITIAL_REPLACED = 38517737
const INJECT_DECK = 89631139
const INJECT_DECK_REPLACED = 46986414
const REMOVE_CODE = 12580477

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
  const p0Deck = [97997309, 23434538, 14558127, 70342110, 66518841]
  const p1Deck = [23434538, 14558127, 70342110, 66518841, 97997309]
  const cards: FieldCard[] = [
    ...p0Deck.map((code, i) =>
      makeCard(code, 0, CardLocation.DECK, i, CardPosition.FACEDOWN_DEFENSE)
    ),
    makeCard(INITIAL_HAND, 0, CardLocation.HAND, 0, CardPosition.FACEUP_ATTACK),
    makeCard(38517737, 0, CardLocation.MZONE, 0, CardPosition.FACEUP_ATTACK),
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
    title: '溯源联测',
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

function handCards(board: EngineBoardState, player: 0 | 1): EngineCard[] {
  return board.players[player].hand
}

function findHandCard(
  board: EngineBoardState,
  player: 0 | 1,
  code: number
): EngineCard | undefined {
  return handCards(board, player).find((card) => card.code === code)
}

function refOf(card: EngineCard): EngineCardRef {
  return {
    controller: card.controller,
    location: card.location,
    sequence: card.sequence,
    instanceId: card.instanceId,
    duelistId: card.duelistId
  }
}

function boardSignature(board: EngineBoardState): string {
  const players = board.players.map((player) => ({
    lp: player.lp,
    hand: player.hand.map((card) => `${card.controller}:${card.sequence}:${card.code}`).sort(),
    deck: (player.deck ?? []).map((card) => `${card.sequence}:${card.code}`).sort(),
    grave: player.graveyard.map((card) => `${card.sequence}:${card.code}`).sort(),
    banished: player.banished.map((card) => `${card.sequence}:${card.code}`).sort(),
    mzone: player.mzone.map((card) => card && `${card.sequence}:${card.code}`).filter(Boolean),
    szone: player.szone.map((card) => card && `${card.sequence}:${card.code}`).filter(Boolean)
  }))
  return JSON.stringify({
    turn: board.turn,
    turnPlayer: board.turnPlayer,
    phase: board.phase,
    players
  })
}

function assert(condition: boolean, message: string): void {
  if (!condition) throw new Error(`断言失败: ${message}`)
}

function assertBoardMatches(a: EngineBoardState, b: EngineBoardState, label: string): void {
  assert(boardSignature(a) === boardSignature(b), `${label} 快照不一致`)
}

let retries = 0

async function main(): Promise<void> {
  await cdbService.ready()
  const state = buildPuzzle()
  const start = await duelSession.startDuel({ puzzleState: state })
  console.log(
    `[provenance-smoke] 开局: 手牌=${start.boardState.players[0].hand.length} 卡组=${start.boardState.players[0].deckCount}`
  )

  await settleToIdle(40)

  const initialHandCard = findHandCard(duelSession.getBoardState(), 0, INITIAL_HAND)
  assert(Boolean(initialHandCard), '初始手牌存在')
  const initialProvenance = duelSession.getProvenance(refOf(initialHandCard!))
  assert(initialProvenance.kind === 'initial', '初始手牌来源为 initial')
  assert(
    initialProvenance.kind === 'initial' && initialProvenance.code === INITIAL_HAND,
    '初始来源携带正确卡密'
  )
  console.log(
    `[provenance-smoke] 初始来源: ${initialProvenance.kind} loc=${initialProvenance.kind === 'initial' ? initialProvenance.location : '?'}`
  )

  const deckCard = duelSession.getBoardState().players[0].deck?.find((c) => c.code === 97997309)
  assert(Boolean(deckCard), '初始卡组卡存在')
  const deckProvenance = duelSession.getProvenance(refOf(deckCard!))
  assert(deckProvenance.kind === 'initial', '初始卡组来源为 initial')
  console.log('[provenance-smoke] 初始卡组追溯: OK')

  const fieldCard = duelSession.getBoardState().players[0].mzone[0]
  assert(Boolean(fieldCard), '初始场上卡存在')
  const fieldProvenance = duelSession.getProvenance(refOf(fieldCard!))
  assert(fieldProvenance.kind === 'initial', '初始场上卡来源为 initial')
  const fieldReplace = await duelSession.replaceCard(refOf(fieldCard!), 89631139)
  assert(!fieldReplace.error, `替换场上卡失败: ${fieldReplace.error ?? ''}`)
  assert(fieldReplace.boardState!.players[0].mzone[0]?.code === 89631139, '场上卡替换后新卡出现')
  console.log('[provenance-smoke] 初始场上卡替换: OK')

  const placeholderInject = await duelSession.inject({
    op: 'add-card',
    player: 0,
    code: PLACEHOLDER_CARD_CODE,
    to: 'hand'
  })
  const placeholderCard = findHandCard(placeholderInject.boardState, 0, PLACEHOLDER_CARD_CODE)
  assert(Boolean(placeholderCard), '占位卡应进入手牌')
  const placeholderProvenance = duelSession.getProvenance(refOf(placeholderCard!))
  assert(placeholderProvenance.kind === 'inject', '占位卡来源为 inject')
  const placeholderRemove = await duelSession.removeCard(refOf(placeholderCard!))
  assert(!placeholderRemove.error, `移除占位卡失败: ${placeholderRemove.error ?? ''}`)
  console.log('[provenance-smoke] 占位卡注入/移除: OK')

  const placeholderMonster = await duelSession.inject({
    op: 'add-card',
    player: 0,
    code: PLACEHOLDER_CARD_CODE,
    to: 'mzone',
    sequence: 1,
    position: CardPosition.FACEUP_ATTACK
  })
  assert(
    placeholderMonster.boardState.players[0].mzone[1]?.code === PLACEHOLDER_CARD_CODE,
    '占位卡应能放入怪兽区'
  )
  const placeholderMonsterRemove = await duelSession.removeCard(
    refOf(placeholderMonster.boardState.players[0].mzone[1]!)
  )
  assert(!placeholderMonsterRemove.error, '占位怪兽区卡应能移除')

  const placeholderSpell = await duelSession.inject({
    op: 'add-card',
    player: 0,
    code: PLACEHOLDER_CARD_CODE,
    to: 'szone',
    sequence: 0,
    position: CardPosition.FACEDOWN
  })
  assert(
    placeholderSpell.boardState.players[0].szone[0]?.code === PLACEHOLDER_CARD_CODE,
    '占位卡应能放入魔陷区'
  )
  const placeholderSpellRemove = await duelSession.removeCard(
    refOf(placeholderSpell.boardState.players[0].szone[0]!)
  )
  assert(!placeholderSpellRemove.error, '占位魔陷区卡应能移除')
  console.log('[provenance-smoke] 占位卡放怪兽区/魔陷区: OK')

  const beforeInjectHand = duelSession.getBoardState().players[0].hand.length
  const handInject = await duelSession.inject({
    op: 'add-card',
    player: 0,
    code: INJECT_HAND,
    to: 'hand'
  })
  const injected = findHandCard(handInject.boardState, 0, INJECT_HAND)
  assert(Boolean(injected), '注入手牌存在')
  const injectProvenance = duelSession.getProvenance(refOf(injected!))
  assert(injectProvenance.kind === 'inject', '注入卡来源为 inject')
  assert(
    injectProvenance.kind === 'inject' &&
      injectProvenance.command.op === 'add-card' &&
      injectProvenance.command.code === INJECT_HAND,
    '注入来源携带命令'
  )
  assert(Boolean(injectProvenance.nodeId), '注入来源携带 nodeId')
  console.log(
    `[provenance-smoke] 注入来源: kind=${injectProvenance.kind} opIndex=${injectProvenance.opIndex} node=${injectProvenance.nodeId ? '有' : '无'}`
  )

  const replaced = await duelSession.replaceCard(refOf(injected!), INJECT_HAND_REPLACED)
  assert(!replaced.error, `替换注入卡失败: ${replaced.error ?? ''}`)
  assert(Boolean(replaced.boardState && replaced.node), '替换返回场地与节点')
  const handAfterReplace = replaced.boardState!.players[0].hand
  assert(handAfterReplace.length === beforeInjectHand + 1, '替换后手牌数量不变')
  assert(!handAfterReplace.some((c) => c.code === INJECT_HAND), '替换后旧卡消失')
  const replacedCard = handAfterReplace.find((c) => c.code === INJECT_HAND_REPLACED)
  assert(Boolean(replacedCard), '替换后新卡在手牌')
  const replacedProvenance = duelSession.getProvenance(refOf(replacedCard!))
  assert(replacedProvenance.kind === 'inject', '替换后新卡来源仍为 inject')
  assert(
    replacedProvenance.kind === 'inject' &&
      replacedProvenance.command.code === INJECT_HAND_REPLACED,
    '替换后注入命令已更新'
  )
  assertBoardMatches(replaced.boardState!, duelSession.getBoardState(), '替换后')
  console.log('[provenance-smoke] 注入手牌替换: OK')

  const initialHandNow = findHandCard(duelSession.getBoardState(), 0, INITIAL_HAND)
  assert(Boolean(initialHandNow), '初始手牌仍在')
  const initialReplace = await duelSession.replaceCard(refOf(initialHandNow!), INITIAL_REPLACED)
  assert(!initialReplace.error, `替换初始手牌失败: ${initialReplace.error ?? ''}`)
  const initialHandAfter = initialReplace.boardState!.players[0].hand
  assert(!initialHandAfter.some((c) => c.code === INITIAL_HAND), '初始手牌替换后旧卡消失')
  const initialReplacedCard = initialHandAfter.find((c) => c.code === INITIAL_REPLACED)
  assert(Boolean(initialReplacedCard), '初始手牌替换后新卡出现')
  const initialReplacedProvenance = duelSession.getProvenance(refOf(initialReplacedCard!))
  assert(initialReplacedProvenance.kind === 'initial', '初始手牌替换后来源仍为 initial')
  assertBoardMatches(initialReplace.boardState!, duelSession.getBoardState(), '初始替换后')
  console.log('[provenance-smoke] 初始手牌替换: OK')

  const beforeRemoveNodeId = duelSession.getTimeline().at(-1)!.id
  const removeInject = await duelSession.inject({
    op: 'add-card',
    player: 0,
    code: REMOVE_CODE,
    to: 'hand'
  })
  const removeNodeId = removeInject.node.id
  const removeCard = findHandCard(removeInject.boardState, 0, REMOVE_CODE)
  assert(Boolean(removeCard), '待移除注入卡存在')
  const removed = await duelSession.removeCard(refOf(removeCard!))
  assert(!removed.error, `移除注入卡失败: ${removed.error ?? ''}`)
  assert(
    !removed.boardState!.players[0].hand.some((c) => c.code === REMOVE_CODE),
    '移除后注入卡消失'
  )
  assertBoardMatches(removed.boardState!, duelSession.getBoardState(), '移除后')

  const rewind = await duelSession.jumpToStep(beforeRemoveNodeId)
  assert(
    !rewind.boardState.players[0].hand.some((c) => c.code === REMOVE_CODE),
    '回退到注入前没有该卡'
  )
  const forward = await duelSession.jumpToStep(removeNodeId)
  assert(
    !forward.boardState.players[0].hand.some((c) => c.code === REMOVE_CODE),
    '前进到移除节点仍没有该卡'
  )
  assertBoardMatches(forward.boardState, removed.node!.boardState, '移除后回退/前进')
  console.log('[provenance-smoke] 注入卡移除 + 回退/前进: OK')

  const deckInject = await duelSession.inject({
    op: 'add-card',
    player: 0,
    code: INJECT_DECK,
    to: 'deck-top'
  })
  assert(deckInject.boardState.players[0].deckCount > 0, '卡组顶注入成功')

  let drewInjected = false
  for (let step = 0; step < 120 && !drewInjected; step++) {
    const pending = duelSession.getPendingRequest()
    if (!pending) break
    const res = duelSession.submitAnswer(autoAnswer(pending))
    if (res.retry) {
      retries += 1
      console.log('[provenance-smoke] ⚠️ RETRY')
      continue
    }
    if (findHandCard(duelSession.getBoardState(), 0, INJECT_DECK)) {
      drewInjected = true
    }
  }
  assert(drewInjected, '卡组顶注入的卡被抽到')

  const drawnCard = findHandCard(duelSession.getBoardState(), 0, INJECT_DECK)!
  const drawnProvenance: EngineProvenance = duelSession.getProvenance(refOf(drawnCard))
  assert(drawnProvenance.kind === 'inject' || drawnProvenance.kind === 'drawn', '抽到的卡可溯源')
  console.log(`[provenance-smoke] 抽卡来源: kind=${drawnProvenance.kind}`)

  const drawnReplace = await duelSession.replaceCard(refOf(drawnCard), INJECT_DECK_REPLACED)
  assert(!drawnReplace.error, `替换抽到的卡失败: ${drawnReplace.error ?? ''}`)
  const handAfterDrawReplace = drawnReplace.boardState!.players[0].hand
  assert(!handAfterDrawReplace.some((c) => c.code === INJECT_DECK), '重演后抽到的旧卡消失')
  const drawnReplacedCard = handAfterDrawReplace.find((c) => c.code === INJECT_DECK_REPLACED)
  assert(Boolean(drawnReplacedCard), '重演后手牌是新卡')
  const drawnReplacedProvenance = duelSession.getProvenance(refOf(drawnReplacedCard!))
  assert(
    drawnReplacedProvenance.kind === 'inject' ||
      drawnReplacedProvenance.kind === 'drawn' ||
      drawnReplacedProvenance.kind === 'initial',
    '替换后新卡仍可溯源'
  )
  assertBoardMatches(drawnReplace.boardState!, duelSession.getBoardState(), '抽卡替换后')
  console.log('[provenance-smoke] 注入卡组顶 -> 抽到 -> 替换: OK')

  const handBeforeSecondDraw = new Set(
    handCards(duelSession.getBoardState(), 0).map((card) => `${card.instanceId}`)
  )
  let secondDrawn: EngineCard | undefined
  for (let step = 0; step < 120 && !secondDrawn; step++) {
    const pending = duelSession.getPendingRequest()
    if (!pending) break
    const res = duelSession.submitAnswer(autoAnswer(pending))
    if (res.retry) {
      retries += 1
      console.log('[provenance-smoke] ⚠️ RETRY')
      continue
    }
    const candidate = handCards(duelSession.getBoardState(), 0).find(
      (card) => !handBeforeSecondDraw.has(card.instanceId)
    )
    if (candidate) {
      const provenance = duelSession.getProvenance(refOf(candidate))
      if (provenance.kind !== 'unknown') secondDrawn = candidate
    }
  }
  assert(Boolean(secondDrawn), '初始卡组抽卡出现')
  const secondCode = secondDrawn!.code
  const secondReplace = await duelSession.replaceCard(refOf(secondDrawn!), 12580477)
  assert(!secondReplace.error, `替换初始卡组抽到的卡失败: ${secondReplace.error ?? ''}`)
  const handAfterSecondReplace = secondReplace.boardState!.players[0].hand
  assert(
    !handAfterSecondReplace.some((card) => card.code === secondCode),
    '初始卡组抽卡替换后旧卡消失'
  )
  assert(
    handAfterSecondReplace.some((card) => card.code === 12580477),
    '初始卡组抽卡替换后新卡出现'
  )
  assertBoardMatches(secondReplace.boardState!, duelSession.getBoardState(), '初始卡组抽卡替换后')
  console.log(`[provenance-smoke] 初始卡组抽卡替换: ${secondCode} -> 12580477 OK`)

  const sessionDoc = duelSession.exportSessionDoc()
  const beforeRoundTrip = duelSession.getBoardState()
  const roundTrip = await duelSession.importSessionDoc(sessionDoc)
  assertBoardMatches(beforeRoundTrip, roundTrip.boardState, '会话导出/导入')
  console.log('[provenance-smoke] 编辑后会话导出/导入: OK')

  const timeline = duelSession.getTimeline()
  let lastOpIndex = -1
  for (const node of timeline) {
    assert(node.opIndex >= lastOpIndex, '节点 opIndex 单调递增')
    lastOpIndex = node.opIndex
  }
  assert(retries === 0, `全程 RETRY=${retries}`)
  console.log(
    `[provenance-smoke] 时间线: ${timeline.length} 节点, 最后 opIndex=${timeline.at(-1)!.opIndex}`
  )
  console.log('[provenance-smoke] ALL CHECKS PASSED')
  process.exit(0)
}

main().catch((err) => {
  console.error('[provenance-smoke] FAILED:', err)
  process.exit(1)
})
