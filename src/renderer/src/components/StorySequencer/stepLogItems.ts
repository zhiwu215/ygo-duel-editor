import {
  CardLocation,
  DuelLogCardRef,
  DuelLogEvent,
  DuelPhase,
  DuelStep,
  duelPhaseFromMask,
  isHandShuffleNote,
  summaryEventIndex
} from '@shared/index'
import { stepCardName } from '../../utils/cardNames'
import {
  isPendulumZone,
  moveLogLabel,
  positionChangeLabel,
  revealLogLabel,
  stepActionLogLabel,
  summonLogLabel
} from './stepLogFormat'

export interface StepLogSingleRow {
  kind: 'single'
  card: DuelLogCardRef
  from?: DuelLogCardRef
  to?: DuelLogCardRef
  label: string
  indented: boolean
  variant: 'card' | 'target' | 'cost'
  player: 0 | 1
}

export interface StepLogAttackRow {
  kind: 'attack'
  attacker: DuelLogCardRef
  defender?: DuelLogCardRef
  targetName?: string
  direct: boolean
  targetPlayer: 0 | 1
  turn: number
  indented: boolean
  player: 0 | 1
}

export interface StepLogLpRow {
  kind: 'lp'
  player: 0 | 1
  reason: string
  total: number
  change: number
  turn: number
  indented: boolean
}

export interface StepLogCounterRow {
  kind: 'counter'
  card: DuelLogCardRef
  counterType: number
  count: number
  remove: boolean
  indented: boolean
  player: 0 | 1
}

export interface StepLogTargetRow {
  kind: 'target'
  cards: DuelLogCardRef[]
  indented: boolean
}

export interface StepLogOpeningDrawRow {
  kind: 'opening-draw'
  player: 0 | 1
  cards: { code: number; name?: string }[]
}

export interface StepLogTextRow {
  kind: 'text'
  text: string
  tone: 'note' | 'danger'
  indented: boolean
}

export interface StepLogBandRow {
  kind: 'band'
  tone: 'chain' | 'solve' | 'end' | 'cost'
  text: string
  count?: number
  card?: DuelLogCardRef
}

export type StepLogRow =
  | StepLogSingleRow
  | StepLogAttackRow
  | StepLogLpRow
  | StepLogCounterRow
  | StepLogTargetRow
  | StepLogOpeningDrawRow
  | StepLogTextRow
  | StepLogBandRow

export type StepLogItem =
  | {
      kind: 'turn'
      key: string
      step: DuelStep
      index: number
      turn: number
      turnPlayer: 0 | 1
      lp: [number, number]
    }
  | { kind: 'phase'; key: string; step: DuelStep; index: number; phase: DuelPhase }
  | { kind: 'step'; key: string; step: DuelStep; index: number; rows: StepLogRow[] }

const MARKER_ACTIONS = new Set<DuelStep['actionType']>(['PHASE_CHANGE', 'TURN_CHANGE'])

const PHASE_ORDER: Record<DuelPhase, number> = {
  DP: 0,
  SP: 1,
  M1: 2,
  BP: 3,
  M2: 4,
  EP: 5
}

interface BuildState {
  turn: number
  turnPlayer: 0 | 1
  phase: DuelPhase | null
  lp: [number, number]
  chainSolving: number
  pendingCostLp: boolean
}

function sameSlot(a: DuelLogCardRef, b: DuelLogCardRef): boolean {
  return a.controller === b.controller && a.location === b.location && a.sequence === b.sequence
}

function baseCardOfStep(step: DuelStep): DuelLogCardRef | undefined {
  const name = stepCardName(step)
  if (!step.cardCode && !name) return undefined
  return {
    code: step.cardCode ?? 0,
    name: name || undefined,
    controller: step.toController ?? step.fromController ?? step.actionPlayer,
    location: step.toLocation ?? step.fromLocation ?? 0,
    sequence: step.toSequence ?? step.fromSequence ?? 0,
    position: step.toPosition ?? step.fromPosition
  }
}

