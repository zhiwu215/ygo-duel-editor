import { EngineBoardState, EngineDiffResult, EngineTimelineNode } from '../types/duelEngine'

export type RequestKind =
  | 'idle'
  | 'battle'
  | 'card'
  | 'tribute'
  | 'chain'
  | 'place'
  | 'disfield'
  | 'position'
  | 'yesno'
  | 'option'
  | 'counter'
  | 'sum'
  | 'sort'
  | 'unselect'
  | 'rps'
  | 'announce'

export type AnnounceType = 'race' | 'attrib' | 'number' | 'card'
export interface RequestCard {
  code: number
  controller: 0 | 1
  location: number
  sequence: number
  subsequence?: number
  duelistId?: string
  desc?: number
  directAttackable?: boolean
  opParam?: number
  counterCount?: number
}

export interface RequestPlace {
  controller: 0 | 1
  location: number
  sequence: number
}

export type RequestData =
  | {
      kind: 'idle'
      summonable: RequestCard[]
      spSummonable: RequestCard[]
      msetable: RequestCard[]
      ssetable: RequestCard[]
      reposable: RequestCard[]
      activatable: RequestCard[]
      canBp: boolean
      canEp: boolean
      canShuffle: boolean
    }
  | {
      kind: 'battle'
      attackable: RequestCard[]
      activatable: RequestCard[]
      canM2: boolean
      canEp: boolean
    }
  | { kind: 'card'; cards: RequestCard[]; min: number; max: number; cancelable: boolean }
  | { kind: 'tribute'; cards: RequestCard[]; min: number; max: number; cancelable: boolean }
  | { kind: 'chain'; chains: RequestCard[]; forced: boolean }
  | { kind: 'place'; places: RequestPlace[]; count: number }
  | { kind: 'disfield'; places: RequestPlace[]; count: number }
  | { kind: 'position'; positions: number[]; code?: number }
  | { kind: 'yesno'; desc: number; card?: RequestCard }
  | { kind: 'option'; options: { code: number; text?: string }[] }
  | {
      kind: 'counter'
      counterType: number
      counterCount: number
      count: number
      cards: RequestCard[]
    }
  | {
      kind: 'sum'
      mode: number
      sumVal: number
      min: number
      max: number
      count: number
      mustSelect: RequestCard[]
      cards: RequestCard[]
    }
  | { kind: 'sort'; cards: RequestCard[] }
  | {
      kind: 'unselect'
      finishable: boolean
      cancelable: boolean
      min: number
      max: number
      selectable: RequestCard[]
      unselectable: RequestCard[]
    }
  | { kind: 'rps' }
  | {
      kind: 'announce'
      announceType: AnnounceType
      count: number
      availableMask?: number
      numbers?: number[]
    }

export type TimingPolicy = {
  chain: 'ignore' | 'smart' | 'available' | 'all'
  effectYn: 'never' | 'ask'
}

export const DEFAULT_TIMING_POLICY: TimingPolicy = {
  chain: 'smart',
  effectYn: 'ask'
}

export function normalizeTimingPolicy(value?: Partial<TimingPolicy> | null): TimingPolicy {
  const chain =
    value?.chain === 'ignore' ||
    value?.chain === 'smart' ||
    value?.chain === 'available' ||
    value?.chain === 'all'
      ? value.chain
      : DEFAULT_TIMING_POLICY.chain
  const effectYn = value?.effectYn === 'never' ? 'never' : DEFAULT_TIMING_POLICY.effectYn
  return { chain, effectYn }
}

export interface EngineRequest {
  id: string
  seq: number
  player: 0 | 1
  kind: RequestKind
  identifier: number
  title: string
  subtitle?: string
  descHint?: number
  data: RequestData
}

type IdleCmd =
  'SUMMON' | 'SPSUMMON' | 'MSET' | 'SSET' | 'REPOS' | 'ACTIVATE' | 'TO_BP' | 'TO_EP' | 'SHUFFLE'

type BattleCmd = 'ATTACK' | 'ACTIVATE' | 'TO_M2' | 'TO_EP'

export type Answer =
  | { kind: 'idle'; cmd: IdleCmd; card?: RequestCard }
  | { kind: 'battle'; cmd: BattleCmd; card?: RequestCard }
  | { kind: 'card'; cards: RequestCard[] | null }
  | { kind: 'tribute'; cards: RequestCard[] | null }
  | { kind: 'chain'; card?: RequestCard | null }
  | { kind: 'place'; places: RequestPlace[] }
  | { kind: 'position'; position: number }
  | { kind: 'yesno'; yes: boolean }
  | { kind: 'option'; index: number }
  | { kind: 'counter'; counters: { card: RequestCard; count: number }[] }
  | { kind: 'sum'; cards: RequestCard[] }
  | { kind: 'sort'; cards: RequestCard[] | null }
  | { kind: 'unselect'; card?: RequestCard | null }
  | { kind: 'rps'; hand: 'rock' | 'scissors' | 'paper' }
  | { kind: 'announce'; value: number }

export type InjectCommand =
  | {
      op: 'add-card'
      player: 0 | 1
      code: number
      to:
        | 'hand'
        | 'deck-top'
        | 'deck-bottom'
        | 'deck-shuffle'
        | 'grave-top'
        | 'grave-bottom'
        | 'removed'
        | 'extra'
        | 'mzone'
        | 'szone'
        | 'fzone'
      sequence?: number
      position?: number
    }
  | { op: 'set-lp'; player: 0 | 1; lp: number }
export interface EngineSubmitAnswerResult {
  retry: boolean
  boardState?: EngineBoardState
  pendingRequest?: EngineRequest | null
  node?: EngineTimelineNode
  diff?: EngineDiffResult
  actTurn?: number
  actTurnPlayer?: 0 | 1
  actPhase?: number
}

export interface EngineInjectResult {
  boardState: EngineBoardState
  node: EngineTimelineNode
  warning?: string
}
