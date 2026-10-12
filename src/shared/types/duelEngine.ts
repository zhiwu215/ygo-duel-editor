import { CdbCard } from './card'
import { DuelPuzzleState } from './duel'
import { CardLocation } from '../constants/locations'

export interface EngineCard {
  instanceId: string
  code: number
  card?: CdbCard
  controller: 0 | 1
  owner: 0 | 1
  location: number
  sequence: number
  position: number
  overlayMaterials: number[]
  counters?: Record<number, number>
}

export interface EnginePlayerState {
  player: 0 | 1
  lp: number
  maxLp: number
  deckCount: number
  extraCount: number
  graveCount: number
  removedCount: number
  hand: EngineCard[]
  deck?: EngineCard[]
  extra?: EngineCard[]
  mzone: (EngineCard | null)[]
  szone: (EngineCard | null)[]
  graveyard: EngineCard[]
  banished: EngineCard[]
}

export interface EngineBoardState {
  turn: number
  turnPlayer: 0 | 1
  phase: number
  phaseName: string
  players: [EnginePlayerState, EnginePlayerState]
  allCards: EngineCard[]
}

export type EngineActionType =
  | 'SUMMON'
  | 'SPSUMMON'
  | 'MSET'
  | 'SSET'
  | 'ACTIVATE'
  | 'REPOS'
  | 'ATTACK'
  | 'BP'
  | 'M2'
  | 'EP'
  | 'PLACE'
  | 'CHAIN'
  | 'PASS'
  | 'TRIBUTE'
  | 'SELECT_CARD'
  | 'YES'
  | 'NO'
  | 'OPTION'
  | 'POSITION'
  | 'ANNOUNCE'

export interface EngineActionOption {
  id: string
  label: string
  type: EngineActionType
  cardCode?: number
  controller?: 0 | 1
  location?: number
  sequence?: number
  zoneIndex?: number
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  rawPayload: any
}

export type EnginePromptKind =
  | 'IDLE_CMD'
  | 'BATTLE_CMD'
  | 'SELECT_PLACE'
  | 'SELECT_CHAIN'
  | 'SELECT_CARD'
  | 'SELECT_TRIBUTE'
  | 'SELECT_YESNO'
  | 'SELECT_EFFECTYN'
  | 'SELECT_OPTION'
  | 'SELECT_POSITION'
  | 'ANNOUNCE'
  | 'WAITING'
  | 'END'

export interface EnginePendingAction {
  kind: EnginePromptKind
  player: 0 | 1
  title: string
  subtitle?: string
  options: EngineActionOption[]
  canCancel?: boolean
  min?: number
  max?: number
}

export interface EngineTimelineNode {
  id: string
  parentId: string | null
  stepNumber: number
  title: string
  player: 0 | 1
  logs: string[]
  boardState: EngineBoardState
  pendingAction: EnginePendingAction | null
  createdAt: number
}

export interface EngineDuelInitParams {
  p0Lp?: number
  p1Lp?: number
  p0StartHand?: number
  p1StartHand?: number
  p0Deck?: number[]
  p1Deck?: number[]
  p0Extra?: number[]
  p1Extra?: number[]
  seed?: number[]
  puzzleState?: DuelPuzzleState
}

export function isCardMatchingEngineOption(
  card: { controller?: number; location: number; sequence?: number; code?: number },
  opt: EngineActionOption
): boolean {
  if (opt.cardCode === undefined && opt.location === undefined) {
    return false
  }
  if (
    opt.controller !== undefined &&
    card.controller !== undefined &&
    opt.controller !== card.controller
  ) {
    return false
  }
  const isCardFieldSpell =
    card.location === CardLocation.FZONE ||
    (card.location === CardLocation.SZONE && card.sequence === 5)
  const isOptFieldSpell =
    opt.location === CardLocation.FZONE ||
    (opt.location === CardLocation.SZONE && opt.sequence === 5)

  if (!isCardFieldSpell || !isOptFieldSpell) {
    if (opt.location !== undefined && opt.location !== card.location) {
      return false
    }
  }
  if (opt.cardCode !== undefined && card.code !== undefined && opt.cardCode !== card.code) {
    return false
  }
  const isFieldZone =
    card.location === CardLocation.MZONE ||
    card.location === CardLocation.SZONE ||
    card.location === CardLocation.FZONE ||
    card.location === CardLocation.PZONE

  if (isFieldZone && !isCardFieldSpell) {
    if (
      opt.sequence !== undefined &&
      card.sequence !== undefined &&
      opt.sequence !== card.sequence
    ) {
      return false
    }
  }
  return true
}

export function areCardsEquivalent(
  cardsA: {
    code: number
    location: number
    sequence: number
    controller: number
    position: number
  }[],
  cardsB: {
    code: number
    location: number
    sequence: number
    controller: number
    position: number
  }[]
): boolean {
  if (cardsA.length !== cardsB.length) return false
  const mapA = new Map<string, number>()
  for (const c of cardsA) {
    const key = `${c.code}_${c.controller}_${c.location}_${c.sequence}_${c.position}`
    mapA.set(key, (mapA.get(key) || 0) + 1)
  }
  for (const c of cardsB) {
    const key = `${c.code}_${c.controller}_${c.location}_${c.sequence}_${c.position}`
    const count = mapA.get(key)
    if (!count) return false
    if (count === 1) mapA.delete(key)
    else mapA.set(key, count - 1)
  }
  return mapA.size === 0
}

export interface EngineDiffMovedCard {
  code: number
  fromController: 0 | 1
  fromLocation: number
  fromSequence: number
  toController: 0 | 1
  toLocation: number
  toSequence: number
  newPosition: number
}

export interface EngineDiffAddedCard {
  code: number
  controller: 0 | 1
  location: number
  sequence: number
  position: number
}

export interface EngineDiffRemovedCard {
  code: number
  controller: 0 | 1
  location: number
  sequence: number
}

export interface EngineDiffPositionChange {
  controller: 0 | 1
  location: number
  sequence: number
  code: number
  newPosition: number
}

export interface EngineDiffLpChange {
  player: 0 | 1
  newLp: number
}

export interface EngineDiffCounterChange {
  controller: 0 | 1
  location: number
  sequence: number
  code: number
  counterType: number
  newCount: number
}

export interface EngineDiffResult {
  movedCards: EngineDiffMovedCard[]
  addedCards: EngineDiffAddedCard[]
  removedCards: EngineDiffRemovedCard[]
  positionChanges: EngineDiffPositionChange[]
  lpChanges: EngineDiffLpChange[]
  counterChanges: EngineDiffCounterChange[]
  phaseChange?: {
    phase: number
    phaseName: string
  }
  turnChange?: {
    turn: number
    turnPlayer: 0 | 1
  }
}
