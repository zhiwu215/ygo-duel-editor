/**
 * 场上标记数据冒烟：验证 FieldReader 从引擎查询里读出装备关系与效果对象关系。
 * 覆盖：装备魔法发动后 szone 卡片的 equipTargetInstanceId 与 targetInstanceIds。
 */
import { duelSession } from '../../src/main/services/duel/duel-session'
import { cdbService } from './cdb-shim'
import {
  CardLocation,
  CardPosition,
  createInitialDuelState,
  DuelPuzzleState,
  FieldCard,
  normalizeDuelState
} from '@shared/index'
import type { Answer, EngineRequest } from '@shared/engine/protocol'
import { resolveActionablePiles } from '../../src/renderer/src/utils/pileActionIndicator'

const BLUE_EYES = 89631139
const DARK_MAGICIAN = 46986414
const AXE_OF_DESPARE = 40619825
const LEVEL_THREE_A = 32864
const LEVEL_THREE_B = 114932
const RANK_THREE_XYZ = 15914410

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
  const base = createInitialDuelState(5, 'full')
  const cards: FieldCard[] = [
    makeCard(BLUE_EYES, 0, CardLocation.MZONE, 0, CardPosition.FACEUP_ATTACK),
    makeCard(AXE_OF_DESPARE, 0, CardLocation.HAND, 0, CardPosition.FACEUP)
  ]
  for (let i = 0; i < 8; i++) {
    cards.push(makeCard(BLUE_EYES, 0, CardLocation.DECK, i, CardPosition.FACEDOWN_DEFENSE))
    cards.push(makeCard(DARK_MAGICIAN, 1, CardLocation.DECK, i, CardPosition.FACEDOWN_DEFENSE))
  }
  return normalizeDuelState({
    ...base,
    title: '场上标记联测',
    turnPlayer: 0,
    cards,
    duelists: [
      { id: 'duelist_0_0', team: 0, name: '我方', lp: 8000, isFirst: true, turnOrder: 1 },
      { id: 'duelist_1_0', team: 1, name: '对方', lp: 8000, turnOrder: 2 }
    ]
  })
}

function answer(request: EngineRequest): Answer {
  const d = request.data
  switch (d.kind) {
    case 'idle': {
      const target = d.activatable.find((card) => card.code === AXE_OF_DESPARE)
      if (target) return { kind: 'idle', cmd: 'ACTIVATE', card: target }
      return { kind: 'idle', cmd: d.canEp ? 'TO_EP' : 'TO_BP' }
    }
    case 'chain':
      return { kind: 'chain', card: null }
    case 'card': {
      const target = d.cards.find((card) => card.code === BLUE_EYES)
      if (target) return { kind: 'card', cards: [target] }
      if (d.cancelable) return { kind: 'card', cards: null }
      return { kind: 'card', cards: d.cards.slice(0, Math.max(1, d.min)) }
    }
    case 'yesno':
      return { kind: 'yesno', yes: false }
    case 'position':
      return { kind: 'position', position: d.positions[0] }
    case 'option':
      return { kind: 'option', index: 0 }
    case 'place':
      return { kind: 'place', places: d.places.slice(0, Math.max(1, d.count)) }
    case 'unselect':
      return { kind: 'unselect', card: null }
    case 'rps':
      return { kind: 'rps', hand: 'paper' }
    case 'announce':
      return d.announceType === 'number'
        ? { kind: 'announce', value: d.numbers![0] }
        : { kind: 'announce', value: d.availableMask ? d.availableMask & -d.availableMask : 1 }
    default:
      return { kind: 'idle', cmd: 'TO_EP' }
  }
}

