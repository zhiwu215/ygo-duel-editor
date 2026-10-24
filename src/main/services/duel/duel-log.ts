import {
  OcgcoreCommonConstants,
  YGOProMsgAddCounter,
  YGOProMsgAttack,
  YGOProMsgAttackDisabled,
  YGOProMsgBecomeTarget,
  YGOProMsgChainDisabled,
  YGOProMsgChainEnd,
  YGOProMsgChainNegated,
  YGOProMsgChainSolving,
  YGOProMsgChaining,
  YGOProMsgConfirmCards,
  YGOProMsgConfirmDeckTop,
  YGOProMsgDamage,
  YGOProMsgDraw,
  YGOProMsgFlipSummoning,
  YGOProMsgLpUpdate,
  YGOProMsgMove,
  YGOProMsgNewPhase,
  YGOProMsgNewTurn,
  YGOProMsgPayLpCost,
  YGOProMsgPosChange,
  YGOProMsgRandomSelected,
  YGOProMsgRecover,
  YGOProMsgRemoveCounter,
  YGOProMsgSet,
  YGOProMsgSpSummoning,
  YGOProMsgStart,
  YGOProMsgSummoning,
  YGOProMsgSwap
} from 'ygopro-msg-encode'
import {
  CardLocation,
  CardPosition,
  CardUtils,
  DuelLogCardRef,
  DuelLogEvent,
  DuelSummonKind,
  LOCATION_NAMES
} from '@shared/index'
import { cdbService } from '../../db/cdbService'
import { getEffectDescText } from './strings-service'
import type { SessionState } from './session-state'

const C = OcgcoreCommonConstants
const FIELD_LOCATIONS =
  CardLocation.MZONE | CardLocation.SZONE | CardLocation.FZONE | CardLocation.PZONE

export interface DuelLogContext {
  chainCards: DuelLogCardRef[]
  chainEffects: Map<number, string>
  lastChainSolving: number
  lastSpSummonReason: number
  spSummonReasonByCode: Map<number, number>
  lastMoveByCode: Map<number, { from: DuelLogCardRef; to: DuelLogCardRef }>
  attacking?: DuelLogCardRef
  life: [number, number]
  lifeReady: boolean
  inPendulumSummon: boolean
  lastTargets: string
  lastCost: boolean
}

export function createDuelLogContext(): DuelLogContext {
  return {
    chainCards: [],
    chainEffects: new Map(),
    lastChainSolving: 0,
    lastSpSummonReason: 0,
    spSummonReasonByCode: new Map(),
    lastMoveByCode: new Map(),
    life: [0, 0],
    lifeReady: false,
    inPendulumSummon: false,
    lastTargets: '',
    lastCost: false
  }
}

export function resetDuelLogContext(context: DuelLogContext): void {
  const fresh = createDuelLogContext()
  context.chainCards = fresh.chainCards
  context.chainEffects = fresh.chainEffects
  context.lastChainSolving = fresh.lastChainSolving
  context.lastSpSummonReason = fresh.lastSpSummonReason
  context.spSummonReasonByCode = fresh.spSummonReasonByCode
  context.lastMoveByCode = fresh.lastMoveByCode
  context.attacking = undefined
  context.life = fresh.life
  context.lifeReady = fresh.lifeReady
  context.inPendulumSummon = fresh.inPendulumSummon
  context.lastTargets = fresh.lastTargets
  context.lastCost = fresh.lastCost
}

function toPlayer(value: number): 0 | 1 {
  return value === 1 ? 1 : 0
}

function nameOf(code: number): string | undefined {
  if (!code) return undefined
  return cdbService.getCardById(code)?.name
}

function typeOf(code: number): number {
  if (!code) return 0
  return cdbService.getCardById(code)?.type ?? 0
}

function cardRef(
  code: number,
  controller: number,
  location: number,
  sequence: number,
  position?: number
): DuelLogCardRef {
  return {
    code,
    name: nameOf(code),
    controller: toPlayer(controller),
    location,
    sequence,
    position
  }
}

