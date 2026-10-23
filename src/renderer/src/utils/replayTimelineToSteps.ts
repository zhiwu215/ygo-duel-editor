import {
  CardLocation,
  CardPosition,
  DuelActionType,
  DuelStep,
  EngineBoardState,
  EngineCard,
  EngineStepEvent,
  EngineTimelineNode
} from '@shared/index'
import { resolveCardName } from './cardNames'
import { mapPhaseToDuelPhase } from '../stores/duelEngine/boardReconcile'

interface ReplayCardMove {
  code: number
  fromDuelistId?: string
  fromController?: 0 | 1
  toController?: 0 | 1
  fromLocation?: number
  fromSequence?: number
  toLocation: number
  toSequence: number
  position: number
}

const FIELD_ZONE_LOCATIONS: number[] = [
  CardLocation.MZONE,
  CardLocation.SZONE,
  CardLocation.FZONE,
  CardLocation.PZONE
]

function humanizeReplayTitle(title: string): string {
  return title.replace(/^Player 0[:：]?\s*/, '我方：').replace(/^Player 1[:：]?\s*/, '对方：')
}

function humanizeReplayLog(line: string): string {
  return line
    .replace(/^Player 0/, '我方')
    .replace(/^Player 1/, '对方')
    .replace(/^--- (.+) ---$/, '$1')
}

function isFacedown(position: number): boolean {
  return (position & CardPosition.FACEDOWN) !== 0
}

function moveTier(from: number | undefined, to: number): number {
  if (from !== to && FIELD_ZONE_LOCATIONS.includes(to)) return 0
  if (from !== undefined && from !== to) return 1
  return 2
}

function findReplayCardMove(
  prev: EngineBoardState | undefined,
  curr: EngineBoardState
): ReplayCardMove | undefined {
  if (!prev) return undefined
  const prevById = new Map(prev.allCards.map((card) => [card.instanceId, card]))
  let best: { move: ReplayCardMove; tier: number } | undefined
  for (const card of curr.allCards) {
    const before = prevById.get(card.instanceId)
    if (before && before.location === card.location && before.sequence === card.sequence) continue
    const move: ReplayCardMove = {
      code: card.code,
      fromDuelistId: before?.duelistId,
      fromController: before?.controller,
      toController: card.controller,
      fromLocation: before?.location,
      fromSequence: before?.sequence,
      toLocation: card.location,
      toSequence: card.sequence,
      position: card.position
    }
    const tier = moveTier(before?.location, card.location)
    if (!best || tier < best.tier) best = { move, tier }
  }
  return best?.move
}

interface ReplayPositionChange {
  card: EngineCard
  before: EngineCard
}

interface ReplayStatusChange {
  card: EngineCard
  before: EngineCard
}

function findReplayPositionChange(
  prev: EngineBoardState | undefined,
  curr: EngineBoardState
): ReplayPositionChange | undefined {
  if (!prev) return undefined
  const prevById = new Map(prev.allCards.map((card) => [card.instanceId, card]))
  let best: ReplayPositionChange | undefined
  for (const card of curr.allCards) {
    if (!FIELD_ZONE_LOCATIONS.includes(card.location)) continue
    const before = prevById.get(card.instanceId)
    if (!before || before.position === card.position) continue
    if (before.location !== card.location || before.sequence !== card.sequence) continue
    if (!best || (isFacedown(before.position) && !isFacedown(card.position))) {
      best = { card, before }
    }
  }
  return best
}

function findReplayStatusChange(
  prev: EngineBoardState | undefined,
  curr: EngineBoardState
): ReplayStatusChange | undefined {
  if (!prev) return undefined
  const prevById = new Map(prev.allCards.map((card) => [card.instanceId, card]))
  let best: ReplayStatusChange | undefined
  for (const card of curr.allCards) {
    if (!FIELD_ZONE_LOCATIONS.includes(card.location)) continue
    const before = prevById.get(card.instanceId)
    if (!before || before.status === card.status) continue
    if (!best || (before.status === 0 && card.status !== 0)) best = { card, before }
  }
  return best
}

function findReplayLpChange(
  prev: EngineBoardState | undefined,
  curr: EngineBoardState
): DuelStep['lpChange'] {
  if (!prev) return undefined
  const changed = ([0, 1] as const).filter(
    (player) => prev.players[player].lp !== curr.players[player].lp
  )
  if (changed.length !== 1) return undefined
  const player = changed[0]
  return { player, oldLp: prev.players[player].lp, newLp: curr.players[player].lp }
}

