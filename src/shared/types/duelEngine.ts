import { CdbCard } from './card'
import { DuelPuzzleState } from './duel'
import type { EngineRequest } from '../engine/protocol'

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

export interface EngineTimelineNode {
  id: string
  parentId: string | null
  stepNumber: number
  title: string
  player: 0 | 1
  logs: string[]
  boardState: EngineBoardState
  /** 该步骤完成后等待作答的请求（与 pendingRequest 语义一致；无询问时为 null） */
  pendingRequest: EngineRequest | null
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
