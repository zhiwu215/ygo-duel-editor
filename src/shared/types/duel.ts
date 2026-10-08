import { MasterRule } from './rules'
import { CdbCard } from './card'
import { DuelStep, LightweightCardSnapshot } from './story'

/**
 * 提取场上卡片的轻量数据快照 (不包含巨大重复的 CDB 数据，用于步骤回放与初始局面还原)
 */
export function createLightweightSnapshot(cards: FieldCard[]): LightweightCardSnapshot[] {
  return cards.map((c) => ({
    instanceId: c.instanceId,
    code: c.code,
    controller: c.controller,
    owner: c.owner,
    location: c.location,
    sequence: c.sequence,
    position: c.position,
    overlayMaterials: [...(c.overlayMaterials || [])],
    duelistId: c.duelistId,
    customAtk: c.customAtk,
    customDef: c.customDef
  }))
}

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
  duelistId?: string // 归属决斗者 ID (手牌强绑定归属；堆叠区独立牌堆亦可使用)
}

/**
 * 决斗参与者 (决斗者 / 角色)
 */
export interface Duelist {
  id: string // 唯一标识 (如 'duelist_0_0')
  team: 0 | 1 // 所属阵营 (0: 我方, 1: 对方)
  name: string // 角色显示名称 (如 '我方玩家 1', '暗游戏')
  lp: number // 独立生命值 (默认 8000)
  isFirst?: boolean // 是否为全场唯一先攻决斗者 (等价于 turnOrder === 1)
  turnOrder?: number // 决斗行动顺位 (1..N，1 为先攻，2 为第二顺位...)
}

/**
 * 决斗工程类型：
 * - 'full': 整局
 * - 'puzzle': 残局
 * - 'combo': Combo
 */
export type DuelType = 'full' | 'puzzle' | 'combo'

/**
 * 对阵模式枚举
 */
export type MatchMode = '1v1' | 'tag' | 'custom'

/**
 * 对阵人数与阵营规则配置
 */
export interface MatchConfig {
  mode: MatchMode
  team0Count: number // 我方人数 (1~6)
  team1Count: number // 对方人数 (1~6)
  sharedLp?: boolean // 是否同阵营共用生命值 (默认 false)
}

/**
 * 单个决斗场景快照 (用于不同对阵人数切换时独立保留现场)
 *
 * 设计意图：切换对阵人数 = 「把当前这整场决斗存档，再载入另一场」。
 * 因此快照必须涵盖这场决斗的**全部**状态（场面、血量、步骤、开局盘面），
 * 缺任何一项都会导致切回来时信息丢失。
 */
export interface DuelSceneSnapshot {
  duelists: Duelist[]
  cards: FieldCard[]
  turnPlayer: 0 | 1
  firstTurnAttack: boolean
  steps?: DuelStep[]
  matchConfig: MatchConfig
  /** [我方, 对方] 生命值与起手/手牌上限，缺省时按8000 / 0 / 0 处理（兼容旧快照） */
  players?: [PlayerState, PlayerState]
  /** 编排开局初始战场盘面快照 (分步回放复位用)，缺省时视为无开局快照 */
  initialBoardSnapshot?: LightweightCardSnapshot[]
}

/**
 * 单个玩家的状态 (兼容 ocgcore 双阵营)
 */
export interface PlayerState {
  lp: number // 生命值 (默认 8000)
  maxHand: number // 最大手牌数限制 (残局通常为 0)
  startHand: number // 起手抽卡数 (残局通常为 0)
}

/** 对局的文本来源关联：指向素材库中某本文本的若干章节 */
export interface DuelSourceRef {
  novelId: string
  novelTitle: string
  chapterIds: string[]
}

/**
 * 整个决斗局面的完整状态机
 */
export interface DuelPuzzleState {
  /** .ygoduel 工程文件格式版本 */
  version: string
  /** 对局标题 */
  title: string
  /** 对局说明 */
  hint: string
  /** 对局工程类型: 'full' (整局) | 'puzzle' (残局) | 'combo' (Combo) */
  duelType?: DuelType
  /** 所属作品分类（小说/漫画等来源名，如《决斗者王国》），未归类时为空 */
  series?: string
  /** 文本来源关联（从文本提取对局时自动写入；未关联时缺省） */
  sourceRef?: DuelSourceRef
  /** 游戏规则版本 */
  masterRule: MasterRule // 规则版本: 2 (MR1/2), 3 (MR3), 4 (MR4), 5 (MR5)
  /** [我方, 对方]*/
  players: [PlayerState, PlayerState]
  /** 回合玩家 */
  turnPlayer: 0 | 1
  /** 是否允许先攻攻宣 */
  firstTurnAttack: boolean
  /** 场上/手牌/墓地所有卡片集合 */
  cards: FieldCard[]
  /** 步骤与剧情动作序列 (可选，用于剧情编排与分步回放) */
  steps?: DuelStep[]
  initialBoardSnapshot?: LightweightCardSnapshot[] // 编排开局初始战场盘面快照 (用于分步回放复位)
  /** 多人决斗者列表 (每条手牌带对应一个决斗者) */
  duelists?: Duelist[]
  /** 当前对阵人数配置 */
  matchConfig?: MatchConfig
  /** 多场景独立保留字典 (按 scenarioKey 索引) */
  scenarios?: Record<string, DuelSceneSnapshot>
  /**
   * 自定义指示物注册表 (键为自动分配的 ID，值为用户输入的名称)
   * 用于承载动漫卡等没有官方 ocgcore 指示物代码的指示物
   */
  customCounters?: Record<number, string>
}

/**
 * 根据对阵配置生成场景唯一键 (如 '1v1', 'tag', 'custom_1_3')
 */
