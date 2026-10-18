/**
 * 攻击链路专项冒烟：首回合战阶限制 + 选择攻击对象 / 直接攻击两条分支。
 * 覆盖：idle → TO_BP；battle → ATTACK；yesno(desc=31) 分支；card(descHint=549) 选目标。
 * 断言：出现 YGOProMsgAttack / YGOProMsgBattle / YGOProMsgDamage，LP 按规则扣减，无 RETRY，
 *        descHint 只在攻击目标选择那一次请求上出现。
 */
import { duelSession } from '../../src/main/services/duel/duel-session'
import { getOcgcoreEngine } from './ocgcore-engine-shim'
import {
  CardLocation,
  CardPosition,
  createInitialDuelState,
  Duelist,
  DuelPuzzleState,
  FieldCard,
  normalizeDuelState
} from '@shared/index'
import type { Answer, EngineRequest } from '@shared/engine/protocol'

const BLUE_EYES = 89631139
const DARK_MAGICIAN = 46986414
const EARTHBOUND_IMMORTAL = 10875327
const NECROVALLEY = 47355498

const ATTACK_TARGET_DESC_HINT = 549
const DIRECT_ATTACK_YESNO_DESC = 31

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

function buildPuzzle(options: {
  attacker: number
  fieldSpell?: number
  defender?: number
  defenderPosition?: number
  firstTurnAttack?: boolean
}): DuelPuzzleState {
  const base = createInitialDuelState(5, 'full')
  const cards: FieldCard[] = [
    makeCard(options.attacker, 0, CardLocation.MZONE, 0, CardPosition.FACEUP_ATTACK)
  ]
  if (options.fieldSpell) {
    cards.push(makeCard(options.fieldSpell, 0, CardLocation.FZONE, 0, CardPosition.FACEUP))
  }
  if (options.defender) {
    cards.push(
      makeCard(
        options.defender,
        1,
        CardLocation.MZONE,
        0,
        options.defenderPosition ?? CardPosition.FACEUP_ATTACK
      )
    )
  }
  for (let i = 0; i < 8; i++) {
    cards.push(makeCard(BLUE_EYES, 0, CardLocation.DECK, i, CardPosition.FACEDOWN_DEFENSE))
    cards.push(makeCard(DARK_MAGICIAN, 1, CardLocation.DECK, i, CardPosition.FACEDOWN_DEFENSE))
  }

  const duelists: Duelist[] = [
    { id: 'duelist_0_0', team: 0, name: '我方', lp: 8000, isFirst: true, turnOrder: 1 },
    { id: 'duelist_1_0', team: 1, name: '对方', lp: 8000, turnOrder: 2 }
  ]

  return normalizeDuelState({
    ...base,
    title: '攻击联测对局',
    turnPlayer: 0,
    firstTurnAttack: options.firstTurnAttack ?? base.firstTurnAttack,
    cards,
    duelists
  })
}

const seenMessages: string[] = []
let tapInstalled = false

async function installMessageTap(): Promise<void> {
  if (tapInstalled) return
  tapInstalled = true
  const wrapper = await getOcgcoreEngine()
  const originalCreate = wrapper.createDuelV2.bind(wrapper)
  wrapper.createDuelV2 = (seed: number[]) => {
    const duel = originalCreate(seed)
    const originalProcess = duel.process.bind(duel)
    duel.process = (...args: unknown[]) => {
      const res = originalProcess(...args)
      for (const msg of res.messages ?? []) {
        seenMessages.push((msg as { constructor?: { name?: string } })?.constructor?.name ?? '?')
      }
      return res
    }
    return duel
  }
}

interface RunState {
  directAttack: boolean
  targetPicked: boolean
  declared: boolean
  directAttackPrompt: boolean
}

