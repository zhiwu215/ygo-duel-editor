/**
 * 手牌切洗联测：青眼亚白龙（脚本 spop 里 Duel.ShuffleHand）特殊召唤后，
 * 会话必须把切洗记录成步骤事件（供 UI 播放洗牌动画与「手牌切洗」提示），
 * 否则玩家只能看到手牌凭空位移，误以为界面出错。
 */
import { duelSession } from '../../src/main/services/duel/duel-session'
import { CardLocation, CardPosition, Duelist, FieldCard, normalizeDuelState } from '@shared/index'
import type { Answer, EngineRequest, EngineTimelineNode } from '@shared/index'
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
    // 我方手牌：青眼亚白龙 + 用于展示的青眼白龙 + 若干洗牌可见的其它手牌
    makeCard(38517737, 0, CardLocation.HAND, 0, CardPosition.FACEDOWN),
    makeCard(89631139, 0, CardLocation.HAND, 1, CardPosition.FACEDOWN),
    makeCard(46986414, 0, CardLocation.HAND, 2, CardPosition.FACEDOWN),
    makeCard(70781052, 0, CardLocation.HAND, 3, CardPosition.FACEDOWN),
    makeCard(89631139, 0, CardLocation.HAND, 4, CardPosition.FACEDOWN),
    ...deck.map((code, i) => makeCard(code, 0, CardLocation.DECK, i, CardPosition.FACEDOWN_DEFENSE)),
    ...deck.map((code, i) => makeCard(code, 1, CardLocation.DECK, i, CardPosition.FACEDOWN_DEFENSE))
  ]

  const duelists: Duelist[] = [
    { id: 'duelist_0_0', team: 0, name: '我方', lp: 8000, isFirst: true, turnOrder: 1 },
    { id: 'duelist_1_0', team: 1, name: '对方', lp: 8000, isFirst: false, turnOrder: 2 }
  ]

  return normalizeDuelState({
    version: '1.2.0',
    title: '切洗联测',
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

async function main(): Promise<void> {
  {
    await cdbService.ready()
  }

  const start = await duelSession.startDuel({ puzzleState: buildPuzzle() })
  const nodes: EngineTimelineNode[] = [start.initialNode]
  const state = { summoned: false }

  for (let step = 0; step < 30; step++) {
    const pending = duelSession.getPendingRequest()
    if (!pending || (pending.kind as string) === 'END' || (pending.kind as string) === 'WAITING') break
    const res = duelSession.submitAnswer(autoAnswer(pending, state))
    if (res.retry) {
      console.log('[hand-shuffle-smoke] ⚠️ 答案被引擎拒绝（RETRY）')
      continue
    }
    if (res.node) nodes.push(res.node)
  }

  const shuffleNodes = nodes.filter((node) =>
    node.events.some((event) => event.kind === 'shuffle-hand' && event.player === 0)
  )
  const handShuffles = shuffleNodes.flatMap((node) => node.events)

  console.log(
    `[hand-shuffle-smoke] 步骤数=${nodes.length} 含切洗的步骤=${shuffleNodes.length} 切洗事件=${JSON.stringify(handShuffles)}`
  )
  if (shuffleNodes.length > 0) {
    console.log(`[hand-shuffle-smoke] 切洗步骤标题: ${shuffleNodes[0].title}`)
    console.log(
      `[hand-shuffle-smoke] 切洗后手牌: [${shuffleNodes[0].boardState.players[0].hand.map((c) => c.code).join(', ')}]`
    )
  }

  if (!state.summoned) throw new Error('亚白龙没有出现在 spSummonable，联测前置条件失效。')
  if (shuffleNodes.length === 0) throw new Error('引擎切洗了手牌，但会话没有产生 shuffle-hand 步骤事件。')
  if (!shuffleNodes[0].title.includes('手牌切洗')) {
    throw new Error(`切洗步骤标题缺少提示: ${shuffleNodes[0].title}`)
  }

  console.log('[hand-shuffle-smoke] PASS')
  process.exit(0)
}

main().catch((err) => {
  console.error('[hand-shuffle-smoke] FAILED:', err)
  process.exit(1)
})
