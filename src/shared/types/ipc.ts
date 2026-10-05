import { CdbCard } from './card'
import { DuelPuzzleState, DuelType } from './duel'
import { DeckData, DeckLibrary } from './deck'
import { DuelPhase, DuelActionType } from './story'

/**
 * 卡片检索查询参数
 */
export interface CardSearchParams {
  keyword?: string // 卡名 / 效果描述 / 8位卡密
  /**
   * 是否在效果描述中检索关键词 (默认 true)
   */
  searchDesc?: boolean
  /**
   * 主种类掩码 (Monster / Spell / Trap)
   */
  type?: number // 主种类掩码 (Monster / Spell / Trap)
  /**
   * 细分种类完整掩码，包含主种类位 (如 MONSTER | FUSION)
   */
  subType?: number
  /** 效果分类位掩码；选中多个分类时按任一分类命中 */
  effectCategoryMask?: number
  /** 卡池赛区：OCG、TCG、两者均可，或不限制 */
  cardPool?: CardPoolFilter
  /**
   * 种族掩码
   */
  race?: number // 种族掩码
  attribute?: number // 属性掩码
  level?: number // 星级 / Rank / Link
  scale?: number // 灵摆刻度（左侧刻度）
  scaleOp?: NumericCompareOp // 灵摆刻度比较符
  atk?: number // 攻击力
  def?: number // 守备力
  /**
   * 攻击力比较符 (参考 YGOPro 的 filter_atktype)：为空/'eq' 视为 '='
   */
  atkOp?: NumericCompareOp
  /**
   * 守备力比较符
   */
  defOp?: NumericCompareOp
  /**
   * 星级比较符 (参考 YGOPro 的 filter_lvtype)
   */
  levelOp?: NumericCompareOp
  /**
   * 8位卡密精准匹配
   */
  code?: number // 8位卡密精准匹配
  sortField?: 'id' | 'atk' | 'def' | 'level' | 'name' // 排序字段
  sortOrder?: 'ASC' | 'DESC' // 排序方向
  limit?: number // 每次返回条数 (默认 50)
  offset?: number // 分页偏移量
}

/**
 * 数值维度筛选的比较符 (对齐 YGOPro 的 filter_*type 语义)
 */
export type NumericCompareOp = 'eq' | 'gt' | 'gte' | 'lt' | 'lte' | 'unknown'

export type CardPoolFilter = 'any' | 'ocg' | 'tcg' | 'both'

export interface CardSearchFilterOptions {
  effectCategories: Array<{ mask: number; label: string }>
}

/**
 * 卡片检索返回结果
 */
export interface CardSearchResult {
  cards: CdbCard[]
  total: number
}

/**
 * cards.cdb 连接状态 (用于引导未加载数据库的新用户)
 */
export interface CdbStatusResult {
  ready: boolean
  path: string | null
}

/**
 * 选择 cards.cdb 文件的结果 (失败时携带原因，供 UI 提示)
 */
export interface CdbSelectResult {
  success: boolean
  path?: string
  error?: string
}

export type AgentApiFormat = 'openai-chat-completions' | 'anthropic-messages' | 'openai-responses'

export interface AgentProviderModelConfig {
  id: string
  name?: string
  supportsReasoning?: boolean
  supportsVision?: boolean
  contextWindow?: number
  /** 该模型的单次回复上限；留空则回落到 AgentModelConfig.maxTokens */
  maxTokens?: number
  /** 结构化输出 / 严格 JSON Schema 工具参数（pi compat.supportsStrictMode） */
  supportsStructuredOutput?: boolean
  /** 对话中途插入 system 消息（pi compat.supportsMidConvoSystemMessages） */
  supportsMidConversationSystem?: boolean
  enabled: boolean
  custom?: boolean
}

export interface AgentProviderConfig {
  id: string
  name: string
  baseUrl: string
  apiFormat?: AgentApiFormat
  apiKey: string
  enabled: boolean
  presetId?: string
  models: AgentProviderModelConfig[]
}