function answer(request: EngineRequest, state: RunState): Answer {
  const d = request.data
  switch (d.kind) {
    case 'idle':
      return { kind: 'idle', cmd: d.canBp ? 'TO_BP' : 'TO_EP' }
    case 'battle': {
      const attacker = d.attackable[0]
      if (!attacker) return { kind: 'battle', cmd: 'TO_EP' }
      state.declared = true
      console.log(
        `  [battle] 攻击宣言 code=${attacker.code} directAttackable=${attacker.directAttackable}`
      )
      return { kind: 'battle', cmd: 'ATTACK', card: attacker }
    }
    case 'yesno': {
      if (d.desc === DIRECT_ATTACK_YESNO_DESC) {
        state.directAttackPrompt = true
        console.log(`  [yesno] desc=31 是否直接攻击 → ${state.directAttack ? 'yes' : 'no'}`)
        return { kind: 'yesno', yes: state.directAttack }
      }
      return { kind: 'yesno', yes: false }
    }
    case 'card': {
      const defender = d.cards.find((c) => c.controller === 1)
      if (request.descHint === ATTACK_TARGET_DESC_HINT && defender) {
        state.targetPicked = true
        console.log(`  [card] descHint=549 选择攻击对象 code=${defender.code}`)
        return { kind: 'card', cards: [defender] }
      }
      if (d.cancelable) return { kind: 'card', cards: null }
      return { kind: 'card', cards: d.cards.slice(0, Math.max(1, d.min)) }
    }
    case 'chain':
      return { kind: 'chain', card: null }
    case 'unselect':
      return { kind: 'unselect', card: null }
    case 'rps':
      return { kind: 'rps', hand: 'paper' }
    case 'place':
      return { kind: 'place', places: d.places.slice(0, Math.max(1, d.count)) }
    case 'position':
      return { kind: 'position', position: d.positions[0] }
    case 'option':
      return { kind: 'option', index: 0 }
    case 'sort':
      return { kind: 'sort', cards: null }
    case 'disfield':
      return { kind: 'disfield', places: d.places.slice(0, Math.max(1, d.count)) }
    case 'tribute':
      return d.cancelable
        ? { kind: 'tribute', cards: null }
        : { kind: 'tribute', cards: d.cards.slice(0, Math.max(1, d.min)) }
    case 'announce':
      return d.announceType === 'number'
        ? { kind: 'announce', value: d.numbers![0] }
        : { kind: 'announce', value: d.availableMask ? d.availableMask & -d.availableMask : 1 }
    default:
      throw new Error(`answer 未覆盖 kind=${(d as { kind: string }).kind}`)
  }
}

interface RunResult {
  messages: string[]
  retries: number
  requests: string[]
  canBpOnFirstIdle: boolean | null
  targetPicked: boolean
  declared: boolean
  directAttackPrompt: boolean
  p0Lp: number
  p1Lp: number
  p1Mzone: number
  damageLogs: string[]
}

async function runScenario(
  label: string,
  puzzle: ReturnType<typeof buildPuzzle>,
  directAttack: boolean,
  maxSteps: number
): Promise<RunResult> {
  console.log(`\n[attack-smoke] === ${label} ===`)
  const { cdbService } = await import('./cdb-shim')
  await cdbService.ready()
  await installMessageTap()
  seenMessages.length = 0
  await duelSession.startDuel({ puzzleState: puzzle })

  const state: RunState = {
    directAttack,
    targetPicked: false,
    declared: false,
    directAttackPrompt: false
  }
  const requests: string[] = []
  const damageLogs: string[] = []
  let retries = 0
  let canBpOnFirstIdle: boolean | null = null
  for (let step = 0; step < maxSteps; step++) {
    const pending = duelSession.getPendingRequest()
    if (!pending || pending.kind === 'END' || pending.kind === 'WAITING') break
    requests.push(
      `P${pending.player}:${pending.kind}${pending.descHint !== undefined ? `#${pending.descHint}` : ''}`
    )
    console.log(
      `  >> 请求 P${pending.player} ${pending.kind}${pending.descHint !== undefined ? ` hint=${pending.descHint}` : ''}`
    )
    if (pending.kind === 'idle' && canBpOnFirstIdle === null) {
      canBpOnFirstIdle = pending.data.kind === 'idle' ? pending.data.canBp : null
    }
    const res = duelSession.submitAnswer(answer(pending, state))
    if (res.retry) {
      retries++
      console.log(`  ⚠️ RETRY: ${pending.kind}`)
    }
    for (const log of res.node?.logs ?? []) {
      if (log.includes('伤害')) damageLogs.push(log)
    }
    const board = duelSession.getBoardState()
    if (board.turn > 3) break
    if (state.declared && seenMessages.includes('YGOProMsgDamage')) break
    const defenderGone =
      state.declared &&
      !state.directAttack &&
      state.targetPicked &&
      board.players[1].mzone[0] === null
    if (defenderGone) break
  }
  const board = duelSession.getBoardState()
  console.log(
    `  ↳ LP: P0=${board.players[0].lp} P1=${board.players[1].lp} | P1 怪兽区=${board.players[1].mzone.filter(Boolean).length}`
  )
  return {
    messages: [...seenMessages],
    retries,
    requests,
    canBpOnFirstIdle,
    targetPicked: state.targetPicked,
    declared: state.declared,
    directAttackPrompt: state.directAttackPrompt,
    p0Lp: board.players[0].lp,
    p1Lp: board.players[1].lp,
    p1Mzone: board.players[1].mzone.filter(Boolean).length,
    damageLogs
  }
}

const failures: string[] = []
function assert(condition: boolean, message: string): void {
  if (!condition) failures.push(message)
  console.log(`  ${condition ? '✅' : '❌'} ${message}`)
}

