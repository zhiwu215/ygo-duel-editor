import {
  CardQuery,
  OcgcoreCommonConstants,
  YGOProMsgReloadField,
  YGOProMsgReloadField_PlayerInfo,
  YGOProMsgReloadField_ZoneCard,
  YGOProMsgStart,
  YGOProMsgStart_PlayerInfo,
  YGOProMsgUpdateData,
  createClearedCardQuery
} from 'ygopro-msg-encode'
import {
  CardLocation,
  CardPosition,
  FIELD_ZONE_SEQUENCE,
  getPzoneSzoneSequence,
  type DuelPuzzleState,
  type FieldCard
} from '@shared/index'

const { QUERY_CODE, QUERY_POSITION } = OcgcoreCommonConstants
const MZONE_SLOTS = 7
const SZONE_SLOTS = 8
const UPDATE_LOCATIONS = [
  CardLocation.MZONE,
  CardLocation.SZONE,
  CardLocation.HAND,
  CardLocation.GRAVE,
  CardLocation.REMOVED
] as const

interface PlacedCard {
  card: FieldCard
  location: number
  sequence: number
}

function placedCardsOf(state: DuelPuzzleState, controller: 0 | 1): PlacedCard[] {
  const pzoneSequence = getPzoneSzoneSequence(state.masterRule)
  const placed: PlacedCard[] = []
  for (const card of state.cards) {
    if (card.code <= 0 || card.controller !== controller) continue
    if (card.location === CardLocation.PZONE) {
      placed.push({
        card,
        location: CardLocation.SZONE,
        sequence: card.sequence === 0 ? pzoneSequence[0] : pzoneSequence[1]
      })
      continue
    }
    if (card.location === CardLocation.FZONE) {
      placed.push({ card, location: CardLocation.SZONE, sequence: FIELD_ZONE_SEQUENCE })
      continue
    }
    placed.push({ card, location: card.location, sequence: card.sequence })
  }
  return placed
}

function countOf(state: DuelPuzzleState, controller: 0 | 1, location: number): number {
  return state.cards.filter(
    (card) => card.code > 0 && card.controller === controller && card.location === location
  ).length
}

function buildStartMessage(state: DuelPuzzleState): YGOProMsgStart {
  const start = new YGOProMsgStart()
  start.playerType = 0
  start.duelRule = state.masterRule
  start.startLp0 = state.players[0]?.lp ?? 8000
  start.startLp1 = state.players[1]?.lp ?? 8000
  start.player0 = new YGOProMsgStart_PlayerInfo()
  start.player0.deckCount = countOf(state, 0, CardLocation.DECK)
  start.player0.extraCount = countOf(state, 0, CardLocation.EXTRA)
  start.player1 = new YGOProMsgStart_PlayerInfo()
  start.player1.deckCount = countOf(state, 1, CardLocation.DECK)
  start.player1.extraCount = countOf(state, 1, CardLocation.EXTRA)
  return start
}

function buildPlayerInfo(
  state: DuelPuzzleState,
  controller: 0 | 1
): YGOProMsgReloadField_PlayerInfo {
  const placed = placedCardsOf(state, controller)
  const find = (location: number, sequence: number): FieldCard | undefined =>
    placed.find((entry) => entry.location === location && entry.sequence === sequence)?.card

  const player = new YGOProMsgReloadField_PlayerInfo()
  player.lp = state.players[controller]?.lp ?? 8000
  player.mzone = Array.from({ length: MZONE_SLOTS }, (_, sequence) => {
    const zone = new YGOProMsgReloadField_ZoneCard()
    const card = find(CardLocation.MZONE, sequence)
    if (!card) {
      zone.occupied = 0
      return zone
    }
    zone.occupied = 1
    zone.position = card.position
    zone.xyzCount = card.overlayMaterials?.length ?? 0
    return zone
  })
  player.szone = Array.from({ length: SZONE_SLOTS }, (_, sequence) => {
    const zone = new YGOProMsgReloadField_ZoneCard()
    const card = find(CardLocation.SZONE, sequence)
    if (!card) {
      zone.occupied = 0
      return zone
    }
    zone.occupied = 1
    zone.position = card.position
    return zone
  })
  player.deckCount = countOf(state, controller, CardLocation.DECK)
  player.handCount = countOf(state, controller, CardLocation.HAND)
  player.graveCount = countOf(state, controller, CardLocation.GRAVE)
  player.removedCount = countOf(state, controller, CardLocation.REMOVED)
  player.extraCount = countOf(state, controller, CardLocation.EXTRA)
  player.extraPCount = 0
  return player
}

function buildReloadFieldMessage(state: DuelPuzzleState): YGOProMsgReloadField {
  const reload = new YGOProMsgReloadField()
  reload.duelRule = state.masterRule
  reload.players = [buildPlayerInfo(state, 0), buildPlayerInfo(state, 1)]
  reload.chains = []
  return reload
}

function toCardQuery(placed: PlacedCard): CardQuery {
  const query = new CardQuery()
  query.flags = QUERY_CODE | QUERY_POSITION
  query.code = placed.card.code
  query.controller = placed.card.controller
  query.location = placed.location
  query.sequence = placed.sequence
  query.position =
    placed.location === CardLocation.HAND ? CardPosition.FACEDOWN : placed.card.position
  return query
}

function buildZoneQueries(placed: PlacedCard[], location: number, slots: number): CardQuery[] {
  return Array.from({ length: slots }, (_, sequence) => {
    const card = placed.find((entry) => entry.location === location && entry.sequence === sequence)
    return card ? toCardQuery(card) : createClearedCardQuery()
  })
}

function buildUpdateDataMessages(state: DuelPuzzleState): YGOProMsgUpdateData[] {
  const messages: YGOProMsgUpdateData[] = []
  for (const controller of [0, 1] as const) {
    const placed = placedCardsOf(state, controller)
    for (const location of UPDATE_LOCATIONS) {
      const cards = placed.filter((entry) => entry.location === location)
      if (cards.length === 0) continue
      const message = new YGOProMsgUpdateData()
      message.player = controller
      message.location = location
      message.cards =
        location === CardLocation.MZONE
          ? buildZoneQueries(placed, location, MZONE_SLOTS)
          : location === CardLocation.SZONE
            ? buildZoneQueries(placed, location, SZONE_SLOTS)
            : cards.sort((a, b) => a.sequence - b.sequence).map(toCardQuery)
      messages.push(message)
    }
  }
  return messages
}

export function buildReplayBootstrapPayloads(state: DuelPuzzleState): Uint8Array[] {
  return [
    buildStartMessage(state),
    buildReloadFieldMessage(state),
    ...buildUpdateDataMessages(state)
  ].map((message) => message.toPayload())
}
