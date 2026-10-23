import { CardLocation, getPzoneSzoneSequence } from '@shared/index'
import type {
  DuelPuzzleState,
  EngineBoardState,
  EngineCard,
  EngineProvenance,
  FieldCard,
  InjectCommand
} from '@shared/index'
import type { SessionState } from './session-state'

export type ProvenanceOrigin =
  { kind: 'initial'; puzzleCardId: string; code: number } | { kind: 'inject'; opIndex: number }

export interface ProvenanceRecord {
  provenance: EngineProvenance
  origin?: ProvenanceOrigin
  orderStable?: boolean
}

export function cardSignature(card: EngineCard): string {
  return `${card.controller}:${card.location}:${card.sequence}:${card.code}`
}

export function alignProvenance(state: SessionState, board: EngineBoardState): void {
  for (const card of board.allCards) {
    if (state.provenance.has(card.instanceId)) continue
    const record = state.sequenceProvenance.get(cardSignature(card))
    if (record) state.provenance.set(card.instanceId, record)
  }
}

function locationKey(controller: number, location: number, sequence: number): string {
  return `${controller}:${location}:${sequence}`
}

function buildInitialCardMap(puzzleState: DuelPuzzleState): Map<string, FieldCard> {
  const map = new Map<string, FieldCard>()
  const cards = puzzleState.cards.filter((card) => card.code > 0)
  const pzoneSequence = getPzoneSzoneSequence(puzzleState.masterRule)

  for (const controller of [0, 1] as const) {
    cards
      .filter((card) => card.controller === controller && card.location === CardLocation.HAND)
      .sort((a, b) => a.sequence - b.sequence)
      .forEach((card, index) => map.set(locationKey(controller, CardLocation.HAND, index), card))
    cards
      .filter((card) => card.controller === controller && card.location === CardLocation.DECK)
      .sort((a, b) => b.sequence - a.sequence)
      .forEach((card, index) => map.set(locationKey(controller, CardLocation.DECK, index), card))
    cards
      .filter((card) => card.controller === controller && card.location === CardLocation.EXTRA)
      .sort((a, b) => b.sequence - a.sequence)
      .forEach((card, index) => map.set(locationKey(controller, CardLocation.EXTRA, index), card))
    cards
      .filter((card) => card.controller === controller && card.location === CardLocation.GRAVE)
      .forEach((card, index) => map.set(locationKey(controller, CardLocation.GRAVE, index), card))
    cards
      .filter((card) => card.controller === controller && card.location === CardLocation.REMOVED)
      .forEach((card, index) => map.set(locationKey(controller, CardLocation.REMOVED, index), card))
  }

  const takenSzone = new Set<number>()
  for (const card of cards) {
    if (card.location === CardLocation.SZONE) takenSzone.add(card.sequence)
    if (card.location === CardLocation.FZONE) takenSzone.add(5)
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
      const sequence = card.location === CardLocation.FZONE ? 5 : card.sequence
      const key = locationKey(card.controller, location, sequence)
      if (!map.has(key)) map.set(key, card)
    }
  }
  return map
}

export function initializeProvenance(state: SessionState, board: EngineBoardState): void {
  state.provenance.clear()
  state.drawCounts = [0, 0]
  state.deckDirty = [false, false]
  const puzzleState = state.initParams?.puzzleState
  const initialMap = puzzleState ? buildInitialCardMap(puzzleState) : null

  for (const card of board.allCards) {
    const puzzleCard = initialMap?.get(locationKey(card.controller, card.location, card.sequence))
    const solid = puzzleCard && puzzleCard.code === card.code ? puzzleCard : undefined
    state.provenance.set(card.instanceId, {
      provenance: {
        kind: 'initial',
        controller: solid?.controller ?? card.controller,
        location: solid?.location ?? card.location,
        sequence: solid?.sequence ?? card.sequence,
        code: solid?.code ?? card.code
      },
      origin: solid
        ? { kind: 'initial', puzzleCardId: solid.instanceId, code: solid.code }
        : undefined
    })
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
      sequence = (player.deck?.length ?? player.deckCount) - 1
      break
    case 'deck-bottom':
    case 'deck-shuffle':
      location = CardLocation.DECK
      sequence = 0
      break
    case 'grave-top':
    case 'grave-bottom':
      location = CardLocation.GRAVE
      sequence = player.graveyard.length - 1
      break
    case 'removed':
      location = CardLocation.REMOVED
      sequence = player.banished.length - 1
      break
    case 'extra':
      location = CardLocation.EXTRA
      sequence = (player.extra?.length ?? player.extraCount) - 1
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
      sequence = 5
      break
  }

  const picked =
    newCards.find((card) => card.location === location && card.sequence === sequence) ??
    newCards.find((card) => card.location === location) ??
    newCards[newCards.length - 1]
  state.provenance.set(picked.instanceId, {
    provenance: {
      kind: 'inject',
      opIndex,
      nodeId: null,
      command: structuredClone(command)
    },
    origin: { kind: 'inject', opIndex }
  })
}