async function main(): Promise<void> {
  const rule = await runScenario(
    '规则校验：首回合不得进入战斗阶段（createInitialDuelState 默认 firstTurnAttack=false）',
    buildPuzzle({ attacker: BLUE_EYES }),
    false,
    2
  )
  assert(rule.canBpOnFirstIdle === false, '首回合 idle.canBp=false（引擎未开放战阶）')

  const attackTarget = await runScenario(
    '分支A：选择攻击对象（青眼白龙 3000 vs 攻击表示黑魔术师 2500）',
    buildPuzzle({
      attacker: BLUE_EYES,
      defender: DARK_MAGICIAN,
      defenderPosition: CardPosition.FACEUP_ATTACK,
      firstTurnAttack: true
    }),
    false,
    10
  )
  assert(attackTarget.declared, '分支A：已发出攻击宣言')
  assert(attackTarget.targetPicked, '分支A：经 card(descHint=549) 选择攻击对象')
  assert(!attackTarget.directAttackPrompt, '分支A：不可直攻时不出现 yesno(desc=31)')
  assert(attackTarget.messages.includes('YGOProMsgAttack'), '分支A：出现 YGOProMsgAttack')
  assert(attackTarget.messages.includes('YGOProMsgBattle'), '分支A：出现 YGOProMsgBattle')
  assert(attackTarget.messages.includes('YGOProMsgDamage'), '分支A：出现 YGOProMsgDamage')
  assert(attackTarget.p1Lp === 7500, `分支A：对方 LP=7500（实际 ${attackTarget.p1Lp}）`)
  assert(attackTarget.p1Mzone === 0, '分支A：对方被攻击怪兽已破坏')
  assert(attackTarget.retries === 0, '分支A：无 RETRY')

  const attackDefender = await runScenario(
    '分支A2：选择守备表示怪兽（青眼白龙 3000 vs 守备黑魔术师 2100）',
    buildPuzzle({
      attacker: BLUE_EYES,
      defender: DARK_MAGICIAN,
      defenderPosition: CardPosition.FACEUP_DEFENSE,
      firstTurnAttack: true
    }),
    false,
    10
  )
  assert(attackDefender.targetPicked, '分支A2：选择攻击对象')
  assert(attackDefender.p1Mzone === 0, '分支A2：守备怪兽被破坏')
  assert(attackDefender.p1Lp === 8000, `分支A2：无穿刺不扣 LP（实际 ${attackDefender.p1Lp}）`)
  assert(attackDefender.retries === 0, '分支A2：无 RETRY')

  const direct = await runScenario(
    '分支B：直接攻击（地缚神 2500 + 场地魔法，vs 攻击表示黑魔术师）',
    buildPuzzle({
      attacker: EARTHBOUND_IMMORTAL,
      fieldSpell: NECROVALLEY,
      defender: DARK_MAGICIAN,
      defenderPosition: CardPosition.FACEUP_ATTACK,
      firstTurnAttack: true
    }),
    true,
    10
  )
  assert(direct.declared, '分支B：已发出攻击宣言')
  assert(direct.directAttackPrompt, '分支B：出现 yesno(desc=31) 直攻询问')
  assert(direct.messages.includes('YGOProMsgDamage'), '分支B：出现 YGOProMsgDamage')
  assert(direct.p1Lp === 5500, `分支B：对方 LP=5500（实际 ${direct.p1Lp}）`)
  assert(direct.p1Mzone === 1, '分支B：直接攻击不破坏对方怪兽')
  assert(direct.retries === 0, '分支B：无 RETRY')

  assert(
    attackTarget.requests.includes('P0:card#549') &&
      !attackTarget.requests.some((r) => r.endsWith('#549') && !r.includes('card')),
    'descHint=549 只出现在攻击目标选择那一次请求（不泄漏到后续请求）'
  )

  console.log(`\n[attack-smoke] 请求序列: 规则校验=[${rule.requests.join(' → ')}]`)
  console.log(`[attack-smoke] 请求序列: 分支A=[${attackTarget.requests.join(' → ')}]`)
  console.log(`[attack-smoke] 请求序列: 分支A2=[${attackDefender.requests.join(' → ')}]`)
  console.log(`[attack-smoke] 请求序列: 分支B=[${direct.requests.join(' → ')}]`)
  console.log(`[attack-smoke] 伤害日志: [${attackTarget.damageLogs.join(' / ')}]`)
  if (failures.length > 0) {
    console.log(`\n[attack-smoke] FAILED: ${failures.length} 项未通过`)
    process.exit(1)
  }
  console.log('\n[attack-smoke] 全部通过')
  process.exit(0)
}

main().catch((err) => {
  console.error('[attack-smoke] FAILED:', err)
  process.exit(1)
})
