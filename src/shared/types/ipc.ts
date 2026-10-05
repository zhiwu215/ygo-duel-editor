import { CdbCard } from './card'
import { DuelPuzzleState, DuelType } from './duel'
import { DeckData } from './deck'
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
   * 细分种类掩码 (Fusion / Synchro / Quickplay 等)
   */
  subType?: number // 细分种类掩码 (Fusion / Synchro / Quickplay 等)
  /**
   * 种族掩码
   */
  race?: number // 种族掩码
  attribute?: number // 属性掩码
  level?: number // 星级 / Rank / Link
  atk?: number // 攻击力
  def?: number // 守备力
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
}

export interface AgentProviderPreset {
  id: string
  name: string
  baseUrl: string
  apiFormat?: AgentApiFormat
  apiKeyUrl?: string
  description?: string
  badge?: string
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
  /** 过程状态提示（自动重试、超时中断、会话重置等非正文信息） */
  | { type: 'status'; message: string }
  /** 生成过程中发生异常或被用户手动中断 */
  | { type: 'error'; message: string }
  /** 全流程生成结束，返回完整文本与最终步骤提案 */
  | { type: 'done'; fullText: string; proposals: AgentStepProposal[] }

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
  /** 订阅全局配置变更广播 (主题 / 路径 / AI 配置跨窗口同步)，返回退订函数 */
  onConfigUpdated: (callback: () => void) => () => void
  onAgentEvent: (callback: (event: AgentStreamEvent) => void) => () => void
}
