import { CdbCard } from './card'
import { DuelPuzzleState, DuelType } from './duel'
import { DeckData, DeckLibrary } from './deck'
import { DuelPhase, DuelActionType } from './story'

export interface CardSearchParams {
  keyword?: string

  searchDesc?: boolean

  type?: number

  subType?: number

  effectCategoryMask?: number

  cardPool?: CardPoolFilter

  race?: number
  attribute?: number
  level?: number
  scale?: number
  scaleOp?: NumericCompareOp
  atk?: number
  def?: number

  atkOp?: NumericCompareOp

  defOp?: NumericCompareOp

  levelOp?: NumericCompareOp

  code?: number
  sortField?: 'id' | 'atk' | 'def' | 'level' | 'name'
  sortOrder?: 'ASC' | 'DESC'
  limit?: number
  offset?: number
}

export type NumericCompareOp = 'eq' | 'gt' | 'gte' | 'lt' | 'lte' | 'unknown'

export type CardPoolFilter = 'any' | 'ocg' | 'tcg' | 'both'

export interface CardSearchFilterOptions {
  effectCategories: Array<{ mask: number; label: string }>
}

export interface CardSearchResult {
  cards: CdbCard[]
  total: number
}

export interface CdbStatusResult {
  ready: boolean
  path: string | null
  loadedPaths: string[]
}

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

  maxTokens?: number

  supportsStructuredOutput?: boolean

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

  providersSeeded?: boolean
}

export type AgentProviderCategory = 'cn' | 'global' | 'local'

export interface AgentProviderPreset {
  id: string
  name: string
  baseUrl: string
  apiFormat?: AgentApiFormat
  apiKeyUrl?: string

  category?: AgentProviderCategory
}

export interface AgentProviderConnection {
  id: string

  name: string
  baseUrl: string

  kind: 'preset' | 'custom'

  hasApiKey: boolean

  model?: string
}

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

export type AgentTaskMode = 'advisor' | 'outline' | 'rehearsal'

export type AgentContextCompactionReason = 'auto' | 'overflow'

export interface AgentContextCompactionState {
  reason: AgentContextCompactionReason

  running: boolean

  error?: string

  tokensBefore?: number

  tokensAfter?: number
}

export interface AgentCardSwapPlacement {
  side: 0 | 1

  slot: 'HAND' | 'SZONE'

  index: number

  code: number

  cardName?: string

  replacedName?: string
}

export interface AgentCardSwapProposal {
  summary: string

  placements: AgentCardSwapPlacement[]

  warnings: string[]
}

export interface AgentDeckArrangeProposal {
  side: 0 | 1

  duelistName?: string

  codes: number[]
}

export type AgentStreamEvent =
  | { type: 'thinking_delta'; delta: string }
  | { type: 'text_delta'; delta: string }
  | { type: 'tool_call_start'; id: string; toolName: string; params: Record<string, unknown> }
  | { type: 'tool_call_end'; id: string; toolName: string; resultSummary: string }
  | { type: 'proposals_ready'; proposals: AgentStepProposal[] }
  | { type: 'board_setup_ready'; setup: AgentBoardSetupProposal }
  | { type: 'card_swap_ready'; proposal: AgentCardSwapProposal }
  | { type: 'compaction'; compaction: AgentContextCompactionState }
  | { type: 'status'; message: string }
  | { type: 'error'; message: string }
  | {
      type: 'done'
      fullText: string
      proposals: AgentStepProposal[]

      boardSetup?: AgentBoardSetupProposal
    }

export interface AgentNovelSourceRef {
  novelId?: string

  chapterId?: string

  chapterIds?: string[]

  title: string

  wordCount?: number

  content?: string
}

export interface AgentHandoffRequest {
  prompt: string

  novelSource?: AgentNovelSourceRef

  mode?: AgentTaskMode
}

export interface AgentSendMessageParams {
  prompt: string

  boardState?: DuelPuzzleState

  novelSource?: AgentNovelSourceRef

  mode?: AgentTaskMode

  configOverride?: Partial<AgentModelConfig>
}

export interface AgentSendMessageResult {
  success: boolean

  content?: string

  thought?: string

  proposals?: AgentStepProposal[]

  boardSetup?: AgentBoardSetupProposal

  error?: string
}

export interface AgentModelInfo {
  id: string
  ownedBy?: string
  name?: string
  supportsReasoning?: boolean
  supportsVision?: boolean
  contextWindow?: number
}

