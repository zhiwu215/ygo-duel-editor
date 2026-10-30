/**
 * 宣言询问回归联测：
 * 「惊喜融合」这类卡在同一段脚本里连续宣言种族和属性，引擎会在两次宣言之间插入一条
 * 只有 HINT 的批次（status=1 但没有新的询问）。此时若沿用上一批的询问，
 * 会重复弹出同一个宣言框、并把重复应答写进操作流，最终导出的回放帧数多出两条，
 * 导致游戏里回放到该步时应答错位（Error occurs）。
 */
import { duelSession } from '../../src/main/services/duel/duel-session'
import { normalizeDuelState, DuelPuzzleState, FieldCard } from '@shared/index'
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
  return normalizeDuelState({
    version: '1.2.0',
    title: '宣言询问联测',
    hint: '',
    duelType: 'full',
    masterRule: 2,
    players: [
      { lp: 8000, maxHand: 0, startHand: 0 },
      { lp: 8000, maxHand: 0, startHand: 0 }
    ],
    turnPlayer: 0 as 0 | 1,
    firstTurnAttack: false,
    cards: [
      makeCard(35167375, 0, 0x02, 0, 0xa),
      makeCard(12307878, 0, 0x04, 2, 0x1),
      makeCard(76714458, 0, 0x01, 0, 0x8),
      makeCard(57294268, 0, 0x01, 1, 0x8),
      makeCard(69140098, 1, 0x02, 0, 0xa),
      makeCard(21522601, 1, 0x01, 0, 0x8)
    ],
    steps: [],
    duelists: [
      { id: 'duelist_0_0', team: 0, name: '我方', lp: 8000, isFirst: true, turnOrder: 1 },
      { id: 'duelist_1_0', team: 1, name: '对方', lp: 8000, turnOrder: 2 }
    ],
    matchConfig: { mode: '1v1', team0Count: 1, team1Count: 1, sharedLp: false },
    scenarios: {}
  })
}

function assert(condition: boolean, message: string): void {
  if (!condition) throw new Error(`断言失败: ${message}`)
}

function answerFor(request: EngineRequest, state: { activated: boolean }): Answer {
  const d = request.data
  switch (d.kind) {
    case 'idle': {
      const surprise = d.activatable.find((card) => card.code === 35167375)
      if (surprise && !state.activated) {
        state.activated = true
        return { kind: 'idle', cmd: 'ACTIVATE', card: surprise }
      }
      return { kind: 'idle', cmd: 'TO_EP' }
    }
    case 'card':
      return d.cancelable
        ? { kind: 'card', cards: null }
        : { kind: 'card', cards: d.cards.slice(0, Math.max(1, d.min)) }
    case 'announce':
      return { kind: 'announce', value: d.availableMask ? d.availableMask & -d.availableMask : 1 }
    case 'chain':
      return { kind: 'chain', card: null }
    case 'yesno':
      return { kind: 'yesno', yes: false }
    case 'option':
      return { kind: 'option', index: 0 }
    case 'position':
      return { kind: 'position', position: d.positions[0] }
    case 'place':
      return { kind: 'place', places: d.places.slice(0, Math.max(1, d.count)) }
    case 'unselect':
      return { kind: 'unselect', card: null }
    case 'rps':
      return { kind: 'rps', hand: 'paper' }
    default:
      throw new Error(`answerFor 未覆盖 kind=${d satisfies never as string}`)
  }
}

async function main(): Promise<void> {
  const { cdbService } = await import('./cdb-shim')
  await cdbService.ready()

  await duelSession.startDuel({ puzzleState: buildPuzzle() })

  const announceKinds: string[] = []
  const requests: string[] = []
  const policyState = { activated: false }
  let retries = 0
  for (let step = 0; step < 20; step++) {
    const pending = duelSession.getPendingRequest()
    if (!pending || pending.kind === 'END' || pending.kind === 'WAITING') break
    requests.push(`${pending.kind}:${pending.player}`)
    if (pending.kind === 'announce' && pending.data.kind === 'announce') {
      announceKinds.push(pending.data.announceType)
    }
    const res = duelSession.submitAnswer(answerFor(pending, policyState))
    if (res.retry) retries += 1
    if (announceKinds.length >= 4) break
  }

  console.log(`[announce-order] 请求序列: ${requests.join(' -> ')}`)
  console.log(`[announce-order] 宣言序列: ${announceKinds.join(',')}  RETRY=${retries}`)
  assert(retries === 0, `应答被拒绝 ${retries} 次`)
  assert(
    announceKinds.join(',') === 'race,attrib',
    `宣言询问应恰好为 race,attrib，实际 ${announceKinds.join(',')}`
  )
  console.log('[announce-order-smoke] OK')
  process.exit(0)
}

main().catch((err) => {
  console.error('[announce-order-smoke] FAILED:', err)
  process.exit(1)
})