function sideCardOfStep(
  step: DuelStep,
  card: DuelLogCardRef,
  side: 'from' | 'to'
): DuelLogCardRef | undefined {
  const location = side === 'from' ? step.fromLocation : step.toLocation
  if (location === undefined) return undefined
  return {
    ...card,
    controller:
      (side === 'from' ? step.fromController : step.toController) ??
      step.fromController ??
      step.actionPlayer,
    location,
    sequence: (side === 'from' ? step.fromSequence : step.toSequence) ?? 0,
    position: side === 'from' ? step.fromPosition : step.toPosition
  }
}

function nextEventOf(events: DuelLogEvent[], start: number): DuelLogEvent | undefined {
  for (let index = start; index < events.length; index += 1) {
    const event = events[index]
    if (event.kind === 'phase' || event.kind === 'turn-start') continue
    return event
  }
  return undefined
}

function singleRow(
  card: DuelLogCardRef,
  label: string,
  options: {
    from?: DuelLogCardRef
    to?: DuelLogCardRef
    indented: boolean
    variant?: StepLogSingleRow['variant']
  }
): StepLogSingleRow {
  return {
    kind: 'single',
    card,
    from: options.from,
    to: options.to ?? card,
    label,
    indented: options.indented,
    variant: options.variant ?? 'card',
    player: card.controller
  }
}

function syntheticRows(step: DuelStep): StepLogRow[] {
  if (MARKER_ACTIONS.has(step.actionType)) return []
  const card = baseCardOfStep(step)
  const label = stepActionLogLabel(step)
  if (card && label) {
    if (step.actionType === 'ATTACK') {
      const targetName = step.targetCardName?.trim()
      return [
        {
          kind: 'attack',
          attacker: card,
          targetName: targetName || undefined,
          direct: !targetName,
          targetPlayer: step.targetPlayer ?? (step.actionPlayer === 0 ? 1 : 0),
          turn: step.turn,
          indented: false,
          player: card.controller
        }
      ]
    }
    const from = sideCardOfStep(step, card, 'from')
    return [
      singleRow(card, label, {
        from: from && !sameSlot(from, card) ? from : undefined,
        to: card,
        indented: false
      })
    ]
  }
  const description = step.description?.trim()
  if (description) {
    return [{ kind: 'text', text: description, tone: 'note', indented: false }]
  }
  if (label) return [{ kind: 'text', text: label, tone: 'note', indented: false }]
  return []
}

function drawRows(
  step: DuelStep,
  event: Extract<DuelLogEvent, { kind: 'draw' }>,
  indented: boolean
): StepLogRow[] {
  if (step.turn <= 0 && event.cards.length > 1) {
    return [{ kind: 'opening-draw', player: event.player, cards: event.cards }]
  }
  const hand = (code: number, name: string | undefined): DuelLogCardRef => ({
    code,
    name,
    controller: event.player,
    location: CardLocation.HAND,
    sequence: 0
  })
  const allUnknown = event.cards.every((card) => !card.code || card.code <= 0)
  if (allUnknown || event.cards.length === 0) {
    const count = event.cards.length || 1
    return [
      singleRow(hand(0, undefined), count > 1 ? `抽卡 ×${count}` : '抽卡', {
        indented,
        to: hand(0, undefined)
      })
    ]
  }
  return event.cards.map((card) =>
    singleRow(hand(card.code, card.name), '抽卡', {
      indented,
      to: hand(card.code, card.name)
    })
  )
}

function applyEventLp(state: BuildState, event: DuelLogEvent): void {
  if (event.kind === 'damage' || event.kind === 'recover' || event.kind === 'lp-update') {
    state.lp[event.player] = event.lp
  }
}