function moveRef(
  code: number,
  info: { controller: number; location: number; sequence: number; position?: number }
): DuelLogCardRef {
  return cardRef(code, info.controller, info.location, info.sequence, info.position)
}

function isFaceUp(position: number): boolean {
  return (position & CardPosition.FACEUP) !== 0
}

function isFaceDown(position: number): boolean {
  return (position & CardPosition.FACEDOWN) !== 0
}

function inField(location: number): boolean {
  return (location & FIELD_LOCATIONS) !== 0
}

function samePosition(a: DuelLogCardRef, b: DuelLogCardRef): boolean {
  return a.controller === b.controller && a.location === b.location && a.sequence === b.sequence
}

function lastMoveFrom(
  context: DuelLogContext,
  code: number,
  to: DuelLogCardRef
): DuelLogCardRef | undefined {
  const last = context.lastMoveByCode.get(code)
  if (!last) return undefined
  return samePosition(last.to, to) ? last.from : undefined
}

function withName(card: DuelLogCardRef): DuelLogCardRef {
  return card.name ? card : { ...card, name: nameOf(card.code) }
}

function describeMoveReason(
  from: DuelLogCardRef | undefined,
  to: DuelLogCardRef,
  reason: number
): string {
  if (reason & C.REASON_DESTROY) return '破坏'
  if (reason & C.REASON_RELEASE) return '解放'
  if (reason & C.REASON_BATTLE) return '战斗破坏'
  if (reason & C.REASON_FLIP) return '反转'
  if (to.location === CardLocation.HAND) {
    if (from?.location === CardLocation.DECK || from?.location === CardLocation.EXTRA)
      return '加入手牌'
    if (from?.location === CardLocation.GRAVE || from?.location === CardLocation.REMOVED)
      return '回收'
    return '回到手牌'
  }
  if (to.location === CardLocation.SZONE && from?.location !== CardLocation.SZONE) return '放置'
  if (
    from &&
    ((from.location === CardLocation.SZONE && to.location === CardLocation.SZONE) ||
      (from.location === CardLocation.MZONE && to.location === CardLocation.MZONE))
  ) {
    return '移动'
  }
  if (to.location === CardLocation.MZONE && from?.location !== CardLocation.MZONE) return '回到场上'
  return '送入'
}

function shouldSkipMove(from: DuelLogCardRef, to: DuelLogCardRef, reason: number): boolean {
  const type = typeOf(to.code)
  const monster = CardUtils.isMonster(type)
  const fromSpellZone = from.location === CardLocation.SZONE || from.location === CardLocation.FZONE
  const toSpellZone = to.location === CardLocation.SZONE || to.location === CardLocation.FZONE
  if (
    to.location === CardLocation.MZONE &&
    isFaceUp(to.position ?? 0) &&
    from.location === CardLocation.HAND
  ) {
    return true
  }
  if (
    reason & C.REASON_SPSUMMON &&
    to.location === CardLocation.MZONE &&
    from.location !== CardLocation.MZONE
  ) {
    return true
  }
  if (
    from.location === CardLocation.HAND &&
    toSpellZone &&
    isFaceUp(to.position ?? 0) &&
    !monster
  ) {
    return true
  }
  if (
    from.location === CardLocation.HAND &&
    toSpellZone &&
    isFaceUp(to.position ?? 0) &&
    CardUtils.isPendulum(type) &&
    to.sequence >= 6
  ) {
    return true
  }
  if (fromSpellZone && !toSpellZone && !monster && reason & C.REASON_RULE) {
    return true
  }
  if (from.location === CardLocation.OVERLAY && to.location === CardLocation.OVERLAY) return true
  if (from.location === CardLocation.DECK && to.location === CardLocation.DECK) return true
  if (inField(to.location) && isFaceDown(to.position ?? 0)) return true
  return false
}

