import {
  CardLocation,
  CardPosition,
  CardUtils,
  DuelActionType,
  DuelLogCardRef,
  DuelLogEvent,
  DuelStep,
  EngineBoardState,
  EngineCard,
  EngineStepEvent,
  EngineTimelineNode,
  hasHandShuffle,
  withHandShuffleNote
} from '@shared/index'
import { resolveCardName } from './cardNames'
import { isReplayPromptText } from './replayPrompt'
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

type ReplayLogAction = Extract<DuelLogEvent, { kind: 'summon' | 'set' | 'activate' | 'attack' }>

function logActionOf(events: DuelLogEvent[]): ReplayLogAction | undefined {
  return events.find(
    (event): event is ReplayLogAction =>
      event.kind === 'summon' ||
      event.kind === 'set' ||
      event.kind === 'activate' ||
      event.kind === 'attack'
  )
}

function logActionCard(event: ReplayLogAction): DuelLogCardRef {
  return event.kind === 'attack' ? event.attacker : event.card
}

function logActionFrom(event: ReplayLogAction): DuelLogCardRef | undefined {
  return event.kind === 'summon' || event.kind === 'set' || event.kind === 'activate'
    ? event.from
    : undefined
}

function logActionType(event: ReplayLogAction, board: EngineBoardState): DuelActionType {
  if (event.kind === 'summon') {
    if (event.summonKind === 'fusion') return 'FUSION_SUMMON'
    if (event.summonKind === 'synchro') return 'SYNCHRO_SUMMON'
    if (event.summonKind === 'xyz') return 'XYZ_SUMMON'
    if (event.summonKind === 'link') return 'LINK_SUMMON'
    if (event.summonKind === 'ritual') return 'RITUAL_SUMMON'
    if (event.summonKind === 'flip') return 'FLIP_SUMMON'
    if (event.summonKind === 'normal') return 'NORMAL_SUMMON'
    return 'SPECIAL_SUMMON'
  }
  if (event.kind === 'set') {
    const type = board.allCards.find((card) => card.code === event.card.code)?.card?.type ?? 0
    return CardUtils.isMonster(type) ? 'SET_MONSTER' : 'SET_SPELL_TRAP'
  }
  if (event.kind === 'activate') return event.chainCount > 1 ? 'CHAIN' : 'ACTIVATE'
  return 'ATTACK'
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
    const shuffled = hasHandShuffle(node.events)
    const drawEvent = node.events.find(
      (event): event is Extract<EngineStepEvent, { kind: 'draw' }> => event.kind === 'draw'
    )
    const logEvents = node.logEvents ?? []
    const logAction = logActionOf(logEvents)
    const hasChainLog = logEvents.some(
      (event) => event.kind === 'chain-solving' || event.kind === 'chain-end'
    )
    if (
      !move &&
      !shuffled &&
      !activated &&
      !statusChanged &&
      !drawEvent &&
      !logAction &&
      !hasChainLog &&
      !hasBoardChange(prev?.boardState, node.boardState)
    ) {
      return
    }
    const rawDescription = describeReplayStep(move, node)
    let description = withHandShuffleNote(rawDescription, node.events)
    const prompt = isReplayPromptText(description) || isReplayPromptText(node.title)
    if (prompt && !move && !shuffled && !activated && !logAction && !hasChainLog) {
      if (!statusChange) return
      description = statusIsNegated(statusChange.card.status) ? '效果被无效' : '效果状态变化'
    }
    const positionType: DuelActionType | undefined = activation
      ? activation.card.location === CardLocation.MZONE
        ? 'FLIP_SUMMON'
        : 'ACTIVATE'
      : undefined
    const lpChange = findReplayLpChange(prev?.boardState, node.boardState)
    const logCard = logAction ? logActionCard(logAction) : undefined
    const logFrom = logAction ? logActionFrom(logAction) : undefined
    const hasCard = Boolean(
      move || drawEvent || activation || statusChange || positionChange || logCard
    )
    if (!description.trim() && !hasCard && !lpChange) return
    const actionDuelistId =
      (drawEvent ? node.boardState.activeDuelist?.[drawEvent.player] : undefined) ??
      move?.fromDuelistId ??
      activation?.before.duelistId ??
      statusChange?.before.duelistId ??
      node.boardState.activeDuelist?.[logCard?.controller ?? node.player] ??
      node.boardState.duelists?.find(
        (duelist) => duelist.team === (logCard?.controller ?? node.player)
      )?.id
    steps.push({
      id: `replay_${node.id}`,
      actId: node.id,
      origin: 'replay',
      turn: node.boardState.turn,
      turnPlayer: node.boardState.turnPlayer,
      phase: mapPhaseToDuelPhase(node.boardState.phase),
      actionPlayer: logCard?.controller ?? node.player,
      actionDuelistId,
      actionType: drawEvent
        ? 'DRAW'
        : move
          ? classifyReplayMove(move)
          : (positionType ??
            (logAction
              ? logActionType(logAction, node.boardState)
              : classifyNonMoveAction(prev?.boardState, node.boardState))),
      instanceId:
        activation?.card.instanceId ??
        statusChange?.card.instanceId ??
        positionChange?.card.instanceId,
      cardCode: drawEvent
        ? (move?.code ?? drawEvent.codes[0])
        : (move?.code ??
          activation?.card.code ??
          statusChange?.card.code ??
          positionChange?.card.code ??
          logCard?.code),
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
              : logCard
                ? (logCard.name ?? resolveCardName(logCard.code))
                : undefined,
      fromLocation:
        move?.fromLocation ??
        activation?.before.location ??
        statusChange?.card.location ??
        logFrom?.location,
      fromSequence:
        move?.fromSequence ??
        activation?.before.sequence ??
        statusChange?.card.sequence ??
        logFrom?.sequence,
      toLocation:
        move?.toLocation ??
        activation?.card.location ??
        statusChange?.card.location ??
        logCard?.location,
      toSequence:
        move?.toSequence ??
        activation?.card.sequence ??
        statusChange?.card.sequence ??
        logCard?.sequence,
      fromController:
        move?.fromController ??
        activation?.before.controller ??
        statusChange?.card.controller ??
        logFrom?.controller,
      toController:
        move?.toController ??
        activation?.card.controller ??
        statusChange?.card.controller ??
        logCard?.controller,
      fromPosition: positionChange?.before.position ?? logFrom?.position,
      toPosition: positionChange?.card.position ?? logCard?.position,
      chainIndex:
        logAction?.kind === 'activate' && logAction.chainCount > 1
          ? logAction.chainCount
          : undefined,
      chainBadge:
        badgeByNode.get(node.id) ??
        (logAction?.kind === 'activate' && logAction.chainCount > 1
          ? logAction.chainCount
          : undefined),
      logEvents,
      lpChange,
      description
    })
  })
  return steps
}