function rowsForEvent(
  step: DuelStep,
  events: DuelLogEvent[],
  index: number,
  event: DuelLogEvent,
  state: BuildState
): StepLogRow[] {
  if (event.kind === 'phase' || event.kind === 'turn-start') return []

  if (event.kind === 'text') {
    if (event.text === '代价') {
      const next = nextEventOf(events, index + 1)
      if (next?.kind === 'damage') {
        state.pendingCostLp = true
        return []
      }
      return [{ kind: 'band', tone: 'cost', text: '代价' }]
    }
    state.pendingCostLp = false
    return [{ kind: 'text', text: event.text, tone: 'note', indented: state.chainSolving > 0 }]
  }

  const costDamage = state.pendingCostLp && event.kind === 'damage'
  state.pendingCostLp = false

  switch (event.kind) {
    case 'summon':
      return [
        singleRow(event.card, summonLogLabel(event.summonKind), {
          from: event.from,
          indented: state.chainSolving > 0
        })
      ]
    case 'set':
      return [
        singleRow(event.card, '盖放', {
          from: event.from,
          indented: state.chainSolving > 0
        })
      ]
    case 'activate': {
      const pendulum = event.from?.location === CardLocation.HAND && isPendulumZone(event.card)
      const from =
        event.from?.location === CardLocation.HAND &&
        (event.card.location === CardLocation.SZONE ||
          event.card.location === CardLocation.FZONE ||
          event.card.location === CardLocation.PZONE)
          ? event.from
          : undefined
      return [
        singleRow(event.card, pendulum ? '灵摆发动' : '发动', {
          from,
          indented: state.chainSolving > 0
        })
      ]
    }
    case 'chain': {
      if (event.chainCount <= 1) return []
      const activation = events
        .slice(index + 1)
        .find((item): item is Extract<DuelLogEvent, { kind: 'activate' }> => {
          return item.kind === 'activate' && item.chainCount === event.chainCount
        })
      return [
        {
          kind: 'band',
          tone: 'chain',
          text: '连锁',
          count: event.chainCount,
          card: activation?.card
        }
      ]
    }
    case 'chain-solving': {
      const row: StepLogBandRow = {
        kind: 'band',
        tone: 'solve',
        text: '效果处理',
        count: event.chainCount,
        card: event.card
      }
      state.chainSolving = event.chainCount
      return [row]
    }
    case 'chain-end': {
      const row: StepLogBandRow = {
        kind: 'band',
        tone: 'end',
        text: state.chainSolving > 1 ? '连锁结束' : '处理结束'
      }
      state.chainSolving = 0
      return [row]
    }
    case 'chain-negated':
      if (event.card) {
        return [
          singleRow(event.card, event.disabled ? '效果无效' : '发动无效', {
            indented: state.chainSolving > 0
          })
        ]
      }
      return [
        {
          kind: 'text',
          text: event.disabled ? '效果无效' : '发动无效',
          tone: 'danger',
          indented: state.chainSolving > 0
        }
      ]
    case 'move':
      return [
        singleRow(event.move.card, moveLogLabel(event.move.reasonText), {
          from: event.move.from,
          to: event.move.to,
          indented: state.chainSolving > 0,
          variant: event.move.cost ? 'cost' : 'card'
        })
      ]
    case 'target':
      return [{ kind: 'target', cards: event.cards, indented: state.chainSolving > 0 }]
    case 'attack': {
      const damage = event.direct
        ? events.slice(index + 1).find((item) => item.kind === 'damage')
        : undefined
      return [
        {
          kind: 'attack',
          attacker: event.attacker,
          defender: event.defender,
          direct: event.direct,
          targetPlayer:
            damage?.kind === 'damage'
              ? damage.player
              : (step.targetPlayer ?? (event.attacker.controller === 0 ? 1 : 0)),
          turn: state.turn || step.turn,
          indented: state.chainSolving > 0,
          player: event.attacker.controller
        }
      ]
    }
    case 'attack-disabled':
      if (event.card) {
        return [
          singleRow(event.card, '攻击被无效', {
            indented: state.chainSolving > 0
          })
        ]
      }
      return [
        {
          kind: 'text',
          text: '攻击被无效',
          tone: 'danger',
          indented: state.chainSolving > 0
        }
      ]
    case 'draw':
      return drawRows(step, event, state.chainSolving > 0)
    case 'damage':
      return [
        {
          kind: 'lp',
          player: event.player,
          reason: costDamage ? '代价' : '伤害',
          total: event.lp,
          change: -event.value,
          turn: state.turn || step.turn,
          indented: costDamage || state.chainSolving > 0
        }
      ]
    case 'recover':
      return [
        {
          kind: 'lp',
          player: event.player,
          reason: '回复',
          total: event.lp,
          change: event.value,
          turn: state.turn || step.turn,
          indented: state.chainSolving > 0
        }
      ]
    case 'lp-update':
      if (event.delta === 0) return []
      return [
        {
          kind: 'lp',
          player: event.player,
          reason: '基本分改变',
          total: event.lp,
          change: event.delta,
          turn: state.turn || step.turn,
          indented: state.chainSolving > 0
        }
      ]
    case 'position':
      return [
        singleRow(event.card, positionChangeLabel(event.card), {
          indented: state.chainSolving > 0
        })
      ]
    case 'counter':
      return [
        {
          kind: 'counter',
          card: event.card,
          counterType: event.counterType,
          count: event.count,
          remove: event.remove,
          indented: state.chainSolving > 0,
          player: event.card.controller
        }
      ]
    case 'reveal':
      return event.cards.map((card) =>
        singleRow(card, revealLogLabel(event.source), {
          indented: state.chainSolving > 0,
          to: card
        })
      )
    case 'swap': {
      const label = event.from.controller === event.to.controller ? '移动' : '转移控制权'
      return [
        singleRow(event.from, label, {
          from: event.from,
          to: { ...event.from, position: event.to.position },
          indented: state.chainSolving > 0
        }),
        singleRow(event.to, label, {
          from: event.to,
          to: { ...event.to, position: event.from.position },
          indented: state.chainSolving > 0
        })
      ]
    }
  }
}

