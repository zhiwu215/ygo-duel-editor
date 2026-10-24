import type { CdbCard } from './card'

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
