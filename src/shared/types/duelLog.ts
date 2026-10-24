export type DuelSummonKind =
  'normal' | 'special' | 'flip' | 'fusion' | 'synchro' | 'xyz' | 'link' | 'ritual' | 'pendulum'

export interface DuelLogCardRef {
  code: number
  name?: string
  controller: 0 | 1
  location: number
  sequence: number
  position?: number
}

export interface DuelLogMove {
  card: DuelLogCardRef
  from?: DuelLogCardRef
  to: DuelLogCardRef
  reason: number
  reasonText: string
  cost?: boolean
}

export type DuelLogEvent =
  | { kind: 'turn-start'; player: 0 | 1 }
  | { kind: 'phase'; phase: number }
  | {
      kind: 'summon'
      card: DuelLogCardRef
      from?: DuelLogCardRef
      summonKind: DuelSummonKind
    }
  | { kind: 'set'; card: DuelLogCardRef; from?: DuelLogCardRef }
  | {
      kind: 'activate'
      card: DuelLogCardRef
      from?: DuelLogCardRef
      chainCount: number
      effectText?: string
    }
  | { kind: 'chain'; chainCount: number }
  | {
      kind: 'chain-solving'
      chainCount: number
      card?: DuelLogCardRef
      effectText?: string
    }
  | { kind: 'chain-end'; chainCount: number }
  | {
      kind: 'chain-negated'
      chainCount: number
      disabled: boolean
      card?: DuelLogCardRef
    }
  | { kind: 'move'; move: DuelLogMove }
  | { kind: 'target'; cards: DuelLogCardRef[] }
  | {
      kind: 'attack'
      attacker: DuelLogCardRef
      defender?: DuelLogCardRef
      direct: boolean
    }
  | { kind: 'attack-disabled'; card?: DuelLogCardRef }
  | { kind: 'draw'; player: 0 | 1; cards: { code: number; name?: string }[] }
  | { kind: 'damage'; player: 0 | 1; value: number; lp: number }
  | { kind: 'recover'; player: 0 | 1; value: number; lp: number }
  | { kind: 'lp-update'; player: 0 | 1; lp: number; delta: number }
  | {
      kind: 'position'
      card: DuelLogCardRef
      fromPosition: number
      toPosition: number
    }
  | {
      kind: 'counter'
      card: DuelLogCardRef
      counterType: number
      count: number
      remove: boolean
    }
  | {
      kind: 'reveal'
      cards: DuelLogCardRef[]
      source: 'deck' | 'hand' | 'field'
    }
  | { kind: 'swap'; from: DuelLogCardRef; to: DuelLogCardRef }
  | { kind: 'text'; text: string }