function summonKindFromReason(context: DuelLogContext): DuelSummonKind {
  const reason = context.lastSpSummonReason
  if (reason & C.REASON_RITUAL) return 'ritual'
  if (reason & C.REASON_FUSION) return 'fusion'
  if (reason & C.REASON_SYNCHRO) return 'synchro'
  if (reason & C.REASON_XYZ) return 'xyz'
  if (reason & C.REASON_LINK) return 'link'
  if (context.inPendulumSummon) return 'pendulum'
  return 'special'
}

function effectTextOf(desc: number, card: DuelLogCardRef): string | undefined {
  if (!desc) return undefined
  const placeName = LOCATION_NAMES[card.location] ?? ''
  return getEffectDescText(desc, [placeName, card.name ?? ''])
}

function boardOf(state: SessionState): ReturnType<SessionState['fieldReader']['getState']> | null {
  try {
    return state.fieldReader.getState()
  } catch {
    return null
  }
}

function ensureLife(state: SessionState): void {
  const context = state.duelLog
  if (context.lifeReady) return
  const board = boardOf(state)
  if (!board) return
  context.life = [board.players[0].lp, board.players[1].lp]
  context.lifeReady = true
}

function push(state: SessionState, event: DuelLogEvent): void {
  state.accumulatedLogEvents.push(event)
}

function recordMove(state: SessionState, msg: YGOProMsgMove): void {
  const context = state.duelLog
  const from = moveRef(msg.code, msg.previous)
  const to = moveRef(msg.code, msg.current)
  context.lastMoveByCode.set(msg.code, { from, to })

  if (
    msg.reason & C.REASON_SPSUMMON &&
    msg.current.location === CardLocation.MZONE &&
    msg.previous.location !== CardLocation.MZONE
  ) {
    context.spSummonReasonByCode.set(msg.code, msg.reason)
    context.lastSpSummonReason = msg.reason
  }

  if (shouldSkipMove(from, to, msg.reason)) return

  const cost = (msg.reason & C.REASON_COST) !== 0
  if (cost && !context.lastCost) {
    push(state, { kind: 'text', text: '代价' })
  }
  context.lastCost = cost
  push(state, {
    kind: 'move',
    move: {
      card: to,
      from,
      to,
      reason: msg.reason & ~C.REASON_COST,
      reasonText: describeMoveReason(from, to, msg.reason & ~C.REASON_COST),
      cost
    }
  })
}

function recordSummon(state: SessionState, msg: YGOProMsgSummoning): void {
  const card = moveRef(msg.code, msg)
  const from = lastMoveFrom(state.duelLog, msg.code, card)
  state.duelLog.lastCost = false
  push(state, { kind: 'summon', card: withName(card), from, summonKind: 'normal' })
}

function recordSpSummon(state: SessionState, msg: YGOProMsgSpSummoning): void {
  const context = state.duelLog
  const reason = context.spSummonReasonByCode.get(msg.code) ?? context.lastSpSummonReason
  context.lastSpSummonReason = reason
  context.spSummonReasonByCode.delete(msg.code)
  const card = moveRef(msg.code, msg)
  const from = lastMoveFrom(context, msg.code, card)
  context.lastCost = false
  push(state, {
    kind: 'summon',
    card: withName(card),
    from,
    summonKind: summonKindFromReason(context)
  })
}

function recordFlipSummon(state: SessionState, msg: YGOProMsgFlipSummoning): void {
  const card = moveRef(msg.code, msg)
  push(state, {
    kind: 'summon',
    card: withName(card),
    from: lastMoveFrom(state.duelLog, msg.code, card),
    summonKind: 'flip'
  })
}

function recordSet(state: SessionState, msg: YGOProMsgSet): void {
  const card = moveRef(msg.code, msg)
  push(state, {
    kind: 'set',
    card: withName(card),
    from: lastMoveFrom(state.duelLog, msg.code, card)
  })
}

