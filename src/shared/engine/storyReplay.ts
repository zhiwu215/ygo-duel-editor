import { CardLocation } from '../constants/locations'
import { CardPosition } from '../constants/positions'
import { DuelStep, LightweightCardSnapshot } from '../types/story'
import { AgentStepProposal } from '../types/ipc'

const STEP_TARGET: Partial<
  Record<DuelStep['actionType'], { zone: number; position?: number; fromPileOnly?: boolean }>
> = {
  NORMAL_SUMMON: { zone: CardLocation.MZONE, position: CardPosition.FACEUP_ATTACK },
  SPECIAL_SUMMON: { zone: CardLocation.MZONE, position: CardPosition.FACEUP_ATTACK },
  FLIP_SUMMON: { zone: CardLocation.MZONE, position: CardPosition.FACEUP_ATTACK },
  XYZ_SUMMON: { zone: CardLocation.MZONE, position: CardPosition.FACEUP_ATTACK },
  SET_MONSTER: { zone: CardLocation.MZONE, position: CardPosition.FACEDOWN_DEFENSE },
  SET_SPELL_TRAP: { zone: CardLocation.SZONE, position: CardPosition.FACEDOWN },
  SET_PENDULUM: { zone: CardLocation.SZONE, position: CardPosition.FACEUP },
  ACTIVATE_FIELD: { zone: CardLocation.SZONE, position: CardPosition.FACEUP },
  SEARCH: { zone: CardLocation.HAND, fromPileOnly: true },
  SEND_TO_GRAVE: { zone: CardLocation.GRAVE, fromPileOnly: true },
  SALVAGE: { zone: CardLocation.HAND },
  TO_HAND: { zone: CardLocation.HAND },
  TO_GRAVE: { zone: CardLocation.GRAVE },
  BANISH: { zone: CardLocation.REMOVED },
  TO_DECK: { zone: CardLocation.DECK }
}

function cloneSnap(cards: LightweightCardSnapshot[]): LightweightCardSnapshot[] {
  return cards.map((c) => ({
    ...c,
    overlayMaterials: [...c.overlayMaterials]
  }))
}
function isPileZone(location: number): boolean {
  return (
    location === CardLocation.HAND ||
    location === CardLocation.GRAVE ||
    location === CardLocation.DECK ||
    location === CardLocation.EXTRA ||
    location === CardLocation.REMOVED
  )
}
function locateCard(
  board: LightweightCardSnapshot[],
  step: AgentStepProposal
): LightweightCardSnapshot | null {
  if (!step.cardCode || step.cardCode <= 0) return null
  const byCodeFrom =
    step.fromLocation !== undefined
      ? board.find((c) => c.code === step.cardCode && c.location === step.fromLocation)
      : undefined
  return byCodeFrom ?? board.find((c) => c.code === step.cardCode) ?? null
}
function moveCardInBoard(
  board: LightweightCardSnapshot[],
  card: LightweightCardSnapshot,
  toZone: number,
  toSequence: number | undefined,
  toPosition: number | undefined
): void {
  const rest = board.filter((c) => c !== card)
  const moved: LightweightCardSnapshot = {
    ...card,
    location: toZone,
    position: toPosition ?? card.position
  }
  if (isPileZone(toZone)) {
    const pileSize = rest.filter(
      (c) =>
        c.controller === moved.controller &&
        c.location === toZone &&
        c.duelistId === moved.duelistId
    ).length
    moved.sequence = pileSize
  } else {
    const seq = toSequence ?? moved.sequence
    moved.sequence = Math.max(0, Math.trunc(seq))
    for (let i = rest.length - 1; i >= 0; i--) {
      const occupant = rest[i]
      if (
        occupant.controller === moved.controller &&
        occupant.location === toZone &&
        occupant.sequence === moved.sequence
      ) {
        rest.splice(i, 1)
      }
    }
  }
  rest.push(moved)
  board.length = 0
  board.push(...rest)
}
function applyStepToBoard(board: LightweightCardSnapshot[], step: AgentStepProposal): void {
  if (step.actionType === 'DRAW') {
    const handCards = board.filter(
      (c) => c.controller === step.actionPlayer && c.location === CardLocation.HAND
    )
    if (step.cardCode && step.cardCode > 0 && !handCards.some((c) => c.code === step.cardCode)) {
      const deckCards = board.filter(
        (c) => c.controller === step.actionPlayer && c.location === CardLocation.DECK
      )
      const top = deckCards.reduce<LightweightCardSnapshot | null>(
        (acc, c) => (!acc || c.sequence > acc.sequence ? c : acc),
        null
      )
      if (top) {
        moveCardInBoard(board, top, CardLocation.HAND, undefined, CardPosition.FACEDOWN)
        return
      }
      board.push({
        instanceId: `replay_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`,
        code: step.cardCode,
        controller: step.actionPlayer,
        owner: step.actionPlayer,
        location: CardLocation.HAND,
        sequence: handCards.length,
        position: CardPosition.FACEDOWN,
        overlayMaterials: []
      })
    }
    return
  }

  const explicitZone = step.toLocation
  const inferred = STEP_TARGET[step.actionType]
  const target = explicitZone !== undefined ? { zone: explicitZone } : inferred
  if (!target || !target.zone) return

  const card = locateCard(board, step)
  if (!card) return
  moveCardInBoard(board, card, target.zone, step.toSequence, inferred?.position)
}
export function replayStepsBoard(
  initial: LightweightCardSnapshot[],
  steps: DuelStep[]
): DuelStep[] {
  const board = cloneSnap(initial)
  return steps.map((step) => {
    applyStepToBoard(board, step)
    return { ...step, boardAfter: cloneSnap(board) }
  })
}