export interface AgentModelConfig {
  providers?: AgentProviderConfig[]
  provider?: string
  baseUrl: string
  apiKey: string
  model: string
  apiFormat?: AgentApiFormat
  systemPrompt?: string
  enableReasoning?: boolean
  contextWindow?: number
  maxTokens?: number
  /**
   * 是否已经预置过默认的常用供应商（DeepSeek / Kimi / 通义千问）。
   * 一次性迁移标记：置位后用户手动删掉的供应商不会再被自动补回来。
   */
  providersSeeded?: boolean
}

/**
 * 内置供应商预设的分组，用于「添加供应商」面板归类展示
 * cn = 国内厂商 / global = 国际厂商 / local = 本地部署
 */
export type AgentProviderCategory = 'cn' | 'global' | 'local'

export interface AgentProviderPreset {
  id: string
  name: string
  baseUrl: string
  apiFormat?: AgentApiFormat
  apiKeyUrl?: string
  /** 面板分组，缺省时归入「其他」 */
  category?: AgentProviderCategory
}

/**
 * AI 提供商连接信息（设置页「已连接」区展示）
 */
export interface AgentProviderConnection {
  /** 提供商 ID（预设 id 或 'custom'） */
  id: string
  /** 显示名称 */
  name: string
  baseUrl: string
  /** 连接来源：预设预设 / 自定义 */
  kind: 'preset' | 'custom'
  /** 是否已配置 API Key（已连接的判定条件） */
  hasApiKey: boolean
  /** 当前选用的模型 */
  model?: string
}

/**
 * AI 结构化步骤提案 (与 DuelStep 对齐，可一键导入对局)
 */
export interface AgentStepProposal {
  /** 回合数 (从 1 开始计数) */
  turn: number
  /** 决斗阶段 (DP / SP / M1 / BP / M2 / EP) */
  phase: DuelPhase
  /** 行动者控制者：0 = 我方，1 = 对方 */
  actionPlayer: 0 | 1
  /** 决斗动作类型 */
  actionType: DuelActionType
  /** 涉及卡片的卡密 */
  cardCode?: number
  /** 涉及卡片的中文名称 */
  cardName?: string
  /** 说话者角色名称 */
  speaker?: string
  /** 角色台词或招式宣言 */
  dialogue?: string
  /** 角色内心独白与战术考量 */
  innerThoughts?: string
  /** 战术动作具体描述与效果逻辑说明 */
  description?: string
  /** 连锁层级序号 (如 C1 / C2) */
  chainIndex?: number
  /** 动作导致的生命值数值变动 */
  lpChange?: {
    /** 发生生命值变动的玩家：0 = 我方，1 = 对方 */
    player: 0 | 1
    /** 变更前生命值 */
    oldLp: number
    /** 变更后生命值 */
    newLp: number
  }
}

/**
 * AI 场面布局提案中单张牌的落位描述
 *
 * 区域与表示形式一律用**字符串枚举**而非 ocgcore 数字常量：
 * 模型填 `MZONE` / `FACEUP_DEFENSE` 的正确率远高于让它自己算 0x04 / 0x4，
 * 主进程收到后再映射成 CardLocation / CardPosition。
 */
export interface AgentBoardCardPlacement {
  /** 8 位卡密；`isUnknown` 为 true 时固定为 0 */
  code: number
  /** 卡名快照，仅用于预览展示与人工核对 */
  cardName?: string
  /**
   * 是否是「知道有这张卡、但不知道是哪张」的盖卡。
   * 用户说「魔陷区有一张盖卡」但没给卡名时置 true：`code` 记 0 不查卡库，
   * 渲染层显示为无卡名的卡背。
   */
  isUnknown?: boolean
  /** 归属阵营：0 = 我方，1 = 对方 */
  side: 0 | 1
  /** 目标区域 */
  location: AgentBoardZone
  /** 格子序号：怪兽区/魔陷区 0~4；手牌等堆叠区传 0 由主进程按顺序追加 */
  sequence: number
  /** 表示形式；缺省时按区域惯例（魔陷区与手牌默认盖放，怪兽区默认表攻） */
  position?: AgentBoardCardFacing
  /**
   * 目标决斗者名（如「韩诺」）；手牌与堆叠区必填，否则多人模式下会挂到
   * 当前查看的决斗者名下。传空时按 side 落到该阵营首位。
   */
  duelistName?: string
  /**
   * 覆盖显示攻击力。用于「特拉戈迪亚攻击力上升手牌数量 X600 → 3600」
   * 这类动态攻防：卡库里该卡atk 是 -1/?，不覆盖就显示不出真实数值。
   */
  customAtk?: number
  /** 覆盖显示守备力 */
  customDef?: number
}

