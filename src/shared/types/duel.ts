import { MasterRule } from './rules'
import { CdbCard } from './card'
import { DuelStep, LightweightCardSnapshot } from './story'
export interface FieldCard {
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
  customAtk?: number
  customDef?: number
  duelistId?: string
}
export interface Duelist {
  id: string
  team: 0 | 1
  name: string
  lp: number
  isFirst?: boolean
  turnOrder?: number
}
export type DuelType = 'full' | 'puzzle' | 'combo'
type MatchMode = '1v1' | 'tag' | 'custom'
export interface MatchConfig {
  mode: MatchMode
  team0Count: number
  team1Count: number
  sharedLp?: boolean
}
export interface DuelSceneSnapshot {
  duelists: Duelist[]
  cards: FieldCard[]
  turnPlayer: 0 | 1
  firstTurnAttack: boolean
  steps?: DuelStep[]
  matchConfig: MatchConfig
  players?: [PlayerState, PlayerState]
  initialBoardSnapshot?: LightweightCardSnapshot[]
}
export interface PlayerState {
  lp: number
  maxHand: number
  startHand: number
}
export interface DuelSourceRef {
  textId: string
  textTitle: string
  chapterIds: string[]
}
export interface DuelPuzzleState {
  version: string
  title: string
  hint: string
  duelType?: DuelType
  series?: string
  sourceRef?: DuelSourceRef
  masterRule: MasterRule
  players: [PlayerState, PlayerState]
  turnPlayer: 0 | 1
  firstTurnAttack: boolean
  cards: FieldCard[]
  steps?: DuelStep[]
  initialBoardSnapshot?: LightweightCardSnapshot[]
  duelists?: Duelist[]
  matchConfig?: MatchConfig
  scenarios?: Record<string, DuelSceneSnapshot>
  customCounters?: Record<number, string>
}
