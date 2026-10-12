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
  fzone: EngineCard | null
  pzone: (EngineCard | null)[]
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
  instanceId?: string
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

export interface EngineOptionMatchCard {
  instanceId?: string
  controller?: number
  location: number
  sequence?: number
  code?: number
}

function isSameEngineZone(
  optLocation: number | undefined,
  cardLocation: number,
  optSequence: number | undefined,
  cardSequence: number | undefined
): boolean {
  if (optLocation === undefined) return true
  if (optLocation === cardLocation) {
    if (optSequence !== undefined && cardSequence !== undefined && optSequence !== cardSequence) {
      return false
    }
    return true
  }
  const optIsField =
    optLocation === CardLocation.FZONE || (optLocation === CardLocation.SZONE && optSequence === 5)
  const cardIsField =
    cardLocation === CardLocation.FZONE ||
    (cardLocation === CardLocation.SZONE && cardSequence === 5)
  return optIsField && cardIsField
}

export function isCardMatchingEngineOption(
  card: EngineOptionMatchCard,
  opt: EngineActionOption
): boolean {
  if (card.instanceId && opt.instanceId) {
    return card.instanceId === opt.instanceId
  }
  if (opt.cardCode === undefined) {
    return false
  }
  if (card.code !== undefined && opt.cardCode !== card.code) {
    return false
  }
  if (
    opt.controller !== undefined &&
    card.controller !== undefined &&
    opt.controller !== card.controller
  ) {
    return false
  }
  return isSameEngineZone(opt.location, card.location, opt.sequence, card.sequence)
}

export interface EngineDiffMovedCard {
  instanceId: string | null
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
  instanceId: string
  code: number
  controller: 0 | 1
  location: number
  sequence: number
  position: number
  card?: CdbCard
}

export interface EngineDiffRemovedCard {
  instanceId: string | null
  code: number
  controller: 0 | 1
  location: number
  sequence: number
}

export interface EngineDiffPositionChange {
  instanceId: string | null
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
  instanceId: string | null
  controller: 0 | 1
  location: number
  sequence: number
  code: number
  counterType: number
  newCount: number
}

export interface EngineDiffOverlayChange {
  hostInstanceId: string
  hostController: 0 | 1
  hostSequence: number
  materialCode: number
  matIndex: number
  attached: boolean
}

export interface EngineDiffResult {
  movedCards: EngineDiffMovedCard[]
  addedCards: EngineDiffAddedCard[]
  removedCards: EngineDiffRemovedCard[]
  positionChanges: EngineDiffPositionChange[]
  lpChanges: EngineDiffLpChange[]
  counterChanges: EngineDiffCounterChange[]
  overlayChanges: EngineDiffOverlayChange[]
  phaseChange?: {
    phase: number
    phaseName: string
  }
  turnChange?: {
    turn: number
    turnPlayer: 0 | 1
  }
}