export interface AgentFetchModelsParams {
  baseUrl: string
  apiKey: string
}

export interface AgentFetchModelsResult {
  success: boolean
  models?: AgentModelInfo[]
  error?: string
}

export interface AppConfig {
  gameDirectory?: string

  cdbPath?: string

  /** 附加卡库路径 (动漫卡等扩展 cdb)，与主库合并搜索 */
  extraCdbPaths?: string[]

  /** 附加卡库手动指定的卡图目录，key 为卡库路径，value 为 pics 文件夹 */
  extraPicsDirs?: Record<string, string>

  /** 已停用的附加卡库路径，仍保留在 extraCdbPaths 中但不参与加载 */
  disabledCdbPaths?: string[]

  theme: 'dark' | 'light'

  favorites?: number[]

  agentConfig?: AgentModelConfig

  recentProjectPaths?: string[]

  projectsDirectory?: string

  deckLoadDrawCount?: 0 | 5

  /** 用户建立的作品分类名清单（允许存在尚未收录任何对局的空分类） */
  projectSeries?: string[]
}

export interface DuelProjectMeta {
  id: string
  filePath: string
  title: string
  duelType: DuelType
  /** 所属作品分类名，未归类时为空字符串 */
  series?: string
  hint?: string
  masterRule: number
  cardCount: number
  stepCount?: number
  updatedAt: number
}

export type SettingsSectionId = 'appearance' | 'paths' | 'model-settings' | 'chat'

export type CardNoteKind = 'chant' | 'note'

export interface CardNote {
  cardCode: number
  kind: CardNoteKind
  label: string
  text: string
  user?: string
  source?: string
  readonly?: boolean
  updatedAt: number
}

export interface DefaultCardNote {
  cardCode: number
  cardName: string
  kind: CardNoteKind
  label: string
  text: string
  user?: string
  source?: string
}

export interface CardNoteLibrary {
  notes: Record<string, CardNote[]>
  updatedAt: number
  version: string
}

export interface CardNoteEntry {
  cardCode: number
  cardName: string
  variantCodes: number[]
  chants: CardNote[]
  notes: CardNote[]
}

export type NovelProgress = 'raw' | 'splitting' | 'split' | 'done'

export interface NovelMeta {
  id: string
  filePath: string
  title: string
  author?: string

  wordCount?: number
  progress: NovelProgress
  chapterCount?: number
  updatedAt: number
}

export interface NovelChapter {
  id: string

  novelId: string

  title: string

  index: number

  wordCount: number

  content?: string
}

export interface IpcApi {
  selectYgoDirectory: () => Promise<CdbSelectResult>
  addExtraCdb: () => Promise<CdbSelectResult & { picsDetected?: boolean }>
  removeExtraCdb: (cdbPath: string) => Promise<{ success: boolean; paths: string[] }>
  setExtraCdbEnabled: (
    cdbPath: string,
    enabled: boolean
  ) => Promise<{ success: boolean; paths: string[] }>
  /** picsDir 传 '@pick' 打开目录选择框，传 null 清除设置 */
  setExtraPicsDir: (
    cdbPath: string,
    picsDir: string | null
  ) => Promise<{ success: boolean; picsDir: string | null; cancelled?: boolean; error?: string }>
  searchCards: (params: CardSearchParams) => Promise<CardSearchResult>
  getCardSearchFilterOptions: () => Promise<CardSearchFilterOptions>
  getCardsByIds: (ids: number[]) => Promise<Record<number, CdbCard>>
  getCdbStatus: () => Promise<CdbStatusResult>

  exportLuaFile: (
    state: DuelPuzzleState,
    targetPath?: string
  ) => Promise<{ success: boolean; filePath?: string; error?: string }>
  importLuaFile: () => Promise<{ success: boolean; state?: DuelPuzzleState; error?: string }>
  exportScreenplayFile: (
    state: DuelPuzzleState
  ) => Promise<{ success: boolean; filePath?: string; error?: string }>

  saveProjectToLibrary: (
    state: DuelPuzzleState
  ) => Promise<{ success: boolean; filePath?: string; error?: string }>

  getNovelList: () => Promise<NovelMeta[]>

  importNovelFile: () => Promise<{
    success: boolean
    canceled?: boolean
    novel?: NovelMeta
    error?: string
  }>

