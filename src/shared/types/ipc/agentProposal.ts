import { CdbCard } from '../card'
import { DuelActionType, DuelPhase } from '../story'

export interface AgentStepProposal {
  turn: number

  phase: DuelPhase

  actionPlayer: 0 | 1

  actionType: DuelActionType

  cardCode?: number

  cardName?: string

  speaker?: string

  dialogue?: string

  innerThoughts?: string

  description?: string

  chainIndex?: number

  fromLocation?: number

  toLocation?: number

  toSequence?: number

  sourceQuote?: string

  lpChange?: {
    player: 0 | 1

    oldLp: number

    newLp: number
  }
}

export interface AgentBoardCardPlacement {
  code: number

  cardName?: string

  isUnknown?: boolean

  side: 0 | 1

  location: AgentBoardZone

  sequence: number

  position?: AgentBoardCardFacing

  duelistName?: string

  customAtk?: number

  customDef?: number
}

export type AgentBoardZone = 'MZONE' | 'SZONE' | 'HAND' | 'GRAVE' | 'DECK' | 'EXTRA' | 'REMOVED'

export type AgentBoardCardFacing = 'FACEUP_ATTACK' | 'FACEUP_DEFENSE' | 'FACEDOWN' | 'FACEUP'

export interface AgentBoardLpTarget {
  side: 0 | 1

  lp: number

  duelistName?: string
}

export interface ResolvedBoardPlacement {
  card: CdbCard
  controller: 0 | 1

  location: number

  sequence: number

  position: number

  duelistName?: string

  duelistId?: string
  customAtk?: number
  customDef?: number
}

export interface AgentBoardSetupProposal {
  summary: string

  clearExisting: boolean

  lp: AgentBoardLpTarget[]

  cards: AgentBoardCardPlacement[]

  warnings: string[]
}