export function getMatchScenarioKey(config: MatchConfig): string {
  if (config.mode === '1v1') return '1v1'
  if (config.mode === 'tag') return 'tag'
  return `custom_${config.team0Count}_${config.team1Count}`
}

/**
 * 判断当前对阵配置是否允许导出为可运行的 Lua 脚本
 * (ocgcore 物理上仅支持 1v1 与 2v2 双打)
 */
export function isExportableMatch(config?: MatchConfig): boolean {
  if (!config) return true
  if (config.mode === '1v1') return true
  if (config.mode === 'tag') return true
  if (config.mode === 'custom') {
    return (
      (config.team0Count === 1 && config.team1Count === 1) ||
      (config.team0Count === 2 && config.team1Count === 2)
    )
  }
  return false
}

/**
 * 根据双方人数生成默认决斗者列表
 */
export function createDefaultDuelists(team0Count: number, team1Count: number): Duelist[] {
  const duelists: Duelist[] = []
  // 交替轮流顺位规则：我方1 -> 对方1 -> 我方2 -> 对方2...
  let currentOrder = 1
  const maxCount = Math.max(team0Count, team1Count)
  const orderedList: { team: 0 | 1; idx: number }[] = []
  for (let step = 0; step < maxCount; step++) {
    if (step < team0Count) orderedList.push({ team: 0, idx: step })
    if (step < team1Count) orderedList.push({ team: 1, idx: step })
  }

  for (let i = 0; i < team0Count; i++) {
    const orderIdx = orderedList.findIndex((item) => item.team === 0 && item.idx === i)
    const turnOrder = orderIdx !== -1 ? orderIdx + 1 : currentOrder++
    duelists.push({
      id: `duelist_0_${i}`,
      team: 0,
      name: team0Count === 1 ? '我方' : `我方 ${i + 1}`,
      lp: 8000,
      isFirst: turnOrder === 1,
      turnOrder
    })
  }
  for (let j = 0; j < team1Count; j++) {
    const orderIdx = orderedList.findIndex((item) => item.team === 1 && item.idx === j)
    const turnOrder = orderIdx !== -1 ? orderIdx + 1 : currentOrder++
    duelists.push({
      id: `duelist_1_${j}`,
      team: 1,
      name: team1Count === 1 ? '对方' : `对方 ${j + 1}`,
      lp: 8000,
      isFirst: turnOrder === 1,
      turnOrder
    })
  }
  return duelists
}

/**
 * 创建空白初始局面
 */
export function createInitialDuelState(
  masterRule: MasterRule = 5,
  duelType: DuelType = 'full'
): DuelPuzzleState {
  const matchConfig: MatchConfig = {
    mode: '1v1',
    team0Count: 1,
    team1Count: 1,
    sharedLp: false
  }

  const duelists = createDefaultDuelists(1, 1)

  return {
    version: '1.2.0',
    title: '未命名对局',
    hint: '',
    duelType,
    masterRule,
    players: [
      { lp: 8000, maxHand: 0, startHand: 0 },
      { lp: 8000, maxHand: 0, startHand: 0 }
    ],
    duelists,
    matchConfig,
    scenarios: {},
    turnPlayer: 0,
    firstTurnAttack: true,
    cards: [],
    steps: []
  }
}

/**
 * 确保旧工程数据平滑兼容迁移为新结构
 */
export function normalizeDuelState(state: DuelPuzzleState): DuelPuzzleState {
  const matchConfig: MatchConfig = state.matchConfig || {
    mode: '1v1',
    team0Count: 1,
    team1Count: 1,
    sharedLp: false
  }

  let duelists = state.duelists
  if (!duelists || duelists.length === 0) {
    duelists = createDefaultDuelists(matchConfig.team0Count, matchConfig.team1Count)
    // 继承已有 lp
    if (state.players?.[0])
      duelists.filter((d) => d.team === 0).forEach((d) => (d.lp = state.players[0].lp))
    if (state.players?.[1])
      duelists.filter((d) => d.team === 1).forEach((d) => (d.lp = state.players[1].lp))
  }

  // 保证全场顺位完整，并确保有且仅有一个先攻者 (turnOrder === 1)
  const hasOrders = duelists.some((d) => typeof d.turnOrder === 'number')
  if (!hasOrders) {
    let nextOrder = 2
    duelists.forEach((d) => {
      if (d.isFirst) {
        d.turnOrder = 1
      } else {
        d.turnOrder = nextOrder++
      }
    })
  }

  const firstDuelist =
    duelists.find((d) => d.turnOrder === 1) || duelists.find((d) => d.isFirst) || duelists[0]
  if (firstDuelist) {
    duelists.forEach((d) => {
      d.isFirst = d.id === firstDuelist.id
      if (d.isFirst) d.turnOrder = 1
    })
  }

  // 确保所有手牌卡片拥有正确的 duelistId
  const team0Duelists = duelists.filter((d) => d.team === 0)
  const team1Duelists = duelists.filter((d) => d.team === 1)

  const updatedCards = state.cards.map((card) => {
    if (card.duelistId) return card
    // 默认分配给本队首位决斗者
    const defaultDuelist = card.controller === 0 ? team0Duelists[0] : team1Duelists[0]
    return {
      ...card,
      duelistId: defaultDuelist?.id || (card.controller === 0 ? 'duelist_0_0' : 'duelist_1_0')
    }
  })

  return {
    ...state,
    version: state.version || '1.2.0',
    duelType: state.duelType || 'full',
    title: state.title || '未命名对局',
    hint: state.hint || '',
    matchConfig,
    duelists,
    scenarios: state.scenarios || {},
    cards: updatedCards
  }
}
