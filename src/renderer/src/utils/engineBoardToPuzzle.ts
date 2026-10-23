import {
  CardLocation,
  applyStandardTagTurnOrder,
  createDefaultDuelists,
  createStandardTagDuelists,
  normalizeMatchConfig,
  type DuelPuzzleState,
  type EngineBoardState,
  type FieldCard
} from '@shared/index'
import { normalizeEngineCardPosition } from './engineCardPosition'

export interface ReplayPuzzleMeta {
  title: string
  hostName?: string
  clientName?: string
  masterRule?: DuelPuzzleState['masterRule']
}

export function buildPuzzleStateFromEngineBoard(
  board: EngineBoardState,
  meta: ReplayPuzzleMeta
): DuelPuzzleState {
  const masterRule = meta.masterRule ?? 5
  const tag = Boolean(board.tag)
  const tagDuelists = board.duelists?.length === 4 ? board.duelists : undefined
  const duelists = tag
    ? applyStandardTagTurnOrder(
        (tagDuelists ?? createStandardTagDuelists()).map((duelist) => ({
          id: duelist.id,
          team: duelist.team,
          name: duelist.name,
          lp: board.players[duelist.team]?.lp ?? 8000
        }))
      )
    : createDefaultDuelists(1, 1)
  if (!tag) {
    if (meta.hostName) duelists[0].name = meta.hostName
    if (meta.clientName) duelists[1].name = meta.clientName
    duelists[0].lp = board.players[0].lp
    duelists[1].lp = board.players[1].lp
  }
  const main0Id = duelists.find((duelist) => duelist.team === 0)?.id
  const main1Id = duelists.find((duelist) => duelist.team === 1)?.id

  const cards: FieldCard[] = board.allCards
    .filter((card) => card.location !== CardLocation.OVERLAY)
    .map((card) => {
      const position = normalizeEngineCardPosition(masterRule, card.location, card.sequence)
      return {
        instanceId: card.instanceId,
        code: card.code,
        card: card.card,
        controller: card.controller,
        owner: card.owner,
        location: position.location,
        sequence: position.sequence,
        position: card.position,
        overlayMaterials: [...card.overlayMaterials],
        counters: card.counters ? { ...card.counters } : undefined,
        duelistId: card.duelistId ?? (card.controller === 0 ? main0Id : main1Id)
      }
    })

  return {
    version: '1.2.0',
    title: meta.title,
    hint: '',
    duelType: 'puzzle',
    masterRule,
    players: [
      { lp: board.players[0].lp, maxHand: 5, startHand: 0 },
      { lp: board.players[1].lp, maxHand: 5, startHand: 0 }
    ],
    duelists,
    matchConfig: normalizeMatchConfig(
      tag
        ? { mode: 'tag', team0Count: 2, team1Count: 2, tagFormat: 'standard' }
        : { mode: '1v1', team0Count: 1, team1Count: 1 }
    ),
    turnPlayer: board.turnPlayer,
    firstTurnAttack: false,
    cards,
    steps: []
  }
}
