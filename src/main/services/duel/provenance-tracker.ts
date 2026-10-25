import {
  CardLocation,
  EngineBoardState,
  EngineCard,
  FIELD_ZONE_SEQUENCE,
  FieldCard,
  InjectCommand,
  getPzoneSzoneSequence,
  isStandardTag
} from '@shared/index'
import type { DuelPuzzleState } from '@shared/index'
import type { SessionState } from './session-state'

export type ProvenanceOrigin =
  { kind: 'initial'; puzzleCardId: string; code: number } | { kind: 'inject'; opIndex: number }

export interface ProvenanceRecord {
  code: number
  origin?: ProvenanceOrigin
  initial?: {
    controller: 0 | 1
    location: number
    sequence: number
    duelistId?: string
  }
}

const PRIVATE_LOCATIONS = new Set<number>([
  CardLocation.HAND,
  CardLocation.DECK,
  CardLocation.EXTRA
])

function locationKey(
  controller: number,
  location: number,
  sequence: number,
  duelistId?: string,
  tag = false
): string {
  const seat = tag && PRIVATE_LOCATIONS.has(location) && duelistId ? `:${duelistId}` : ''
  return `${controller}${seat}:${location}:${sequence}`
}

function mapPile(
  map: Map<string, FieldCard>,
  cards: FieldCard[],
  controller: 0 | 1,
  location: number,
  tag: boolean,
  descending: boolean
): void {
  const groups = new Map<string, FieldCard[]>()
  for (const card of cards) {
    if (card.controller !== controller || card.location !== location) continue
    const group = tag ? (card.duelistId ?? '') : ''
    const list = groups.get(group) ?? []
    list.push(card)
    groups.set(group, list)
  }
  for (const list of groups.values()) {
    list.sort((a, b) => (descending ? b.sequence - a.sequence : a.sequence - b.sequence))
    list.forEach((card, index) => {
      map.set(locationKey(controller, location, index, card.duelistId, tag), card)
    })
  }
}

function buildInitialCardMap(puzzleState: DuelPuzzleState): Map<string, FieldCard> {
  const map = new Map<string, FieldCard>()
  const cards = puzzleState.cards.filter((card) => card.code > 0)
  const tag = isStandardTag(puzzleState.matchConfig)
  const pzoneSequence = getPzoneSzoneSequence(puzzleState.masterRule)

  for (const controller of [0, 1] as const) {
    mapPile(map, cards, controller, CardLocation.HAND, tag, false)
    mapPile(map, cards, controller, CardLocation.DECK, tag, true)
    mapPile(map, cards, controller, CardLocation.EXTRA, tag, true)
    mapPile(map, cards, controller, CardLocation.GRAVE, false, false)
    mapPile(map, cards, controller, CardLocation.REMOVED, false, false)
  }

  const takenSzone = new Set<number>()
  for (const card of cards) {
    if (card.location === CardLocation.SZONE) takenSzone.add(card.sequence)
    if (card.location === CardLocation.FZONE) takenSzone.add(FIELD_ZONE_SEQUENCE)
  }
  for (const card of cards) {
    if (card.location === CardLocation.PZONE) {
      const sequence = pzoneSequence[card.sequence]
      if (sequence === undefined || takenSzone.has(sequence)) continue
      takenSzone.add(sequence)
      map.set(locationKey(card.controller, CardLocation.SZONE, sequence), card)
      continue
    }
    if (
      card.location === CardLocation.MZONE ||
      card.location === CardLocation.SZONE ||
      card.location === CardLocation.FZONE
    ) {
      const location = card.location === CardLocation.FZONE ? CardLocation.SZONE : card.location
      const sequence = card.location === CardLocation.FZONE ? FIELD_ZONE_SEQUENCE : card.sequence
      const key = locationKey(card.controller, location, sequence)
      if (!map.has(key)) map.set(key, card)
    }
  }
  return map
}