function hasBoardChange(
  prev: EngineBoardState | undefined,
  curr: EngineBoardState,
  includePosition = true
): boolean {
  if (!prev) return true
  if (prev.players[0].lp !== curr.players[0].lp || prev.players[1].lp !== curr.players[1].lp) {
    return true
  }
  if (prev.allCards.length !== curr.allCards.length) return true
  const prevById = new Map(prev.allCards.map((card) => [card.instanceId, card]))
  for (const card of curr.allCards) {
    const before = prevById.get(card.instanceId)
    if (!before) return true
    if (
      before.location !== card.location ||
      before.sequence !== card.sequence ||
      before.controller !== card.controller ||
      (includePosition && before.position !== card.position) ||
      before.status !== card.status ||
      before.code !== card.code ||
      before.overlayMaterials.length !== card.overlayMaterials.length ||
      before.overlayMaterials.some((material, index) => material !== card.overlayMaterials[index])
    ) {
      return true
    }
  }
  return false
}

const REPLAY_PROMPT_PATTERN =
  /是否(?:连锁|发动)|是否.*?发动|主要阶段行动|优先权|等待对方|请选择\/取消选择/

function isReplayPrompt(text: string | undefined): boolean {
  return text !== undefined && REPLAY_PROMPT_PATTERN.test(text)
}

function statusIsNegated(status: number | undefined): boolean {
  return ((status ?? 0) & (0x1 | 0x4000000)) !== 0
}

function classifyReplayMove(move: ReplayCardMove): DuelActionType {
  if (move.toLocation === CardLocation.MZONE) {
    return isFacedown(move.position) ? 'SET_MONSTER' : 'SPECIAL_SUMMON'
  }
  if (move.toLocation === CardLocation.SZONE) {
    return isFacedown(move.position) ? 'SET_SPELL_TRAP' : 'ACTIVATE'
  }
  switch (move.toLocation) {
    case CardLocation.FZONE:
      return 'ACTIVATE_FIELD'
    case CardLocation.PZONE:
      return 'SET_PENDULUM'
    case CardLocation.GRAVE:
      return 'TO_GRAVE'
    case CardLocation.REMOVED:
      return 'BANISH'
    case CardLocation.HAND:
      return 'TO_HAND'
    case CardLocation.DECK:
    case CardLocation.EXTRA:
      return 'TO_DECK'
    default:
      return 'ACTIVATE'
  }
}

function classifyNonMoveAction(
  prev: EngineBoardState | undefined,
  curr: EngineBoardState
): DuelActionType {
  if (!prev) return 'EVENT'
  const [lp0, lp1] = [
    curr.players[0].lp - prev.players[0].lp,
    curr.players[1].lp - prev.players[1].lp
  ]
  if (lp0 < 0 || lp1 < 0) return 'DAMAGE'
  if (lp0 > 0 || lp1 > 0) return 'RECOVER'
  const prevById = new Map(prev.allCards.map((card) => [card.instanceId, card]))
  const positionChanged = curr.allCards.some((card) => {
    const before = prevById.get(card.instanceId)
    return (
      before !== undefined &&
      before.location === card.location &&
      before.sequence === card.sequence &&
      before.position !== card.position
    )
  })
  if (positionChanged) return 'CHANGE_POS'
  return 'EVENT'
}

function describeReplayStep(move: ReplayCardMove | undefined, node: EngineTimelineNode): string {
  if (move) return humanizeReplayTitle(node.title)
  if (node.logs.length > 0) {
    return node.logs.map(humanizeReplayLog).join('；')
  }
  return humanizeReplayTitle(node.title)
}

function multiChainBadges(timeline: EngineTimelineNode[]): Map<string, number> {
  const badges = new Map<string, number>()
  let run: { nodeId: string; chainCount: number }[] = []
  const flush = (): void => {
    if (run.length > 1) {
      for (const link of run) badges.set(link.nodeId, link.chainCount)
    }
    run = []
  }
  for (const node of timeline) {
    for (const event of node.events) {
      if (event.kind === 'chain') {
        run.push({ nodeId: node.id, chainCount: event.chainCount })
      } else if (event.kind === 'chain-end') {
        flush()
      }
    }
  }
  flush()
  return badges
}

