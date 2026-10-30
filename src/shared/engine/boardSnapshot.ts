import type { DuelPuzzleState, FieldCard } from '../types/duel'
import type { DuelLogEvent } from '../types/duelLog'
import type { DuelStep, LightweightCardSnapshot } from '../types/story'
import { isPlaceholderCard, placeholderCardData } from '../constants/placeholder'
import { CardLocation } from '../constants/locations'
import { CardPosition } from '../constants/positions'

export function restoreCardsFromSnapshot(
  currentCards: FieldCard[],
  snapshot: LightweightCardSnapshot[]
): FieldCard[] {
  const cardMap = new Map(currentCards.map((c) => [c.instanceId, c]))
  return snapshot.map((s) => {
    const existing = cardMap.get(s.instanceId)
    const matchedCard =
      existing?.card && existing.card.id === s.code
        ? existing.card
        : currentCards.find((c) => c.code === s.code && c.card?.id === s.code)?.card
    const cardData =
      matchedCard ??
      (isPlaceholderCard(s.code) ? (placeholderCardData(s.code) ?? undefined) : undefined)
    return {
      instanceId: s.instanceId,
      code: s.code,
      card: cardData,
      controller: s.controller,
      owner: s.owner ?? s.controller,
      location: s.location,
      sequence: s.sequence,
      position: s.position,
      overlayMaterials: [...(s.overlayMaterials || [])],
      duelistId: s.duelistId,
      customAtk: s.customAtk,
      customDef: s.customDef
    }
  })
}

function cloneSnapshot(snapshot: LightweightCardSnapshot[]): LightweightCardSnapshot[] {
  return snapshot.map((card) => ({ ...card, overlayMaterials: [...(card.overlayMaterials || [])] }))
}

function firstActionStep(steps: DuelStep[] | undefined): DuelStep | undefined {
  return (steps ?? []).find(
    (step) => step.actionType !== 'PHASE_CHANGE' && step.actionType !== 'TURN_CHANGE'
  )
}

function drawEventOf(step: DuelStep): Extract<DuelLogEvent, { kind: 'draw' }> | undefined {
  return step.logEvents?.find(
    (event): event is Extract<DuelLogEvent, { kind: 'draw' }> => event.kind === 'draw'
  )
}

function sameScope(
  card: LightweightCardSnapshot,
  controller: 0 | 1,
  duelistId: string | undefined,
  location: number
): boolean {
  if (card.controller !== controller || card.location !== location) return false
  return !duelistId || !card.duelistId || card.duelistId === duelistId
}

function moveCardToDeck(
  cards: LightweightCardSnapshot[],
  card: LightweightCardSnapshot,
  controller: 0 | 1,
  duelistId: string | undefined
): void {
  for (const other of cards) {
    if (other === card) continue
    if (!sameScope(other, controller, duelistId, CardLocation.DECK)) continue
    other.sequence += 1
  }
  card.location = CardLocation.DECK
  card.sequence = 0
  card.position = CardPosition.FACEDOWN
}

function drawnCardOf(
  cards: LightweightCardSnapshot[],
  step: DuelStep,
  player: 0 | 1,
  code: number
): LightweightCardSnapshot | undefined {
  if (step.instanceId) {
    const exact = cards.find(
      (card) =>
        card.instanceId === step.instanceId &&
        card.controller === player &&
        card.location === CardLocation.HAND
    )
    if (exact) return exact
  }
  return cards
    .filter(
      (card) =>
        card.controller === player && card.location === CardLocation.HAND && card.code === code
    )
    .sort((left, right) => left.sequence - right.sequence)
    .at(-1)
}

function undoAppliedOpeningDraw(cards: LightweightCardSnapshot[], step: DuelStep): void {
  const draw = drawEventOf(step)
  if (!draw) return
  const drawnCodes = draw.cards.filter((card) => card.code > 0).map((card) => card.code)
  if (drawnCodes.length === 0) return
  const afterHand = step.boardAfter?.filter(
    (card) => card.controller === draw.player && card.location === CardLocation.HAND
  )
  if (!afterHand) return
  const snapshotHand = cards.filter(
    (card) => card.controller === draw.player && card.location === CardLocation.HAND
  )
  if (snapshotHand.length < afterHand.length) return
  if (step.instanceId) {
    const exact = cards.find(
      (card) =>
        card.instanceId === step.instanceId &&
        card.controller === draw.player &&
        card.location === CardLocation.HAND
    )
    if (!exact) return
    moveCardToDeck(cards, exact, draw.player, exact.duelistId)
    return
  }
  for (let index = drawnCodes.length - 1; index >= 0; index--) {
    const target = drawnCardOf(cards, step, draw.player, drawnCodes[index])
    if (!target) return
    moveCardToDeck(cards, target, draw.player, target.duelistId)
  }
}

export function resolveOpeningSnapshot(state: DuelPuzzleState): LightweightCardSnapshot[] | null {
  const snapshot = state.initialBoardSnapshot
  if (!snapshot || snapshot.length === 0) return null
  const cards = cloneSnapshot(snapshot)
  const first = firstActionStep(state.steps)
  if (first?.actionType === 'DRAW') {
    undoAppliedOpeningDraw(cards, first)
  }
  return cards
}

export function resolveOpeningCards(state: DuelPuzzleState): FieldCard[] {
  const snapshot = resolveOpeningSnapshot(state)
  if (!snapshot || snapshot.length === 0) return state.cards
  return restoreCardsFromSnapshot(state.cards, snapshot)
}
