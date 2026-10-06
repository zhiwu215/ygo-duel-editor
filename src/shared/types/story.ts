export type DuelPhase = 'DP' | 'SP' | 'M1' | 'BP' | 'M2' | 'EP'

export const PHASE_NAMES: Record<DuelPhase, string> = {
  DP: '抽卡阶段 (DP)',
  SP: '准备阶段 (SP)',
  M1: '主要阶段1 (M1)',
  BP: '战斗阶段 (BP)',
  M2: '主要阶段2 (M2)',
  EP: '结束阶段 (EP)'
}

export const PHASE_SHORT_NAMES: Record<DuelPhase, string> = {
  DP: '抽卡阶段',
  SP: '准备阶段',
  M1: '主要阶段1',
  BP: '战斗阶段',
  M2: '主要阶段2',
  EP: '结束阶段'
}

export type DuelActionType =
  | 'DRAW'
  | 'SEARCH'
  | 'SALVAGE'
  | 'NORMAL_SUMMON'
  | 'SPECIAL_SUMMON'
  | 'FLIP_SUMMON'
  | 'XYZ_SUMMON'
  | 'DETACH_MATERIAL'
  | 'SET_MONSTER'
  | 'SET_SPELL_TRAP'
  | 'ACTIVATE'
  | 'ACTIVATE_FIELD'
  | 'SET_PENDULUM'
  | 'ATTACK'
  | 'TO_GRAVE'
  | 'SEND_TO_GRAVE'
  | 'BANISH'
  | 'TO_HAND'
  | 'TO_DECK'
  | 'CHANGE_POS'
  | 'DAMAGE'
  | 'RECOVER'
  | 'CHAIN'
  | 'RESOLVE_CHAIN'
  | 'PHASE_CHANGE'
  | 'TURN_CHANGE'
  | 'DIALOGUE'

export const ACTION_TYPE_NAMES: Record<DuelActionType, string> = {
  DRAW: '抽卡',
  SEARCH: '检索',
  SALVAGE: '回收',
  NORMAL_SUMMON: '通常召唤',
  SPECIAL_SUMMON: '特殊召唤',
  FLIP_SUMMON: '反转召唤',
  XYZ_SUMMON: '超量召唤',
  DETACH_MATERIAL: '取除素材',
  SET_MONSTER: '盖放怪兽',
  SET_SPELL_TRAP: '盖放魔陷',
  ACTIVATE: '发动',
  ACTIVATE_FIELD: '发动场地',
  SET_PENDULUM: '设置灵摆',
  ATTACK: '攻击宣言',
  TO_GRAVE: '送去墓地',
  SEND_TO_GRAVE: '卡组堆墓',
  BANISH: '除外',
  TO_HAND: '加入手牌',
  TO_DECK: '返回卡组',
  CHANGE_POS: '变更表示形式',
  DAMAGE: '受到伤害',
  RECOVER: '生命回复',
  CHAIN: '连锁',
  RESOLVE_CHAIN: '连锁结算',
  PHASE_CHANGE: '阶段更替',
  TURN_CHANGE: '回合更替',
  DIALOGUE: '剧情对白'
}

export const ACTION_TYPE_COLORS: Record<
  DuelActionType,
  { bg: string; text: string; border: string }