function recordChaining(state: SessionState, msg: YGOProMsgChaining): void {
  const context = state.duelLog
  const card = withName(moveRef(msg.code, msg))
  const from = lastMoveFrom(context, msg.code, card)
  if (context.chainCards.length < msg.chainCount) {
    context.chainCards[msg.chainCount - 1] = card
  }
  const effectText = effectTextOf(msg.desc, card)
  if (effectText) context.chainEffects.set(msg.chainCount, effectText)
  if (msg.chainCount > 1) {
    push(state, { kind: 'chain', chainCount: msg.chainCount })
  }
  push(state, {
    kind: 'activate',
    card,
    from,
    chainCount: msg.chainCount,
    effectText
  })
  context.lastCost = false
  context.lastTargets = ''
}

function recordChainSolving(state: SessionState, msg: YGOProMsgChainSolving): void {
  const context = state.duelLog
  context.lastChainSolving = msg.chainCount
  const card = context.chainCards[msg.chainCount - 1]
  push(state, {
    kind: 'chain-solving',
    chainCount: msg.chainCount,
    card,
    effectText: context.chainEffects.get(msg.chainCount)
  })
  context.lastCost = false
}

function recordChainEnd(state: SessionState): void {
  const context = state.duelLog
  const chainCount = Math.max(context.lastChainSolving, context.chainCards.length)
  push(state, { kind: 'chain-end', chainCount })
  context.chainCards = []
  context.chainEffects.clear()
  context.lastChainSolving = 0
  context.inPendulumSummon = false
  context.lastCost = false
  context.lastTargets = ''
}

function refFromGps(state: SessionState, value: number, position?: number): DuelLogCardRef {
  const controller = toPlayer(value & 0xff)
  const location = (value >>> 8) & 0xff
  const sequence = (value >>> 16) & 0xff
  const board = boardOf(state)
  const found = board?.allCards.find(
    (card) =>
      card.controller === controller && card.location === location && card.sequence === sequence
  )
  return cardRef(found?.code ?? 0, controller, location, sequence, position)
}

function recordTargets(state: SessionState, cards: DuelLogCardRef[]): void {
  if (cards.length === 0) return
  const context = state.duelLog
  const key = cards
    .map((card) => `${card.controller}:${card.location}:${card.sequence}:${card.code}`)
    .join('|')
  if (key === context.lastTargets) return
  context.lastTargets = key
  push(state, { kind: 'target', cards: cards.map(withName) })
}

function recordBecomeTarget(state: SessionState, msg: YGOProMsgBecomeTarget): void {
  const cards: DuelLogCardRef[] = []
  for (let i = 0; i < msg.count; i++) {
    cards.push(refFromGps(state, msg.targets[i] ?? 0))
  }
  if (state.duelLog.chainCards.length === 0 && cards.length === 2) {
    const [a, b] = cards
    if (
      a.location === CardLocation.PZONE &&
      b.location === CardLocation.PZONE &&
      a.controller === b.controller
    ) {
      state.duelLog.inPendulumSummon = true
    }
  }
  if (cards.length === 1 && cards[0].location === CardLocation.PZONE) return
  if (state.duelLog.inPendulumSummon) return
  recordTargets(state, cards)
}

function recordRandomSelected(state: SessionState, msg: YGOProMsgRandomSelected): void {
  const cards: DuelLogCardRef[] = []
  for (let i = 0; i < msg.count; i++) {
    cards.push(refFromGps(state, msg.cards[i] ?? 0))
  }
  recordTargets(state, cards)
}

function recordDraw(state: SessionState, msg: YGOProMsgDraw): void {
  const cards = msg.cards.map((code) => {
    const normalized = code & 0x7fffffff
    return { code: normalized, name: nameOf(normalized) }
  })
  push(state, { kind: 'draw', player: toPlayer(msg.player), cards })
}

function recordDamage(state: SessionState, msg: YGOProMsgDamage): void {
  ensureLife(state)
  const player = toPlayer(msg.player)
  state.duelLog.life[player] -= msg.value
  state.duelLog.lastCost = false
  push(state, { kind: 'damage', player, value: msg.value, lp: state.duelLog.life[player] })
}

function recordRecover(state: SessionState, msg: YGOProMsgRecover): void {
  ensureLife(state)
  const player = toPlayer(msg.player)
  state.duelLog.life[player] += msg.value
  state.duelLog.lastCost = false
  push(state, { kind: 'recover', player, value: msg.value, lp: state.duelLog.life[player] })
}