function firstLpOfStep(
  step: DuelStep,
  player: 0 | 1
): { oldLp: number; newLp: number } | undefined {
  for (const event of step.logEvents ?? []) {
    if (event.kind === 'damage' && event.player === player) {
      return { oldLp: event.lp + event.value, newLp: event.lp }
    }
    if (event.kind === 'recover' && event.player === player) {
      return { oldLp: event.lp - event.value, newLp: event.lp }
    }
    if (event.kind === 'lp-update' && event.player === player && event.delta !== 0) {
      return { oldLp: event.lp - event.delta, newLp: event.lp }
    }
  }
  if (step.lpChange?.player === player) {
    return { oldLp: step.lpChange.oldLp, newLp: step.lpChange.newLp }
  }
  return undefined
}

function resolveStartLp(steps: DuelStep[], initialLp?: [number, number]): [number, number] {
  if (initialLp) return [initialLp[0], initialLp[1]]
  const lp: [number, number] = [8000, 8000]
  const seeded: [boolean, boolean] = [false, false]
  for (const step of steps) {
    for (const player of [0, 1] as const) {
      if (seeded[player]) continue
      const change = firstLpOfStep(step, player)
      if (!change) continue
      lp[player] = change.oldLp
      seeded[player] = true
    }
    if (seeded[0] && seeded[1]) break
  }
  return lp
}

function applyStepLp(step: DuelStep, state: BuildState): void {
  if (step.lpChange) state.lp[step.lpChange.player] = step.lpChange.newLp
}

