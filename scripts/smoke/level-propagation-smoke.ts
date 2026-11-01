/**
 * 等级传导冒烟：「代价降低」把手上怪兽等级 -2 后，
 * 引擎查询 → FieldReader → resolveEngineCardStats 的 customLevel 必须跟着变，
 * 且升级到场上后仍然生效（脚本用 RESET_TOFIELD 复位，参考官方客户端读 QUERY_LEVEL）。
 */
import { duelSession } from '../../src/main/services/duel/duel-session'
import {
  CardLocation,
  CardPosition,
  normalizeDuelState,
  resolveEngineCardStats,
  resolveEngineStarLevel,
  type Answer,
  type Duelist,
  type EngineCard,
  type EngineRequest,
  type FieldCard
} from '@shared/index'
import { cdbService } from './cdb-shim'

const COST_DOWN = 23265313
const GARGOYLE = 24611934
const BLUE_EYES = 89631139
const POT_OF_GREED = 55144522
const LINK_MONSTER = 146746

let fieldId = 0

function makeCard(code: number, controller: 0 | 1, location: number, sequence: number): FieldCard {
  const position =
    location === CardLocation.HAND
      ? CardPosition.FACEDOWN
      : location === CardLocation.MZONE
        ? CardPosition.FACEUP_ATTACK
        : CardPosition.FACEDOWN_DEFENSE
  return {
    instanceId: `card-${++fieldId}`,
    code,
    controller,
    owner: controller,
    location,
    sequence,
    position,
    overlayMaterials: [],
    duelistId: controller === 0 ? 'duelist_0_0' : 'duelist_1_0'
  }
}

function buildPuzzle(): ReturnType<typeof normalizeDuelState> {
  const cards: FieldCard[] = [
    makeCard(COST_DOWN, 0, CardLocation.HAND, 0),
    makeCard(GARGOYLE, 0, CardLocation.HAND, 1),
    makeCard(POT_OF_GREED, 0, CardLocation.HAND, 2),
    makeCard(POT_OF_GREED, 0, CardLocation.HAND, 3),
    makeCard(BLUE_EYES, 0, CardLocation.MZONE, 0),
    makeCard(LINK_MONSTER, 0, CardLocation.MZONE, 1),
    ...Array.from({ length: 8 }, (_, index) => makeCard(BLUE_EYES, 0, CardLocation.DECK, index)),
    ...Array.from({ length: 8 }, (_, index) => makeCard(BLUE_EYES, 1, CardLocation.DECK, index))
  ]
  const duelists: Duelist[] = [
    { id: 'duelist_0_0', team: 0, name: '我方', lp: 8000, isFirst: true, turnOrder: 1 },
    { id: 'duelist_1_0', team: 1, name: '对方', lp: 8000, turnOrder: 2 }
  ]
  return normalizeDuelState({
    version: '1.2.0',
    title: '等级传导联测',
    hint: '',
    duelType: 'full',
    masterRule: 5,
    players: [
      { lp: 8000, maxHand: 0, startHand: 0 },
      { lp: 8000, maxHand: 0, startHand: 0 }
    ],
    turnPlayer: 0 as 0 | 1,
    firstTurnAttack: false,
    cards,
    steps: [],
    duelists,
    matchConfig: { mode: '1v1', team0Count: 1, team1Count: 1, sharedLp: false },
    scenarios: {}
  })
}

function assert(condition: boolean, message: string): void {
  if (!condition) throw new Error(`断言失败: ${message}`)
}

function findCard(code: number, location: number): EngineCard | undefined {
  const board = duelSession.getBoardState()
  return board.players[0][location === CardLocation.MZONE ? 'mzone' : 'hand']
    .filter((card): card is EngineCard => Boolean(card))
    .find((card) => card.code === code)
}