  getNovelChapters: (novelId: string) => Promise<NovelChapter[]>

  getNovelChapterContent: (
    novelId: string,
    chapterId: string
  ) => Promise<{ success: boolean; content?: string; error?: string }>

  updateNovelChapterContent: (
    novelId: string,
    chapterId: string,
    content: string
  ) => Promise<{ success: boolean; error?: string }>

  updateNovelChapterTitle: (
    novelId: string,
    chapterId: string,
    title: string
  ) => Promise<{ success: boolean; error?: string }>

  deleteNovel: (id: string) => Promise<{ success: boolean; error?: string }>

  resplitNovel: (id: string) => Promise<{ success: boolean; novel?: NovelMeta; error?: string }>

  agentHandoff: (request: AgentHandoffRequest) => Promise<{ success: boolean; error?: string }>

  openCardNoteWindow: () => Promise<void>
  listCardNotes: () => Promise<CardNoteEntry[]>
  getCardNotes: (cardCode: number, kind?: CardNoteKind | 'all') => Promise<CardNote[]>
  saveCardNote: (note: CardNote) => Promise<{ success: boolean; error?: string }>
  deleteCardNote: (
    cardCode: number,
    kind: CardNoteKind,
    label: string
  ) => Promise<{ success: boolean; error?: string }>
  exportCardNoteLibrary: () => Promise<{ success: boolean; filePath?: string; error?: string }>
  importCardNoteLibrary: () => Promise<{ success: boolean; imported?: number; error?: string }>
  reorderCardNotes: (
    cardCode: number,
    kind: CardNoteKind,
    labels: string[]
  ) => Promise<{ success: boolean; error?: string }>

  testRunOcgcore: () => Promise<{
    success: boolean
    version?: string
    message?: string
    error?: string
  }>

  saveProjectFile: (state: DuelPuzzleState) => Promise<{ success: boolean; filePath?: string }>
  loadProjectFile: () => Promise<{ success: boolean; state?: DuelPuzzleState }>

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

  createProjectSeries: (name: string) => Promise<{ success: boolean; error?: string }>
  renameProjectSeries: (
    oldName: string,
    newName: string
  ) => Promise<{ success: boolean; error?: string }>
  deleteProjectSeries: (name: string) => Promise<{ success: boolean; error?: string }>
  setProjectSeries: (
    filePath: string,
    series: string | null
  ) => Promise<{ success: boolean; error?: string }>

  getConfig: () => Promise<AppConfig>
  saveConfig: (config: Partial<AppConfig>) => Promise<boolean>

  getCardImagePath: (code: number, small?: boolean) => Promise<string | null>

  openDeckEditor: () => Promise<void>
  getDeckList: () => Promise<DeckData[]>

  getDeckLibrary: () => Promise<DeckLibrary>

  createDeckGroup: (name: string, parent?: string | null) => Promise<boolean>

  renameDeckGroup: (oldName: string, newName: string) => Promise<boolean>

  deleteDeckGroup: (name: string) => Promise<boolean>

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

  getFavorites: () => Promise<number[]>
  toggleFavorite: (code: number) => Promise<{ isFavorite: boolean; favorites: number[] }>
  onFavoritesChanged: (callback: (favorites: number[]) => void) => () => void

  agentSendMessage: (params: AgentSendMessageParams) => Promise<AgentSendMessageResult>
  agentAbort: () => Promise<boolean>

  agentResetSession: () => Promise<boolean>

  agentFetchModels: (params: AgentFetchModelsParams) => Promise<AgentFetchModelsResult>

  agentGetProviderPresets: () => Promise<AgentProviderPreset[]>
  openSettingsWindow: (section?: SettingsSectionId) => Promise<void>
  onSettingsNavigate: (callback: (section: SettingsSectionId) => void) => () => void
  openExternal: (url: string) => Promise<boolean>

  windowMinimize: () => Promise<void>
  windowToggleMaximize: () => Promise<boolean>
  windowClose: () => Promise<void>
  windowIsMaximized: () => Promise<boolean>

  onWindowMaximizedChange: (callback: (maximized: boolean) => void) => () => void

  onConfigUpdated: (callback: () => void) => () => void
  onCdbUpdated: (callback: () => void) => () => void
  onAgentEvent: (callback: (event: AgentStreamEvent) => void) => () => void

  onAgentHandoff: (callback: (request: AgentHandoffRequest) => void) => () => void
}