export function buildStepLogItems(steps: DuelStep[], initialLp?: [number, number]): StepLogItem[] {
  const items: StepLogItem[] = []
  const state: BuildState = {
    turn: 0,
    turnPlayer: 0,
    phase: null,
    lp: resolveStartLp(steps, initialLp),
    chainSolving: 0,
    pendingCostLp: false
  }
  let keySeq = 0

  steps.forEach((step, index) => {
    const events = step.logEvents ?? []
    const timeline = events.some((event) => event.kind === 'phase' || event.kind === 'turn-start')
    const replay = step.origin === 'replay'

    const emitTurn = (turn: number, turnPlayer: 0 | 1): void => {
      items.push({
        kind: 'turn',
        key: `turn_${keySeq++}`,
        step,
        index,
        turn,
        turnPlayer,
        lp: [state.lp[0], state.lp[1]]
      })
    }

    const emitPhase = (phase: DuelPhase): void => {
      items.push({ kind: 'phase', key: `phase_${keySeq++}`, step, index, phase })
    }

    const syncContext = (): void => {
      if (step.turn <= 0) return
      if (step.turn > state.turn) {
        state.turn = step.turn
        state.turnPlayer = step.turnPlayer
        state.phase = null
        emitTurn(step.turn, step.turnPlayer)
      }
      if (step.turn !== state.turn) return
      if (state.phase === null || PHASE_ORDER[step.phase] > PHASE_ORDER[state.phase]) {
        state.phase = step.phase
        emitPhase(step.phase)
      }
    }

    const hasTurnStart = events.some((event) => event.kind === 'turn-start')
    if (replay && timeline) {
      if (!hasTurnStart && step.turn > state.turn) {
        state.turn = step.turn
        state.turnPlayer = step.turnPlayer
        state.phase = null
        emitTurn(step.turn, step.turnPlayer)
      }
    } else {
      syncContext()
    }

    let segment: StepLogRow[] = []
    let segmentIndex = 0
    let allRows: StepLogRow[] = []
    let synthetic = summaryEventIndex(step, events) < 0 ? syntheticRows(step) : []

    const flush = (): void => {
      if (segment.length === 0) return
      items.push({
        kind: 'step',
        key: `${step.id}:${segmentIndex++}`,
        step,
        index,
        rows: segment
      })
      allRows = allRows.concat(segment)
      segment = []
    }

    const pushRows = (rows: StepLogRow[]): void => {
      if (rows.length === 0) return
      if (synthetic.length > 0) {
        segment.push(...synthetic)
        synthetic = []
      }
      segment.push(...rows)
    }

    events.forEach((event, eventIndex) => {
      if (event.kind === 'turn-start') {
        flush()
        state.pendingCostLp = false
        state.turn =
          state.turn === 0 && step.turn > 0 ? step.turn : state.turn > 0 ? state.turn + 1 : 1
        state.turnPlayer = event.player
        state.phase = null
        emitTurn(state.turn, event.player)
        return
      }
      if (event.kind === 'phase') {
        flush()
        state.pendingCostLp = false
        if (state.turn <= 0) return
        const phase = duelPhaseFromMask(event.phase)
        if (state.phase === null || PHASE_ORDER[phase] > PHASE_ORDER[state.phase]) {
          state.phase = phase
          emitPhase(phase)
        }
        return
      }
      applyEventLp(state, event)
      pushRows(rowsForEvent(step, events, eventIndex, event, state))
    })

    const hasTargetEvent = events.some((event) => event.kind === 'target')
    const targetName = step.targetCardName?.trim()
    if (targetName && !hasTargetEvent && step.actionType !== 'ATTACK') {
      segment.push({
        kind: 'text',
        text: `对象：${targetName}`,
        tone: 'note',
        indented: state.chainSolving > 0
      })
    }

    const knownRows = allRows.concat(segment, synthetic)
    if (
      isHandShuffleNote(step.description) &&
      !knownRows.some((row) => row.kind === 'text' && row.text.includes('手牌切洗'))
    ) {
      segment.push({
        kind: 'text',
        text: '手牌切洗',
        tone: 'note',
        indented: state.chainSolving > 0
      })
    }

    if (
      step.description?.includes('效果被无效') &&
      !knownRows.some((row) => row.kind === 'text' && row.text.includes('效果被无效')) &&
      !knownRows.some(
        (row) => row.kind === 'single' && (row.label === '效果无效' || row.label === '发动无效')
      )
    ) {
      segment.push({
        kind: 'text',
        text: '效果被无效',
        tone: 'danger',
        indented: state.chainSolving > 0
      })
    }

    const lpChange = step.lpChange
    if (lpChange) {
      const change = lpChange.newLp - lpChange.oldLp
      const matched = allRows
        .concat(segment)
        .some(
          (row) =>
            row.kind === 'lp' && row.player === lpChange.player && row.total === lpChange.newLp
        )
      if (change !== 0 && !matched) {
        segment.push({
          kind: 'lp',
          player: lpChange.player,
          reason: change > 0 ? '回复' : '伤害',
          total: lpChange.newLp,
          change,
          turn: state.turn || step.turn,
          indented: state.chainSolving > 0
        })
      }
    }

    if (synthetic.length > 0) {
      segment.push(...synthetic)
      synthetic = []
    }
    flush()
    applyStepLp(step, state)
    state.pendingCostLp = false
  })

  return items
}