function initialRecord(puzzleCard: FieldCard, tag: boolean): ProvenanceRecord {
  return {
    code: puzzleCard.code,
    origin: {
      kind: 'initial',
      puzzleCardId: puzzleCard.instanceId,
      code: puzzleCard.code
    },
    initial: {
      controller: puzzleCard.controller,
      location: puzzleCard.location,
      sequence: puzzleCard.sequence,
      duelistId: tag ? puzzleCard.duelistId : undefined
    }
  }
}

export function initializeProvenance(state: SessionState, board: EngineBoardState): void {
  state.provenance.clear()
  const puzzleState = state.initParams?.puzzleState
  if (!puzzleState) return
  const initialMap = buildInitialCardMap(puzzleState)
  const tag = isStandardTag(puzzleState.matchConfig)

  for (const card of board.allCards) {
    const puzzleCard = initialMap.get(
      locationKey(card.controller, card.location, card.sequence, card.duelistId, tag)
    )
    if (!puzzleCard || puzzleCard.code !== card.code) continue
    state.provenance.set(card.instanceId, initialRecord(puzzleCard, tag))
  }
}

export function trackInject(
  state: SessionState,
  before: EngineBoardState,
  after: EngineBoardState,
  opIndex: number,
  command: InjectCommand
): void {
  if (command.op !== 'add-card') return
  const beforeIds = new Set(before.allCards.map((card) => card.instanceId))
  const newCards = after.allCards.filter(
    (card) => !beforeIds.has(card.instanceId) && card.code === command.code
  )
  if (newCards.length === 0) return

  const player = after.players[command.player]
  let location = 0
  let sequence = -1
  switch (command.to) {
    case 'hand':
      location = CardLocation.HAND
      sequence = player.hand.length - 1
      break
    case 'deck-top':
      location = CardLocation.DECK
      sequence = 0
      break
    case 'deck-bottom':
    case 'deck-shuffle':
      location = CardLocation.DECK
      sequence = 0
      break
    case 'grave-top':
      location = CardLocation.GRAVE
      sequence = player.graveyard.length - 1
      break
    case 'removed':
      location = CardLocation.REMOVED
      sequence = player.banished.length - 1
      break
    case 'extra':
      location = CardLocation.EXTRA
      sequence = 0
      break
    case 'mzone':
      location = CardLocation.MZONE
      sequence = command.sequence ?? -1
      break
    case 'szone':
      location = CardLocation.SZONE
      sequence = command.sequence ?? -1
      break
    case 'fzone':
      location = CardLocation.SZONE
      sequence = FIELD_ZONE_SEQUENCE
      break
  }

  const picked =
    newCards.find((card) => card.location === location && card.sequence === sequence) ??
    newCards.find((card) => card.location === location) ??
    newCards[newCards.length - 1]
  state.provenance.set(picked.instanceId, {
    code: picked.code,
    origin: { kind: 'inject', opIndex }
  })
}

function resolveInitialRecord(state: SessionState, card: EngineCard): ProvenanceRecord | null {
  const puzzleState = state.initParams?.puzzleState
  if (!puzzleState || !isStandardTag(puzzleState.matchConfig)) return null
  if (!card.duelistId) return null
  const tag = true
  const puzzleCard = buildInitialCardMap(puzzleState).get(
    locationKey(card.controller, card.location, card.sequence, card.duelistId, tag)
  )
  if (!puzzleCard || puzzleCard.code !== card.code) return null
  const record = initialRecord(puzzleCard, tag)
  state.provenance.set(card.instanceId, record)
  return record
}

export function resolveProvenanceRecord(
  state: SessionState,
  card: EngineCard
): ProvenanceRecord | null {
  return state.provenance.get(card.instanceId) ?? resolveInitialRecord(state, card)
}

export function nodeIdForOp(state: SessionState, opIndex: number): string | null {
  const path = state.timeline.getHistoryPath()
  const exact = path.find((node) => node.opIndex === opIndex)
  if (exact) return exact.id
  const later = path.find((node) => node.opIndex > opIndex)
  if (later) return later.id
  const nodes = state.timeline.getAllNodes().filter((node) => node.opIndex === opIndex)
  return nodes.length > 0 ? nodes[nodes.length - 1].id : null
}