function answerFor(request: EngineRequest, action: 'activate' | 'summon'): Answer | null {
  const data = request.data
  switch (data.kind) {
    case 'rps':
      return { kind: 'rps', hand: 'paper' }
    case 'idle': {
      if (action === 'activate') {
        const spell = data.activatable.find((card) => card.code === COST_DOWN)
        if (spell) return { kind: 'idle', cmd: 'ACTIVATE', card: spell }
        return { kind: 'idle', cmd: 'TO_EP' }
      }
      const monster = data.summonable.find((card) => card.code === GARGOYLE)
      if (monster) return { kind: 'idle', cmd: 'SUMMON', card: monster }
      return { kind: 'idle', cmd: 'TO_EP' }
    }
    case 'card': {
      const fodder = data.cards.find((card) => card.code === POT_OF_GREED)
      if (!fodder) return null
      return { kind: 'card', cards: [fodder] }
    }
    case 'place':
      return { kind: 'place', places: data.places.slice(0, Math.max(1, data.count)) }
    case 'chain':
      return { kind: 'chain', card: null }
    case 'yesno':
      return { kind: 'yesno', yes: false }
    case 'unselect':
      return { kind: 'unselect', card: null }
    case 'position':
      return { kind: 'position', position: data.positions[0] }
    case 'option':
      return { kind: 'option', index: 0 }
    default:
      throw new Error(`未覆盖 kind=${data.kind}`)
  }
}

function act(action: 'activate' | 'summon'): void {
  const pending = duelSession.getPendingRequest()
  if (pending?.data.kind !== 'idle') throw new Error('当前不是主要阶段')
  const answer = answerFor(pending, action)
  if (!answer || answer.kind !== 'idle' || answer.cmd === 'TO_EP') {
    throw new Error(`主要阶段没有可执行的行动: ${action}`)
  }
  duelSession.submitAnswer(answer)
  for (let guard = 0; guard < 40; guard++) {
    const next = duelSession.getPendingRequest()
    if (!next || next.data.kind === 'idle') return
    const follow = answerFor(next, action)
    if (!follow) throw new Error(`无法继续处理询问: ${next.data.kind}`)
    duelSession.submitAnswer(follow)
  }
}

async function main(): Promise<void> {
  await cdbService.ready()
  await duelSession.startDuel({ puzzleState: buildPuzzle() })
  const idle = duelSession.getPendingRequest()
  assert(idle?.data.kind === 'idle', '应进入主要阶段')

  const beforeHand = findCard(GARGOYLE, CardLocation.HAND)
  assert(Boolean(beforeHand), '手牌应有石像怪')
  assert(beforeHand!.level === 4, `发动前手牌等级应为 4，实际 ${beforeHand!.level}`)

  act('activate')
  const afterHand = findCard(GARGOYLE, CardLocation.HAND)
  assert(Boolean(afterHand), '结算后石像怪仍在手牌')
  assert(
    afterHand!.level === 2,
    `代价降低结算后手牌等级应降到 2，实际 level=${afterHand!.level} rank=${afterHand!.rank}`
  )

  act('summon')
  const onField = findCard(GARGOYLE, CardLocation.MZONE)
  assert(Boolean(onField), '石像怪应召唤到场上')
  assert(
    onField!.level === 2,
    `召唤后场上等级仍是 2，实际 level=${onField!.level} rank=${onField!.rank}`
  )

  const fieldStats = resolveEngineCardStats(onField!)
  assert(fieldStats?.customLevel === 2, `场上 customLevel 应为 2，实际 ${fieldStats?.customLevel}`)

  const blueEyes = findCard(BLUE_EYES, CardLocation.MZONE)
  assert(Boolean(blueEyes), '场上应有青眼白龙')
  assert(blueEyes!.level === 8, `未被修正的青眼白龙等级应为 8，实际 ${blueEyes!.level}`)
  assert(
    resolveEngineCardStats(blueEyes!)?.customLevel === undefined,
    '未被修正的怪兽不写 customLevel'
  )

  const link = findCard(LINK_MONSTER, CardLocation.MZONE)
  assert(Boolean(link), '场上应有连接怪兽')
  assert(resolveEngineStarLevel(link!) === undefined, '连接怪兽不参与等级覆盖')
  assert(resolveEngineCardStats(link!)?.customLevel === undefined, '连接怪兽不写 customLevel')

  console.log(
    `[level-smoke] 石像怪 手牌 L${afterHand!.level} / 场上 L${onField!.level}，青眼白龙 L${blueEyes!.level}`
  )
  console.log('[level-propagation-smoke] ALL CHECKS PASSED')
  process.exit(0)
}

main().catch((err) => {
  console.error('[level-propagation-smoke] FAILED:', err)
  process.exit(1)
})
