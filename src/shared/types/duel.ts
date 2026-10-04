import { MasterRule } from './rules'
import { CdbCard } from './card'
import { DuelStep } from './story'

/**
 * 战场上单张卡片的完整实例化状态
 */
export interface FieldCard {
  instanceId: string // 唯一标识 (UUID 或 nanoid)
  code: number // 卡密 / 密码 (8位数字)
  card?: CdbCard // 关联的 CDB 卡片数据 (名称、攻防、卡图)
  controller: 0 | 1 // 0: 我方, 1: 对方
  owner: 0 | 1 // 卡片最初归属者 (通常同 controller)
  location: number // 所在区域 (CardLocation: MZONE, SZONE, HAND 等)
  sequence: number // 格子序号 (0~4: 主区域, 5~6: EMZ, 独立灵摆区等)
  position: number // 表示形式 (CardPosition: 攻击/守备/盖伏)
  overlayMaterials: number[] // 超量素材列表 (存储卡密数组)
  counters?: Record<number, number> // 指示物 (键为指示物类型代码，值为数量)
  customAtk?: number // 自定义攻击力修正 (可选)
  customDef?: number // 自定义守备力修正 (可选)
}

/**
 * 单个玩家的状态
 */
export interface PlayerState {
  lp: number // 生命值 (默认 8000)
  maxHand: number // 最大手牌数限制 (残局通常为 0)
  startHand: number // 起手抽卡数 (残局通常为 0)
}

/**
 * 整个决斗局面的完整状态机
 */
export interface DuelPuzzleState {
  version: string // 项目数据结构版本
  title: string // 对局标题
  hint: string // 对局说明 / 提示描述
  /** 游戏规则版本 */
  masterRule: MasterRule // 规则版本: 2 (MR1/2), 3 (MR3), 4 (MR4), 5 (MR5)
  players: [PlayerState, PlayerState] // [我方, 对方]
  turnPlayer: 0 | 1 // 回合玩家 (0: 我方, 1: 对方)
  firstTurnAttack: boolean // 是否允许先攻攻宣
  cards: FieldCard[] // 场上/手牌/墓地所有卡片集合
  steps?: DuelStep[] // 步骤与剧情动作序列 (可选，用于剧情编排与分步回放)
}

/**
 * 创建空白初始局面
 */
export function createInitialDuelState(masterRule: MasterRule = 5): DuelPuzzleState {
  return {
    version: '1.0.0',
    title: '未命名对局',
    hint: '',
    masterRule,
    players: [
      { lp: 8000, maxHand: 0, startHand: 0 },
      { lp: 8000, maxHand: 0, startHand: 0 }
    ],
    turnPlayer: 0,
    firstTurnAttack: true,
    cards: [],
    steps: []
  }
}