function buildXyzPuzzle(): DuelPuzzleState {
  const base = createInitialDuelState(5, 'full')
  const cards: FieldCard[] = [
    makeCard(LEVEL_THREE_A, 0, CardLocation.MZONE, 0, CardPosition.FACEUP_ATTACK),
    makeCard(LEVEL_THREE_B, 0, CardLocation.MZONE, 1, CardPosition.FACEUP_ATTACK),
    makeCard(RANK_THREE_XYZ, 0, CardLocation.EXTRA, 0, CardPosition.FACEDOWN_DEFENSE)
  ]
  for (let i = 0; i < 8; i++) {
    cards.push(makeCard(BLUE_EYES, 0, CardLocation.DECK, i, CardPosition.FACEDOWN_DEFENSE))
    cards.push(makeCard(DARK_MAGICIAN, 1, CardLocation.DECK, i, CardPosition.FACEDOWN_DEFENSE))
  }
  return normalizeDuelState({
    ...base,
    title: '额外卡组标记联测',
    turnPlayer: 0,
    cards,
    duelists: [
      { id: 'duelist_0_0', team: 0, name: '我方', lp: 8000, isFirst: true, turnOrder: 1 },
      { id: 'duelist_1_0', team: 1, name: '对方', lp: 8000, turnOrder: 2 }
    ]
  })
}

async function checkEquipRelations(): Promise<void> {
  await duelSession.setTimingPolicy({ chain: 'all', effectYn: 'ask' })
  await duelSession.startDuel({ puzzleState: buildPuzzle() })

  for (let step = 0; step < 20; step++) {
    const request = duelSession.getPendingRequest()
    if (!request) break
    const result = await duelSession.submitAnswer(answer(request))
    if (result.retry) throw new Error(`RETRY: ${request.kind}`)
    const board = result.boardState ?? duelSession.getBoardState()
    const equipSpell = board.allCards.find(
      (card) => card.code === AXE_OF_DESPARE && card.location === CardLocation.SZONE
    )
    if (!equipSpell?.equipTargetInstanceId) continue

    const equippedMonster = board.allCards.find((card) => card.code === BLUE_EYES)
    if (!equippedMonster) throw new Error('装备测试：找不到怪兽')
    if (equipSpell.equipTargetInstanceId !== equippedMonster.instanceId) {
      throw new Error(
        `装备关系错误: spell.equip=${equipSpell.equipTargetInstanceId} monster=${equippedMonster.instanceId}`
      )
    }
    if (!equipSpell.targetInstanceIds?.includes(equippedMonster.instanceId)) {
      throw new Error(
        `对象关系缺失: spell.targets=${(equipSpell.targetInstanceIds ?? []).join(',')} monster=${equippedMonster.instanceId}`
      )
    }
    console.log('[card-relations-smoke] 装备关系:', equipSpell.equipTargetInstanceId)
    console.log('[card-relations-smoke] 对象关系:', equipSpell.targetInstanceIds.join(','))
    return
  }
  throw new Error('装备魔法没有产生装备关系')
}

async function checkExtraDeckAction(): Promise<void> {
  const started = await duelSession.startDuel({ puzzleState: buildXyzPuzzle() })
  const request = started.pendingRequest
  if (!request || request.data.kind !== 'idle') {
    throw new Error(`额外卡组测试：首个请求不是 idle（${request?.kind ?? 'null'}）`)
  }
  const extra = request.data.spSummonable.find(
    (card) => card.controller === 0 && card.location === CardLocation.EXTRA
  )
  if (!extra) throw new Error('额外卡组测试：引擎没有给出可超量召唤的额外卡组卡')
  if (!resolveActionablePiles(request, 0).has(CardLocation.EXTRA)) {
    throw new Error('额外卡组测试：未生成额外卡组动作标记')
  }
  if (resolveActionablePiles(request, 1).has(CardLocation.EXTRA)) {
    throw new Error('额外卡组测试：动作标记错误地落到了对方')
  }
  console.log('[card-relations-smoke] 额外卡组动作标记:', extra.code, '-> EXTRA')
}

async function main(): Promise<void> {
  await cdbService.ready()
  await checkEquipRelations()
  await checkExtraDeckAction()
  console.log('[card-relations-smoke] 全部通过')
  process.exit(0)
}

main().catch((err) => {
  console.error('[card-relations-smoke] FAILED:', err)
  process.exit(1)
})