/** AI 可指定的落位区域（不含超量素材与场地魔法专属区，那两处由 UI 操作更合适） */
export type AgentBoardZone = 'MZONE' | 'SZONE' | 'HAND' | 'GRAVE' | 'DECK' | 'EXTRA' | 'REMOVED'

/** AI 可指定的表示形式 */
export type AgentBoardCardFacing = 'FACEUP_ATTACK' | 'FACEUP_DEFENSE' | 'FACEDOWN' | 'FACEUP'

/** 单方生命值设定 */
export interface AgentBoardLpTarget {
  /** 阵营：0 = 我方，1 = 对方 */
  side: 0 | 1
  /** 目标生命值 */
  lp: number
  /** 多人模式下指定决斗者名；缺省时按 side 落到该阵营首位（或共享 LP 时全阵营） */
  duelistName?: string
}

/**
 * AI 复盘出的完整场面布局（待用户确认后才写入决斗场）
 */
export interface AgentBoardSetupProposal {
  /** 局面摘要，说明这个布局是什么场合 */
  summary: string
  /**
   * 是否先清空现有盘面再落位。
   * 「复盘一个全新场面」必须为 true，否则会在原卡片上叠加摆放。
   */
  clearExisting: boolean
  /** 生命值设定；不需要改动的一方可以不传 */
  lp: AgentBoardLpTarget[]
  /** 卡片落位列表 */
  cards: AgentBoardCardPlacement[]
  /**
   * 布局合法性问题（卡密查不到、格子序号越界等）。
   * 空数组代表全部通过；非空时预览卡片会高亮提示，但不阻止用户应用。
   */
  warnings: string[]
}

/**
 * AI 流式推送事件
 */
export type AgentStreamEvent =
  /** 深度思考推理链增量字符（如 DeepSeek-R1 的思考过程） */
  | { type: 'thinking_delta'; delta: string }
  /** 回答正文的打字机增量字符 */
  | { type: 'text_delta'; delta: string }
  /** 工具调用开始（如检索卡库、读取盘面、规则引擎校验） */
  | { type: 'tool_call_start'; id: string; toolName: string; params: Record<string, unknown> }
  /** 工具调用结束并返回执行结果摘要 */
  | { type: 'tool_call_end'; id: string; toolName: string; resultSummary: string }
  /** AI 构思好的决斗推演步骤与角色台词提案已就绪 */
  | { type: 'proposals_ready'; proposals: AgentStepProposal[] }
  /** AI 复盘出的场面布局已就绪，等待用户确认后写入决斗场 */
  | { type: 'board_setup_ready'; setup: AgentBoardSetupProposal }
  /** 过程状态提示（自动重试、超时中断、会话重置等非正文信息） */
  | { type: 'status'; message: string }
  /** 生成过程中发生异常或被用户手动中断 */
  | { type: 'error'; message: string }
  /** 全流程生成结束，返回完整文本与最终步骤提案 */
  | {
      type: 'done'
      fullText: string
      proposals: AgentStepProposal[]
      /** 本轮提交的场面布局提案（若有） */
      boardSetup?: AgentBoardSetupProposal
    }

/**
 * 发送给 AI 的消息参数
 */
export interface AgentSendMessageParams {
  /** 提示词 */
  prompt: string
  /** 当前决斗场面的完整快照，传入后 AI 可感知双方场上卡片、手牌与生命值 */
  boardState?: DuelPuzzleState
  /** 临时覆盖的大模型调用配置 */
  configOverride?: Partial<AgentModelConfig>
}

/**
 * AI 顾问消息响应结果
 */
