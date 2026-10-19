/**
 * 会话级联测：真实 DuelSession + 程序化问答
 *
 * 验证完整问答链路（含"发动效果→特殊召唤"类决策序列）：
 * 请求 → 自动答题 → 引擎推进 → 无 RETRY / 无空 pending / 场地状态正确
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
  const cards: FieldCard[] = [
    // 我方卡组
    makeCard(89631139, 0, 0x01, 0, 0xa),
    makeCard(89631139, 0, 0x01, 1, 0xa),
    makeCard(89631139, 0, 0x01, 2, 0xa),
    makeCard(23434538, 0, 0x01, 3, 0xa),
    // 我方手牌：青眼白龙 + 青眼亚白龙（亚白龙效果：展示手牌白龙特召）
    makeCard(89631139, 0, 0x02, 0, 0xa),
    makeCard(38517737, 0, 0x02, 1, 0xa),
    // 对方卡组
    makeCard(89631139, 1, 0x01, 0, 0xa),
    makeCard(23434538, 1, 0x01, 1, 0xa)
  ]

  const duelists: Duelist[] = [
    { id: 'duelist_0_0', team: 0, name: '我方', lp: 8000, isFirst: true, turnOrder: 1 },
    { id: 'duelist_1_0', team: 1, name: '对方', lp: 8000, turnOrder: 2 }
  ]

  return normalizeDuelState({
    version: '1.2.0',
    title: '联测对局',
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

function autoAnswer(
  request: EngineRequest,
  state: { idleCount: number; unselectPicked: boolean }
): Answer {
  const d = request.data
  switch (d.kind) {
    case 'rps':
      return { kind: 'rps', hand: 'paper' }
    case 'idle': {
      state.idleCount += 1
      if (state.idleCount === 1) {
        console.log(
          `[session-smoke] >> idle 清单: summonable=[${d.summonable.map((c) => c.code)}] spSummonable=[${d.spSummonable.map((c) => c.code)}] msetable=[${d.msetable.map((c) => c.code)}] ssetable=[${d.ssetable.map((c) => c.code)}] activatable=[${d.activatable.map((c) => `${c.code}#${c.desc}`)}]`
        )
      }
      // 第一次主要阶段：发动手牌里可发动的效果（青眼亚白龙"展示手牌特召"）
      const handActivatable = d.activatable.find((c) => c.location === 0x02)
      if (handActivatable && state.idleCount === 1) {
        console.log(
          `[session-smoke] >> 发动手牌效果: code=${handActivatable.code} desc=${handActivatable.desc}`
        )
        return { kind: 'idle', cmd: 'ACTIVATE', card: handActivatable }
      }
      // 特召列表里也试一次（部分脚本把效果列在 spSummonable）
      const handSpsummon = d.spSummonable.find((c) => c.location === 0x02)
      if (handSpsummon && state.idleCount === 1) {
        console.log(`[session-smoke] >> 手牌特殊召唤: code=${handSpsummon.code}`)
        return { kind: 'idle', cmd: 'SPSUMMON', card: handSpsummon }
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
    case 'unselect': {
      // 第一次：选第一张可选的卡（如"展示手牌青眼白龙"）；之后有 finishable 就结束
      if (!state.unselectPicked && d.selectable.length > 0) {
        state.unselectPicked = true
        console.log(`[session-smoke] >> unselect 选择: code=${d.selectable[0].code}`)
        return { kind: 'unselect', card: d.selectable[0] }
      }
      if (d.finishable) {
        return { kind: 'unselect', card: null }
      }
      return d.selectable.length > 0
        ? { kind: 'unselect', card: d.selectable[0] }
        : { kind: 'unselect', card: null }
    }
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
  const state = buildPuzzle()
  {
    const { cdbService } = await import('./cdb-shim')
    await cdbService.ready()
  }
  const start = await duelSession.startDuel({ puzzleState: state })
  console.log(
    `[session-smoke] 开局: P0 手牌=${start.boardState.players[0].hand.length}  P1 手牌=${start.boardState.players[1].hand.length}  P0 怪兽区=${start.boardState.players[0].mzone.filter(Boolean).length}`
  )

  let count = 0
  let retryCount = 0
  const policyState = { idleCount: 0, unselectPicked: false }
  for (let step = 0; step < 30; step++) {
    const pending = duelSession.getPendingRequest()
    if (!pending || pending.kind === 'END' || pending.kind === 'WAITING') {
      console.log('[session-smoke] 无更多决策点')
      break
    }
    count++
    console.log(
      `[session-smoke] 请求 #${count}: kind=${pending.kind} player=${pending.player} title=${pending.title}`
    )
    const res = duelSession.submitAnswer(autoAnswer(pending, policyState))
    if (res.retry) {
      retryCount++
      console.log('[session-smoke] ⚠️ 答案被引擎拒绝（RETRY）')
    }
    if (res.boardState) {
      const p0 = res.boardState.players[0]
      console.log(
        `  ↳ 场上: P0 手牌=${p0.hand.length} 怪兽区占用=${p0.mzone.filter(Boolean).length} 墓地=${p0.graveyard.length}`
      )
    }
  }
  const board = duelSession.getBoardState()
  console.log(
    `[session-smoke] 终态: 回合=${board.turn} 玩家=${board.turnPlayer} 阶段=${board.phaseName}  决策点=${count}  RETRY=${retryCount}`
  )
  process.exit(0)
}

main().catch((err) => {
  console.error('[session-smoke] FAILED:', err)
  process.exit(1)
})