export function trackAdvance(
  state: SessionState,
  before: EngineBoardState,
  after: EngineBoardState,
  opIndex: number
): void {
  const beforeHandIds = [
    new Set(before.players[0].hand.map((card) => card.instanceId)),
    new Set(before.players[1].hand.map((card) => card.instanceId))
  ]
  const drawnIds = new Set<string>()
  const usedDeckIds = new Set<string>()
  const pairs: Array<{
    instanceId: string
    player: 0 | 1
    drawIndex: number
    origin?: ProvenanceOrigin
  }> = []

  for (const event of state.lastDrawEvents) {
    const newHand = after.players[event.player].hand
      .filter((card) => !beforeHandIds[event.player].has(card.instanceId))
      .sort((a, b) => a.sequence - b.sequence)

    for (const rawCode of event.codes) {
      const code = rawCode & 0x7fffffff
      const drawIndex = ++state.drawCounts[event.player]
      const candidate = newHand.find((card) => !drawnIds.has(card.instanceId) && card.code === code)
      if (!candidate) continue
      drawnIds.add(candidate.instanceId)

      let base = state.provenance.get(candidate.instanceId)
      let sourceId = candidate.instanceId
      if (!base || base.provenance.kind === 'unknown') {
        const deck = [...(before.players[event.player].deck ?? [])].sort(
          (a, b) => b.sequence - a.sequence
        )
        const deckCard = deck.find(
          (card) =>
            !usedDeckIds.has(card.instanceId) &&
            card.code === code &&
            state.provenance.has(card.instanceId)
        )
        if (deckCard) {
          sourceId = deckCard.instanceId
          base = state.provenance.get(deckCard.instanceId)
        }
      }
      usedDeckIds.add(sourceId)
      pairs.push({
        instanceId: candidate.instanceId,
        player: event.player,
        drawIndex,
        origin: base?.origin
      })
    }
  }

  updateDeckDirty(state, before, after, drawnIds)

  for (const pair of pairs) {
    state.provenance.set(pair.instanceId, {
      provenance: {
        kind: 'drawn',
        opIndex,
        nodeId: null,
        player: pair.player,
        drawIndex: pair.drawIndex
      },
      origin: pair.origin,
      orderStable: !state.deckDirty[pair.player]
    })
  }

  const beforeIds = new Set(before.allCards.map((card) => card.instanceId))
  for (const card of after.allCards) {
    if (beforeIds.has(card.instanceId)) continue
    if (drawnIds.has(card.instanceId)) continue
    if (state.provenance.has(card.instanceId)) continue
    state.provenance.set(card.instanceId, { provenance: { kind: 'unknown' } })
  }
}

function updateDeckDirty(
  state: SessionState,
  before: EngineBoardState,
  after: EngineBoardState,
  drawnIds: Set<string>
): void {
  for (const player of [0, 1] as const) {
    if (state.lastDeckShuffles.includes(player)) {
      state.deckDirty[player] = true
    }

    const beforeDeck = before.players[player].deck ?? []
    const afterDeck = after.players[player].deck ?? []
    const beforeById = new Map(beforeDeck.map((card) => [card.instanceId, card]))
    const afterIds = new Set(afterDeck.map((card) => card.instanceId))
    const beforeIds = new Set(beforeDeck.map((card) => card.instanceId))

    const common = afterDeck.filter((card) => beforeById.has(card.instanceId))
    const beforeOrder = [...common]
      .sort(
        (a, b) =>
          (beforeById.get(a.instanceId)?.sequence ?? 0) -
          (beforeById.get(b.instanceId)?.sequence ?? 0)
      )
      .map((card) => card.instanceId)
      .join('|')
    const afterOrder = [...common]
      .sort((a, b) => a.sequence - b.sequence)
      .map((card) => card.instanceId)
      .join('|')
    if (beforeOrder !== afterOrder) state.deckDirty[player] = true

    if (
      beforeDeck.some((card) => !afterIds.has(card.instanceId) && !drawnIds.has(card.instanceId))
    ) {
      state.deckDirty[player] = true
    }
    if (afterDeck.some((card) => !beforeIds.has(card.instanceId))) {
      state.deckDirty[player] = true
    }
  }
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