export interface AgentSendMessageResult {
  /** 调用是否成功 */
  success: boolean
  /** AI 生成的最终正文回复内容 */
  content?: string
  /** AI 模型的深度思考与推理过程（若启用） */
  thought?: string
  /** AI 生成的结构化决斗推演步骤列表，可一键导入对局 */
  proposals?: AgentStepProposal[]
  /** AI 复盘出的场面布局提案，待用户在预览卡中确认 */
  boardSetup?: AgentBoardSetupProposal
  /** 失败时的错误信息说明 */
  error?: string
}

/**
 * 从厂商 /v1/models 接口实时拉取的模型信息
 *
 * 接口只保证返回 id，其余字段为可选补充；name 缺省时 UI 回退到 id。
 */
export interface AgentModelInfo {
  id: string
  ownedBy?: string
  name?: string
  supportsReasoning?: boolean
  supportsVision?: boolean
  contextWindow?: number
}

/**
 * 透传到厂商的模型列表请求参数
 */
export interface AgentFetchModelsParams {
  baseUrl: string
  apiKey: string
}

/**
 * 模型列表拉取结果
 */
export interface AgentFetchModelsResult {
  success: boolean
  models?: AgentModelInfo[]
  error?: string
}

/**
 * 软件全局配置
 */
export interface AppConfig {
  /** ygopro等的安装根目录 */
  gameDirectory?: string
  /** 当前使用的 cards.cdb 完整路径 */
  cdbPath?: string
  /** 主题 */
  theme: 'dark' | 'light'
  /** 收藏的卡密列表 */
  favorites?: number[]
  /** AI 决斗编排顾问模型配置 */
  agentConfig?: AgentModelConfig
  /** 最近打开或保存的工程文件路径列表 */
  recentProjectPaths?: string[]
  /** 决斗档案默认保存与归档目录 */
  projectsDirectory?: string
  /** 「切换卡组」弹窗里「载入手牌」的选择 (0: 无, 5: 抽 5)，记忆上次使用 */
  deckLoadDrawCount?: 0 | 5
}

/**
 * 决斗档案元数据 (用于决斗档案面板展示与快速载入)
 */
export interface DuelProjectMeta {
  id: string // 唯一标识
  filePath: string // 文件绝对路径
  title: string // 工程标题
  duelType: DuelType // 'full' | 'puzzle' | 'combo'
  hint?: string // 战术要点 / 剧情注释
  masterRule: number // 规则版本 (2~5)
  cardCount: number // 卡片数量 (场上/手牌等)
  stepCount?: number // 步骤数量
  updatedAt: number // 最后修改时间戳 (ms)
}

export type SettingsSectionId = 'appearance' | 'paths' | 'model-settings' | 'chat'

/**
 * IPC 通道名称与接口契约
 */
export interface IpcApi {
  // CDB 数据库操作
  selectYgoDirectory: () => Promise<CdbSelectResult>
  searchCards: (params: CardSearchParams) => Promise<CardSearchResult>
  getCardSearchFilterOptions: () => Promise<CardSearchFilterOptions>
  getCardsByIds: (ids: number[]) => Promise<Record<number, CdbCard>>
  getCdbStatus: () => Promise<CdbStatusResult>

  // 脚本导出与导入
  exportLuaFile: (
    state: DuelPuzzleState,
    targetPath?: string
  ) => Promise<{ success: boolean; filePath?: string; error?: string }>
  importLuaFile: () => Promise<{ success: boolean; state?: DuelPuzzleState; error?: string }>
  exportScreenplayFile: (
    state: DuelPuzzleState
  ) => Promise<{ success: boolean; filePath?: string; error?: string }>

  // 规则引擎校验与模拟
  testRunOcgcore: () => Promise<{
    success: boolean
    version?: string
    message?: string
    error?: string
  }>

  // 工程保存与打开
  saveProjectFile: (state: DuelPuzzleState) => Promise<{ success: boolean; filePath?: string }>
  loadProjectFile: () => Promise<{ success: boolean; state?: DuelPuzzleState }>

  // 决斗档案
  getProjectList: () => Promise<DuelProjectMeta[]>
  loadProjectByPath: (
    filePath: string
  ) => Promise<{ success: boolean; state?: DuelPuzzleState; error?: string }>
  deleteProjectFile: (filePath: string) => Promise<{ success: boolean; error?: string }>
  duplicateProjectFile: (
    filePath: string
  ) => Promise<{ success: boolean; newPath?: string; error?: string }>
  revealFileInFolder: (filePath: string) => Promise<void>
  getProjectsDirectory: () => Promise<string>
  openProjectsDirectory: () => Promise<void>
  selectProjectsDirectory: () => Promise<string | null>