> = {
  DRAW: { bg: 'bg-blue-500/15', text: 'text-blue-400', border: 'border-blue-500/30' },
  SEARCH: { bg: 'bg-indigo-500/15', text: 'text-indigo-400', border: 'border-indigo-500/30' },
  SALVAGE: { bg: 'bg-cyan-500/15', text: 'text-cyan-400', border: 'border-cyan-500/30' },
  NORMAL_SUMMON: { bg: 'bg-muted', text: 'text-muted-foreground', border: 'border-border' },
  SPECIAL_SUMMON: {
    bg: 'bg-emerald-500/15',
    text: 'text-emerald-400',
    border: 'border-emerald-500/30'
  },
  FLIP_SUMMON: { bg: 'bg-yellow-500/15', text: 'text-yellow-400', border: 'border-yellow-500/30' },
  XYZ_SUMMON: { bg: 'bg-slate-500/20', text: 'text-slate-300', border: 'border-slate-400/40' },
  DETACH_MATERIAL: { bg: 'bg-zinc-500/20', text: 'text-zinc-300', border: 'border-zinc-400/40' },
  SET_MONSTER: { bg: 'bg-stone-500/15', text: 'text-stone-300', border: 'border-stone-500/30' },
  SET_SPELL_TRAP: { bg: 'bg-stone-500/15', text: 'text-stone-300', border: 'border-stone-500/30' },
  ACTIVATE: { bg: 'bg-cyan-500/15', text: 'text-cyan-400', border: 'border-cyan-500/30' },
  ACTIVATE_FIELD: { bg: 'bg-teal-500/15', text: 'text-teal-400', border: 'border-teal-500/30' },
  SET_PENDULUM: { bg: 'bg-violet-500/15', text: 'text-violet-400', border: 'border-violet-500/30' },
  ATTACK: { bg: 'bg-rose-500/15', text: 'text-rose-400', border: 'border-rose-500/30' },
  TO_GRAVE: { bg: 'bg-purple-500/15', text: 'text-purple-400', border: 'border-purple-500/30' },
  SEND_TO_GRAVE: {
    bg: 'bg-purple-500/15',
    text: 'text-purple-400',
    border: 'border-purple-500/30'
  },
  BANISH: { bg: 'bg-pink-500/15', text: 'text-pink-400', border: 'border-pink-500/30' },
  TO_HAND: { bg: 'bg-sky-500/15', text: 'text-sky-400', border: 'border-sky-500/30' },
  TO_DECK: { bg: 'bg-blue-600/15', text: 'text-blue-300', border: 'border-blue-600/30' },
  CHANGE_POS: { bg: 'bg-indigo-500/15', text: 'text-indigo-400', border: 'border-indigo-500/30' },
  DAMAGE: { bg: 'bg-rose-600/15', text: 'text-rose-400', border: 'border-rose-600/30' },
  RECOVER: { bg: 'bg-emerald-600/15', text: 'text-emerald-300', border: 'border-emerald-600/30' },
  CHAIN: { bg: 'bg-teal-500/15', text: 'text-teal-400', border: 'border-teal-500/30' },
  RESOLVE_CHAIN: {
    bg: 'bg-emerald-500/15',
    text: 'text-emerald-400',
    border: 'border-emerald-500/30'
  },
  PHASE_CHANGE: { bg: 'bg-muted', text: 'text-muted-foreground', border: 'border-border' },
  TURN_CHANGE: { bg: 'bg-muted', text: 'text-muted-foreground', border: 'border-border' },
  DIALOGUE: { bg: 'bg-yellow-500/15', text: 'text-yellow-400', border: 'border-yellow-500/30' }
}

export interface LightweightCardSnapshot {
  instanceId: string
  code: number
  controller: 0 | 1
  owner?: 0 | 1
  location: number
  sequence: number
  position: number
  overlayMaterials: number[]
  duelistId?: string
  customAtk?: number
  customDef?: number
}

export interface DuelStep {
  id: string
  turn: number
  turnPlayer: 0 | 1
  phase: DuelPhase
  actionPlayer: 0 | 1
  actionType: DuelActionType
  instanceId?: string
  cardCode?: number
  cardName?: string
  fromLocation?: number
  fromSequence?: number
  toLocation?: number
  toSequence?: number
  targetInstanceId?: string
  targetCardName?: string
  targetPlayer?: 0 | 1
  costInstanceIds?: string[]
  chainIndex?: number
  speaker?: string
  dialogue?: string
  innerThoughts?: string
  description?: string
  sourceQuote?: string
  boardAfter?: LightweightCardSnapshot[]
  lpChange?: { player: 0 | 1; oldLp: number; newLp: number }
  actId?: string
  intent?: string
}

export type EngineDuelStep = Omit<DuelStep, 'id'>

export interface ScreenplayOutcome {
  winner: 0 | 1
  endLp?: { player: 0 | 1; lp: number }
  keyFinisherCode?: number
  keyFinisherName?: string
  note?: string
}

export interface DuelAct {
  id: string
  index: number
  title: string
  goal: string
  keyCardCodes?: number[]
  tone?: string
  fromSnapshot?: LightweightCardSnapshot[]
  steps?: DuelStep[]
}

export interface ScreenplayOutline {
  id: string
  title: string
  tone?: string
  outcome: ScreenplayOutcome
  acts: DuelAct[]
}

export interface ScreenplayActFinish {
  winner: 0 | 1 | null
  reason: string
}

export interface ScreenplayActResult {
  actId: string
  index: number
  steps: EngineDuelStep[]
  endBoard: LightweightCardSnapshot[]
  finish: ScreenplayActFinish | null
}
