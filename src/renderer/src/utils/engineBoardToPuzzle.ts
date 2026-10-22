import {
  CardLocation,
  createDefaultDuelists,
  type DuelPuzzleState,
  type EngineBoardState,
  type FieldCard
} from '@shared/index'

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
  const cards: FieldCard[] = board.allCards
    .filter((card) => card.location !== CardLocation.OVERLAY)
    .map((card) => ({
      instanceId: card.instanceId,
      code: card.code,
      card: card.card,
      controller: card.controller,
      owner: card.owner,
      location: card.location,
      sequence: card.sequence,
      position: card.position,
      overlayMaterials: [...card.overlayMaterials],
      counters: card.counters ? { ...card.counters } : undefined
    }))

  const duelists = createDefaultDuelists(1, 1)
  if (meta.hostName) duelists[0].name = meta.hostName
  if (meta.clientName) duelists[1].name = meta.clientName
  duelists[0].lp = board.players[0].lp
  duelists[1].lp = board.players[1].lp

  return {
    version: '1.2.0',
    title: meta.title,
    hint: '',
    duelType: 'puzzle',
    masterRule: meta.masterRule ?? 5,
    players: [
      { lp: board.players[0].lp, maxHand: 5, startHand: 0 },
      { lp: board.players[1].lp, maxHand: 5, startHand: 0 }
    ],
    duelists,
    matchConfig: { mode: '1v1', team0Count: 1, team1Count: 1, sharedLp: false },
    turnPlayer: board.turnPlayer,
    firstTurnAttack: false,
    cards: cards.map((card) => ({
      ...card,
      duelistId: card.controller === 0 ? duelists[0].id : duelists[1].id
    })),
    steps: []
  }
}