export function buildReplaySteps(timeline: EngineTimelineNode[]): DuelStep[] {
  const steps: DuelStep[] = []
  const badgeByNode = multiChainBadges(timeline)
  timeline.slice(1).forEach((node, index) => {
    const prev = timeline[index]
    const move = findReplayCardMove(prev?.boardState, node.boardState)
    const positionChange = findReplayPositionChange(prev?.boardState, node.boardState)
    const activated =
      positionChange !== undefined &&
      isFacedown(positionChange.before.position) &&
      !isFacedown(positionChange.card.position)
    const activation = activated ? positionChange : undefined
    const statusChange = findReplayStatusChange(prev?.boardState, node.boardState)
    const statusChanged = statusChange !== undefined
    const shuffled = node.events.some((event) => event.kind === 'shuffle-hand')
    const drawEvent = node.events.find(
      (event): event is Extract<EngineStepEvent, { kind: 'draw' }> => event.kind === 'draw'
    )
    if (
      !move &&
      !shuffled &&
      !activated &&
      !statusChanged &&
      !drawEvent &&
      !hasBoardChange(prev?.boardState, node.boardState)
    ) {
      return
    }
    const rawDescription = describeReplayStep(move, node)
    let description =
      shuffled && !rawDescription.includes('手牌切洗')
        ? `${rawDescription}（手牌切洗）`
        : rawDescription
    const prompt = isReplayPrompt(description) || isReplayPrompt(node.title)
    if (prompt && !move && !shuffled && !activated) {
      if (!statusChange) return
      description = statusIsNegated(statusChange.card.status) ? '效果被无效' : '效果状态变化'
    }
    const positionType: DuelActionType | undefined = activation
      ? activation.card.location === CardLocation.MZONE
        ? 'FLIP_SUMMON'
        : 'ACTIVATE'
      : undefined
    const lpChange = findReplayLpChange(prev?.boardState, node.boardState)
    const actionDuelistId =
      (drawEvent ? node.boardState.activeDuelist?.[drawEvent.player] : undefined) ??
      move?.fromDuelistId ??
      activation?.before.duelistId ??
      statusChange?.before.duelistId ??
      node.boardState.activeDuelist?.[node.player]
    steps.push({
      id: `replay_${node.id}`,
      actId: node.id,
      origin: 'replay',
      turn: node.boardState.turn,
      turnPlayer: node.boardState.turnPlayer,
      phase: mapPhaseToDuelPhase(node.boardState.phase),
      actionPlayer: node.player,
      actionDuelistId,
      actionType: drawEvent
        ? 'DRAW'
        : move
          ? classifyReplayMove(move)
          : (positionType ?? classifyNonMoveAction(prev?.boardState, node.boardState)),
      instanceId: activation?.card.instanceId ?? statusChange?.card.instanceId,
      cardCode: drawEvent
        ? (move?.code ?? drawEvent.codes[0])
        : (move?.code ?? activation?.card.code ?? statusChange?.card.code),
      cardName: drawEvent
        ? move
          ? resolveCardName(move.code)
          : drawEvent.codes[0]
            ? resolveCardName(drawEvent.codes[0])
            : undefined
        : move
          ? resolveCardName(move.code)
          : activation
            ? resolveCardName(activation.card.code)
            : statusChange
              ? resolveCardName(statusChange.card.code)
              : undefined,
      fromLocation:
        move?.fromLocation ?? activation?.before.location ?? statusChange?.card.location,
      fromSequence:
        move?.fromSequence ?? activation?.before.sequence ?? statusChange?.card.sequence,
      toLocation: move?.toLocation ?? activation?.card.location ?? statusChange?.card.location,
      toSequence: move?.toSequence ?? activation?.card.sequence ?? statusChange?.card.sequence,
      fromController:
        move?.fromController ?? activation?.before.controller ?? statusChange?.card.controller,
      toController:
        move?.toController ?? activation?.card.controller ?? statusChange?.card.controller,
      fromPosition: positionChange?.before.position,
      toPosition: positionChange?.card.position,
      chainBadge: badgeByNode.get(node.id),
      lpChange,
      description
    })
  })
  return steps
}