function recordPayLp(state: SessionState, msg: YGOProMsgPayLpCost): void {
  ensureLife(state)
  const player = toPlayer(msg.player)
  state.duelLog.life[player] -= msg.cost
  if (!state.duelLog.lastCost) push(state, { kind: 'text', text: '代价' })
  state.duelLog.lastCost = true
  push(state, { kind: 'damage', player, value: msg.cost, lp: state.duelLog.life[player] })
}

function recordLpUpdate(state: SessionState, msg: YGOProMsgLpUpdate): void {
  ensureLife(state)
  const player = toPlayer(msg.player)
  const delta = msg.lp - state.duelLog.life[player]
  state.duelLog.life[player] = msg.lp
  if (delta !== 0) push(state, { kind: 'lp-update', player, lp: msg.lp, delta })
}

function recordPosChange(state: SessionState, msg: YGOProMsgPosChange): void {
  const card = cardRef(
    msg.code,
    msg.card.controller,
    msg.card.location,
    msg.card.sequence,
    msg.currentPosition
  )
  push(state, {
    kind: 'position',
    card: withName(card),
    fromPosition: msg.previousPosition,
    toPosition: msg.currentPosition
  })
}

function recordAttack(state: SessionState, msg: YGOProMsgAttack): void {
  const attacker = cardRef(
    attackerCode(state, msg),
    msg.attacker.controller,
    msg.attacker.location,
    msg.attacker.sequence,
    msg.attacker.position
  )
  const defender =
    msg.defender.location === 0
      ? undefined
      : cardRef(
          defenderCode(state, msg),
          msg.defender.controller,
          msg.defender.location,
          msg.defender.sequence,
          msg.defender.position
        )
  state.duelLog.attacking = attacker
  push(state, {
    kind: 'attack',
    attacker: withName(attacker),
    defender: defender ? withName(defender) : undefined,
    direct: defender === undefined
  })
}

function attackerCode(state: SessionState, msg: YGOProMsgAttack): number {
  const board = boardOf(state)
  const found = board?.allCards.find(
    (card) =>
      card.controller === msg.attacker.controller &&
      card.location === msg.attacker.location &&
      card.sequence === msg.attacker.sequence
  )
  return found?.code ?? 0
}

function defenderCode(state: SessionState, msg: YGOProMsgAttack): number {
  const board = boardOf(state)
  const found = board?.allCards.find(
    (card) =>
      card.controller === msg.defender.controller &&
      card.location === msg.defender.location &&
      card.sequence === msg.defender.sequence
  )
  return found?.code ?? 0
}

function recordCounter(
  state: SessionState,
  msg: YGOProMsgAddCounter | YGOProMsgRemoveCounter
): void {
  const remove = msg instanceof YGOProMsgRemoveCounter
  const board = boardOf(state)
  const found = board?.allCards.find(
    (item) =>
      item.controller === msg.controller &&
      item.location === msg.location &&
      item.sequence === msg.sequence
  )
  push(state, {
    kind: 'counter',
    card: withName(cardRef(found?.code ?? 0, msg.controller, msg.location, msg.sequence)),
    counterType: msg.counterType,
    count: msg.count,
    remove
  })
}

function recordReveal(
  state: SessionState,
  cards: { code: number; controller: number; location: number; sequence: number }[],
  source: 'deck' | 'hand' | 'field'
): void {
  if (cards.length === 0) return
  push(state, {
    kind: 'reveal',
    cards: cards.map((card) => cardRef(card.code, card.controller, card.location, card.sequence)),
    source
  })
}

function recordSwap(state: SessionState, msg: YGOProMsgSwap): void {
  const from = cardRef(msg.code1, msg.card1.controller, msg.card1.location, msg.card1.sequence)
  const to = cardRef(msg.code2, msg.card2.controller, msg.card2.location, msg.card2.sequence)
  push(state, { kind: 'swap', from: withName(from), to: withName(to) })
}

