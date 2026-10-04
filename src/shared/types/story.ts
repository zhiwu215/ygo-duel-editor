/**
 * 决斗阶段枚举 (ocgcore / YGO 标准 6 大阶段)
 */
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

/**
 * 动作类型定义 (对标 MDPro3 对局动作与回放动作)
 */
export type DuelActionType =
  | 'DRAW' // 抽卡
  | 'NORMAL_SUMMON' // 通常召唤
  | 'SPECIAL_SUMMON' // 特殊召唤
  | 'SET_MONSTER' // 盖放怪兽
  | 'SET_SPELL_TRAP' // 盖放魔陷
  | 'ACTIVATE' // 发动效果 / 发动卡片
  | 'ATTACK' // 攻击宣言
  | 'TO_GRAVE' // 送去墓地 / 破坏
  | 'BANISH' // 除外
  | 'TO_HAND' // 加入手牌 / 弹回
  | 'CHANGE_POS' // 变更表示形式
  | 'DAMAGE' // 生命值变动 / 伤害
  | 'CHAIN' // 连锁响应
  | 'DIALOGUE' // 纯剧情对白 / 演出解说

export const ACTION_TYPE_NAMES: Record<DuelActionType, string> = {
  DRAW: '抽卡',
  NORMAL_SUMMON: '通常召唤',
  SPECIAL_SUMMON: '特殊召唤',
  SET_MONSTER: '盖放怪兽',
  SET_SPELL_TRAP: '盖放魔陷',
  ACTIVATE: '发动',
  ATTACK: '攻击宣言',
  TO_GRAVE: '送去墓地',
  BANISH: '除外',
  TO_HAND: '加入手牌',
  CHANGE_POS: '变更表示形式',
  DAMAGE: '生命值变化',
  CHAIN: '连锁',
  DIALOGUE: '剧情对白'
}

/**
 * 动作对应的强调色系 (用于 UI 标签与流向图渲染)
 */
export const ACTION_TYPE_COLORS: Record<
  DuelActionType,
  { bg: string; text: string; border: string }
> = {
  DRAW: { bg: 'bg-blue-500/15', text: 'text-blue-400', border: 'border-blue-500/30' },
  NORMAL_SUMMON: { bg: 'bg-amber-500/15', text: 'text-amber-400', border: 'border-amber-500/30' },
  SPECIAL_SUMMON: {
    bg: 'bg-emerald-500/15',
    text: 'text-emerald-400',
    border: 'border-emerald-500/30'
  },
  SET_MONSTER: { bg: 'bg-stone-500/15', text: 'text-stone-300', border: 'border-stone-500/30' },
  SET_SPELL_TRAP: { bg: 'bg-stone-500/15', text: 'text-stone-300', border: 'border-stone-500/30' },
  ACTIVATE: { bg: 'bg-cyan-500/15', text: 'text-cyan-400', border: 'border-cyan-500/30' },
  ATTACK: { bg: 'bg-rose-500/15', text: 'text-rose-400', border: 'border-rose-500/30' },
  TO_GRAVE: { bg: 'bg-purple-500/15', text: 'text-purple-400', border: 'border-purple-500/30' },
  BANISH: { bg: 'bg-pink-500/15', text: 'text-pink-400', border: 'border-pink-500/30' },
  TO_HAND: { bg: 'bg-sky-500/15', text: 'text-sky-400', border: 'border-sky-500/30' },
  CHANGE_POS: { bg: 'bg-indigo-500/15', text: 'text-indigo-400', border: 'border-indigo-500/30' },
  DAMAGE: { bg: 'bg-orange-500/15', text: 'text-orange-400', border: 'border-orange-500/30' },
  CHAIN: { bg: 'bg-teal-500/15', text: 'text-teal-400', border: 'border-teal-500/30' },
  DIALOGUE: { bg: 'bg-yellow-500/15', text: 'text-yellow-400', border: 'border-yellow-500/30' }
}

/**
 * 单个决斗动作/剧情步骤数据结构
 */
export interface DuelStep {
  id: string // 步骤全局唯一 ID
  turn: number // 回合数 (1, 2, 3...)
  turnPlayer: 0 | 1 // 当前回合所属玩家 (0: 我方, 1: 对方)
  phase: DuelPhase // 阶段 (DP/SP/M1/BP/M2/EP)
  actionPlayer: 0 | 1 // 执行此动作的玩家 (0: 我方, 1: 对方)
  actionType: DuelActionType // 动作类型
  cardCode?: number // 涉及卡片 (8位卡密)
  cardName?: string // 卡名快照缓存
  fromLocation?: number // 来源区域 (CardLocation: HAND/MZONE/DECK 等)
  fromSequence?: number // 来源格子序号
  toLocation?: number // 目标区域 (CardLocation: MZONE/SZONE/GRAVE 等)
  toSequence?: number // 目标格子序号
  chainIndex?: number // 连锁链条序号 (1: C1, 2: C2...)
  speaker?: string // 剧情台词说话者 (如 "暗游戏" / "海马濑人" / "决斗解说")
  dialogue?: string // 剧情对白 / 台词口播
  innerThoughts?: string // 内心独白 / 心理戏 (可选)
  description?: string // 步骤战术讲解 / 批注
}