  // 用户设置
  getConfig: () => Promise<AppConfig>
  saveConfig: (config: Partial<AppConfig>) => Promise<boolean>

  // 本地卡图路径查询
  getCardImagePath: (code: number, small?: boolean) => Promise<string | null>

  // 卡组编辑器独立窗口与卡组文件
  openDeckEditor: () => Promise<void>
  getDeckList: () => Promise<DeckData[]>
  /** 读取完整卡组库：分组为独立实体，允许存在没有卡组的空分组 */
  getDeckLibrary: () => Promise<DeckLibrary>
  /** 新建分组；同名已存在时返回 false */
  createDeckGroup: (name: string) => Promise<boolean>
  /** 重命名分组并同步该组下所有卡组；同名冲突时返回 false */
  renameDeckGroup: (oldName: string, newName: string) => Promise<boolean>
  /** 删除分组，组内卡组退回未分组（不删除卡组本身） */
  deleteDeckGroup: (name: string) => Promise<boolean>
  /** 把卡组移动到指定分组，空串表示移回未分组 */
  assignDeckGroup: (deckId: string, group: string) => Promise<boolean>
  saveDeckToLibrary: (deck: DeckData) => Promise<{ success: boolean; deck: DeckData }>
  deleteDeckFromLibrary: (id: string) => Promise<boolean>
  duplicateDeckInLibrary: (id: string) => Promise<DeckData | null>
  saveDeckFile: (deck: DeckData) => Promise<{ success: boolean; filePath?: string; error?: string }>
  loadDeckFile: () => Promise<{
    success: boolean
    deck?: DeckData
    filePath?: string
    error?: string
  }>
  applyDeckToDuel: (params: {
    player: 0 | 1
    deck: DeckData
    drawCount?: number
  }) => Promise<boolean>
  onApplyDeckToDuel: (
    callback: (params: { player: 0 | 1; deck: DeckData; drawCount?: number }) => void
  ) => () => void

  // 卡片收藏
  getFavorites: () => Promise<number[]>
  toggleFavorite: (code: number) => Promise<{ isFavorite: boolean; favorites: number[] }>
  onFavoritesChanged: (callback: (favorites: number[]) => void) => () => void

  // AI 决斗编排与剧本顾问
  agentSendMessage: (params: AgentSendMessageParams) => Promise<AgentSendMessageResult>
  agentAbort: () => Promise<boolean>
  /** 丢弃当前 AI 会话并新建（切换模型配置或用户主动重开对话时调用） */
  agentResetSession: () => Promise<boolean>
  /** 从厂商 /v1/models 拉取可用模型列表（主进程代理请求，避免 CORS） */
  agentFetchModels: (params: AgentFetchModelsParams) => Promise<AgentFetchModelsResult>
  /** AI 提供商预设列表（静态，设置页「常用提供商」区） */
  agentGetProviderPresets: () => Promise<AgentProviderPreset[]>
  openSettingsWindow: (section?: SettingsSectionId) => Promise<void>
  onSettingsNavigate: (callback: (section: SettingsSectionId) => void) => () => void
  openExternal: (url: string) => Promise<boolean>
  /** 无边框窗口 (frame: false) 的自绘窗口控件，作用于发起调用的那个窗口 */
  windowMinimize: () => Promise<void>
  windowToggleMaximize: () => Promise<boolean>
  windowClose: () => Promise<void>
  windowIsMaximized: () => Promise<boolean>
  /** 订阅当前窗口最大化状态变化 (双击标题栏 / 系统快捷键都会触发) */
  onWindowMaximizedChange: (callback: (maximized: boolean) => void) => () => void
  /** 订阅全局配置变更广播 (主题 / 路径 / AI 配置跨窗口同步)，返回退订函数 */
  onConfigUpdated: (callback: () => void) => () => void
  onAgentEvent: (callback: (event: AgentStreamEvent) => void) => () => void
}