function recordTurnStart(state: SessionState, msg: YGOProMsgNewTurn): void {
  ensureLife(state)
  state.duelLog.lastTargets = ''
  push(state, { kind: 'turn-start', player: toPlayer(msg.player) })
}

function recordPhase(state: SessionState, msg: YGOProMsgNewPhase): void {
  push(state, { kind: 'phase', phase: msg.phase })
}

export function collectDuelLogMessages(state: SessionState, messages: unknown[]): void {
  const context = state.duelLog
  for (const msg of messages) {
    if (msg instanceof YGOProMsgStart) {
      context.life = [msg.startLp0, msg.startLp1]
      context.lifeReady = true
      continue
    }
    if (msg instanceof YGOProMsgNewTurn) {
      recordTurnStart(state, msg)
      continue
    }
    if (msg instanceof YGOProMsgNewPhase) {
      recordPhase(state, msg)
      continue
    }
    if (msg instanceof YGOProMsgMove) {
      recordMove(state, msg)
      continue
    }
    if (msg instanceof YGOProMsgSummoning) {
      recordSummon(state, msg)
      continue
    }
    if (msg instanceof YGOProMsgSpSummoning) {
      recordSpSummon(state, msg)
      continue
    }
    if (msg instanceof YGOProMsgFlipSummoning) {
      recordFlipSummon(state, msg)
      continue
    }
    if (msg instanceof YGOProMsgSet) {
      recordSet(state, msg)
      continue
    }
    if (msg instanceof YGOProMsgChaining) {
      recordChaining(state, msg)
      continue
    }
    if (msg instanceof YGOProMsgChainSolving) {
      recordChainSolving(state, msg)
      continue
    }
    if (msg instanceof YGOProMsgChainNegated || msg instanceof YGOProMsgChainDisabled) {
      const disabled = msg instanceof YGOProMsgChainDisabled
      push(state, {
        kind: 'chain-negated',
        chainCount: msg.chainCount,
        disabled,
        card: context.chainCards[msg.chainCount - 1]
      })
      continue
    }
    if (msg instanceof YGOProMsgChainEnd) {
      recordChainEnd(state)
      continue
    }
    if (msg instanceof YGOProMsgBecomeTarget) {
      recordBecomeTarget(state, msg)
      continue
    }
    if (msg instanceof YGOProMsgRandomSelected) {
      recordRandomSelected(state, msg)
      continue
    }
    if (msg instanceof YGOProMsgDraw) {
      recordDraw(state, msg)
      continue
    }
    if (msg instanceof YGOProMsgDamage) {
      recordDamage(state, msg)
      continue
    }
    if (msg instanceof YGOProMsgRecover) {
      recordRecover(state, msg)
      continue
    }
    if (msg instanceof YGOProMsgPayLpCost) {
      recordPayLp(state, msg)
      continue
    }
    if (msg instanceof YGOProMsgLpUpdate) {
      recordLpUpdate(state, msg)
      continue
    }
    if (msg instanceof YGOProMsgPosChange) {
      recordPosChange(state, msg)
      continue
    }
    if (msg instanceof YGOProMsgAttack) {
      recordAttack(state, msg)
      continue
    }
    if (msg instanceof YGOProMsgAttackDisabled) {
      push(state, { kind: 'attack-disabled', card: context.attacking })
      continue
    }
    if (msg instanceof YGOProMsgAddCounter || msg instanceof YGOProMsgRemoveCounter) {
      recordCounter(state, msg)
      continue
    }
    if (msg instanceof YGOProMsgConfirmDeckTop) {
      recordReveal(state, msg.cards, 'deck')
      continue
    }
    if (msg instanceof YGOProMsgConfirmCards) {
      const source = msg.cards.some((card) => card.location === CardLocation.HAND)
        ? 'hand'
        : msg.cards.some((card) => inField(card.location))
          ? 'field'
          : 'deck'
      recordReveal(state, msg.cards, source)
      continue
    }
    if (msg instanceof YGOProMsgSwap) {
      recordSwap(state, msg)
    }
  }
}
