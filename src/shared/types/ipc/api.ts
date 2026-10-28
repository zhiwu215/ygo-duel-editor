import { CdbCard } from '../card'
import { CustomCard, CustomCardInput } from '../customCard'
import type {
  CustomCardScriptGenerateEvent,
  CustomCardScriptGenerateResult,
  CustomScriptTestReport
} from '../customCardScript'
import { DuelPuzzleState } from '../duel'
import type { DuelDocument } from '../duelDocument'
import {
  DuelDocumentListResult,
  DuelDocumentReadResult,
  DuelDocumentWriteResult
} from '../duelDocument'
import { DeckData, DeckLibrary } from '../deck'
import type { FavoritesState } from '../favorites'
import { EngineBoardState, EngineDuelInitParams, EngineTimelineNode } from '../duelEngine'
import {
  Answer,
  EngineCardEditResult,
  EngineCardRef,
  EngineInjectResult,
  EngineProvenance,
  EngineRequest,
  InjectCommand,
  TimingPolicy
} from '../../engine/protocol'
import type { EngineSubmitAnswerResult } from '../../engine/protocol'
import type { EngineSessionDoc } from '../../engine/sessionDoc'
import type {
  EngineImportReplayResult,
  EngineSessionDocResult,
  EngineSessionRestoreResult,
  EngineSupportInfo
} from './engine'
import {
  CardImageDirResult,
  CardSearchFilterOptions,
  CardSearchParams,
  CardSearchResult,
  CdbSelectResult,
  CdbStatusResult,
  GameLanguageOption
} from './cardSearch'
import {
  CustomCardDeleteResult,
  CustomCardOpenDirResult,
  CustomCardPickImageResult,
  CustomCardSaveResult,
  CustomCardScriptInfo,
  CustomCardScriptPickResult,
  CustomCardScriptResult,
  CustomCardSyncResult,
  CustomCardSyncTarget,
  CustomSetcodeNamesResult
} from './customCard'
import {
  AgentFetchModelsParams,
  AgentFetchModelsResult,
  AgentProviderPreset,
  AgentSendMessageParams,
  AgentSendMessageResult,
  AgentStreamEvent
} from './agent'
import {
  AppConfig,
  DataDirectoryResult,
  DuelTestSettings,
  GamePathStatus,
  SettingsSectionId
} from './appConfig'
import type { UpdateState } from '../update'
import {
  EngineExportReplayParams,
  EngineExportReplayResult,
  EngineOpenReplayResult,
  ReplayDeleteResult,
  ReplayFileListResult,
  TestInGameResult
} from './engine'
import { CardNote, CardNoteEntry, CardNoteKind } from './note'
import { TextChapter, TextMeta } from './text'
import {
  TextLibraryDeleteResult,
  TextLibraryExportResult,
  TextLibraryListResult,
  TextLibraryReadResult,
  TextLibrarySaveRequest,
  TextLibraryWriteResult
} from '../textLibrary'

export interface IpcApi {
  getAppVersion: () => Promise<string>

  selectYgoDirectory: () => Promise<CdbSelectResult>
  selectCardImageDirectory: () => Promise<CardImageDirResult>
  setCardImageDirectory: (dir: string | null) => Promise<boolean>
  getGameLanguageOptions: () => Promise<GameLanguageOption[]>
  setGameLanguage: (languageId: string) => Promise<{ success: boolean; error?: string }>
  addExtraCdb: () => Promise<CdbSelectResult & { paths?: string[]; picsDetected?: boolean }>
  removeExtraCdb: (cdbPath: string) => Promise<{ success: boolean; paths: string[] }>
  setExtraCdbEnabled: (
    cdbPath: string,
    enabled: boolean
  ) => Promise<{ success: boolean; paths: string[] }>
  searchCards: (params: CardSearchParams) => Promise<CardSearchResult>
  getCardSearchFilterOptions: () => Promise<CardSearchFilterOptions>
  setCardBanlist: (name: string | null) => Promise<CardSearchFilterOptions>
  getCardsByIds: (ids: number[]) => Promise<Record<number, CdbCard>>
  getCdbStatus: () => Promise<CdbStatusResult>

  listCustomCards: () => Promise<CustomCard[]>
  saveCustomCard: (input: CustomCardInput) => Promise<CustomCardSaveResult>
  allocateCustomCardId: () => Promise<number>
  deleteCustomCard: (id: number) => Promise<CustomCardDeleteResult>
  pickCustomCardImage: () => Promise<CustomCardPickImageResult>
  applyCustomCardImage: (id: number) => Promise<CustomCardPickImageResult>
  getCustomCardScript: (code: number) => Promise<CustomCardScriptInfo>
  readCustomCardScriptContent: (code: number) => Promise<string | null>
  pickCustomCardScriptFile: () => Promise<CustomCardScriptPickResult>
  importCustomCardScript: (code: number, filePath: string) => Promise<CustomCardScriptResult>
  deleteCustomCardScript: (code: number) => Promise<CustomCardScriptResult>
  testCustomCardScript: (input: {
    card: CustomCard
    script: string
    plan?: unknown
  }) => Promise<CustomScriptTestReport>
  generateCustomCardScript: (input: {
    card: CustomCard
    existingScript?: string
  }) => Promise<CustomCardScriptGenerateResult>
  abortCustomCardScriptGeneration: () => Promise<boolean>
  onCustomCardScriptGenerateEvent: (
    callback: (event: CustomCardScriptGenerateEvent) => void
  ) => () => void
  saveCustomCardScriptContent: (code: number, content: string) => Promise<CustomCardScriptResult>
  openCustomCardScriptDir: () => Promise<void>
  openCustomCardSyncDir: (target: CustomCardSyncTarget) => Promise<CustomCardOpenDirResult>
  getCustomSetcodeNames: () => Promise<Record<string, string>>
  renameCustomSetcode: (codeHex: string, name: string) => Promise<CustomSetcodeNamesResult>
  syncCustomCardsToGame: () => Promise<CustomCardSyncResult>
  cleanCustomCardsFromGame: () => Promise<CustomCardSyncResult>
  onCustomCardsUpdated: (callback: () => void) => () => void

  exportLuaFile: (
    state: DuelPuzzleState,
    targetPath?: string
  ) => Promise<{ success: boolean; filePath?: string; error?: string }>
  testInYgo: (
    state: DuelPuzzleState,
    force?: boolean,
    test?: DuelTestSettings
  ) => Promise<TestInGameResult>
  importLuaFile: () => Promise<{ success: boolean; state?: DuelPuzzleState; error?: string }>
  exportScreenplayFile: (
    state: DuelPuzzleState
  ) => Promise<{ success: boolean; filePath?: string; error?: string }>

  getTextList: () => Promise<TextMeta[]>

  importTextFile: () => Promise<{
    success: boolean
    canceled?: boolean
    text?: TextMeta
    error?: string
  }>

  getTextChapters: (textId: string) => Promise<TextChapter[]>

  getTextChapterContent: (
    textId: string,
    chapterId: string
  ) => Promise<{ success: boolean; content?: string; error?: string }>

  updateTextChapterContent: (
    textId: string,
    chapterId: string,
    content: string
  ) => Promise<{ success: boolean; error?: string }>

  updateTextChapterTitle: (
    textId: string,
    chapterId: string,
    title: string
  ) => Promise<{ success: boolean; error?: string }>

  deleteText: (id: string) => Promise<{ success: boolean; error?: string }>

  resplitText: (id: string) => Promise<{ success: boolean; text?: TextMeta; error?: string }>

  getTextLibraryTree: () => Promise<TextLibraryListResult>

  readTextLibraryEntry: (relativePath: string) => Promise<TextLibraryReadResult>

  saveScreenplayToTextLibrary: (request: TextLibrarySaveRequest) => Promise<TextLibraryWriteResult>

  updateTextLibraryEntry: (relativePath: string, content: string) => Promise<TextLibraryWriteResult>

  deleteTextLibraryEntry: (relativePath: string) => Promise<TextLibraryDeleteResult>

  deleteTextLibraryFolder: (relativePath: string) => Promise<TextLibraryDeleteResult>

  exportTextLibraryEntry: (relativePath: string) => Promise<TextLibraryExportResult>

  onTextLibraryUpdated: (callback: () => void) => () => void

  openCardNoteWindow: () => Promise<void>
  openTextLibrary: () => Promise<void>

  listCardNotes: () => Promise<CardNoteEntry[]>
  getCardNotes: (cardCode: number, kind?: CardNoteKind | 'all') => Promise<CardNote[]>
  saveCardNote: (
    note: CardNote,
    originalTitle?: string
  ) => Promise<{ success: boolean; error?: string }>
  deleteCardNote: (
    cardCode: number,
    kind: CardNoteKind,
    title: string
  ) => Promise<{ success: boolean; error?: string }>
  exportCardNoteLibrary: () => Promise<{ success: boolean; filePath?: string; error?: string }>
  importCardNoteLibrary: () => Promise<{ success: boolean; imported?: number; error?: string }>
  reorderCardNotes: (
    cardCode: number,
    kind: CardNoteKind,
    titles: string[]
  ) => Promise<{ success: boolean; error?: string }>

  getDuelDocumentTree: () => Promise<DuelDocumentListResult>
  readDuelDocument: (filePath: string) => Promise<DuelDocumentReadResult>
  saveDuelDocument: (filePath: string, document: DuelDocument) => Promise<DuelDocumentWriteResult>
  createDuelDocument: (
    folderPath: string,
    document: DuelDocument
  ) => Promise<DuelDocumentWriteResult>
  saveDuelDocumentDialog: (document: DuelDocument) => Promise<DuelDocumentWriteResult>
  openDuelDocumentDialog: () => Promise<DuelDocumentReadResult>
  createDuelDocumentFolder: (parentPath: string, name: string) => Promise<DuelDocumentWriteResult>
  renameDuelDocumentFolder: (folderPath: string, name: string) => Promise<DuelDocumentWriteResult>
  deleteDuelDocumentFolder: (folderPath: string) => Promise<DuelDocumentWriteResult>
  renameDuelDocument: (filePath: string, title: string) => Promise<DuelDocumentWriteResult>
  moveDuelDocument: (filePath: string, targetFolder: string) => Promise<DuelDocumentWriteResult>
  deleteDuelDocument: (filePath: string) => Promise<DuelDocumentWriteResult>

  getDefaultDataDirectory: () => Promise<string>
  openDataDirectory: () => Promise<void>
  selectDataDirectory: (migrate: boolean) => Promise<DataDirectoryResult | null>
  resetDataDirectory: (migrate: boolean) => Promise<DataDirectoryResult>
  onDataDirectoryChanged: (callback: () => void) => () => void

  getConfig: () => Promise<AppConfig>
  saveConfig: (config: Partial<AppConfig>) => Promise<boolean>
  getGamePathStatus: () => Promise<GamePathStatus>

  setCardImageOverride: (code: number, variantCode: number | null) => Promise<boolean>
  onCardImageUpdated: (callback: () => void) => () => void

  openDeckEditor: (deckId?: string, createNew?: boolean) => Promise<void>
  consumePendingDeckToEdit: () => Promise<{ deck: DeckData | null; returnToMain: boolean }>
  onOpenDeckInEditor: (callback: (deck: DeckData, returnToMain: boolean) => void) => () => void

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

  getFavorites: () => Promise<FavoritesState>
  toggleFavorite: (code: number) => Promise<FavoritesState>
  addFavoriteCategory: (name: string) => Promise<FavoritesState & { id: string }>
  renameFavoriteCategory: (id: string, name: string) => Promise<FavoritesState>
  deleteFavoriteCategory: (id: string) => Promise<FavoritesState>
  setFavoriteCategory: (
    code: number,
    categoryId: string,
    member: boolean
  ) => Promise<FavoritesState>
  setFavoriteUngrouped: (code: number) => Promise<FavoritesState>
  onFavoritesChanged: (callback: (state: FavoritesState) => void) => () => void

  agentSendMessage: (params: AgentSendMessageParams) => Promise<AgentSendMessageResult>
  agentAbort: () => Promise<boolean>

  agentResetSession: () => Promise<boolean>

  agentFetchModels: (params: AgentFetchModelsParams) => Promise<AgentFetchModelsResult>

  agentGetProviderPresets: () => Promise<AgentProviderPreset[]>
  duelExportReplay: (params: EngineExportReplayParams) => Promise<EngineExportReplayResult>

  duelOpenReplay: (filePath: string) => Promise<EngineOpenReplayResult>

  duelListReplays: () => Promise<ReplayFileListResult>

  duelDeleteReplays: (fileNames: string[]) => Promise<ReplayDeleteResult>

  getDuelEngineSupport: () => Promise<EngineSupportInfo>
  getDuelEngineSessionDoc: () => Promise<EngineSessionDocResult>
  restoreDuelEngineSession: (doc: EngineSessionDoc) => Promise<EngineSessionRestoreResult>

  duelEngineInit: (params: EngineDuelInitParams) => Promise<{
    boardState: EngineBoardState
    pendingRequest: EngineRequest | null
    initialNode: EngineTimelineNode
  }>
  duelEngineSetPolicy: (policy: TimingPolicy) => Promise<TimingPolicy>
  duelEngineSubmitAnswer: (answer: Answer) => Promise<EngineSubmitAnswerResult>
  duelEngineInject: (command: InjectCommand) => Promise<EngineInjectResult>
  duelEngineGetPendingRequest: () => Promise<EngineRequest | null>
  duelEngineGetProvenance: (ref: EngineCardRef) => Promise<EngineProvenance>
  duelEngineReplaceCard: (ref: EngineCardRef, newCode: number) => Promise<EngineCardEditResult>
  duelEngineRemoveCard: (ref: EngineCardRef) => Promise<EngineCardEditResult>
  duelEngineJumpToStep: (stepId: string) => Promise<{
    boardState: EngineBoardState
    currentStepId: string
  }>
  duelEngineGetTimeline: () => Promise<EngineTimelineNode[]>
  duelEngineImportReplay: () => Promise<EngineImportReplayResult>
  duelEngineExitReplay: () => Promise<void>
  onReplayImportStarting: (callback: () => void) => () => void
  openSettingsWindow: (section?: SettingsSectionId) => Promise<void>
  onSettingsNavigate: (callback: (section: SettingsSectionId) => void) => () => void
  openExternal: (url: string) => Promise<boolean>

  windowMinimize: () => Promise<void>
  windowToggleMaximize: () => Promise<boolean>
  windowClose: () => Promise<void>
  windowIsMaximized: () => Promise<boolean>

  onWindowMaximizedChange: (callback: (maximized: boolean) => void) => () => void
  onAppBeforeClose: (callback: () => void) => () => void
  confirmAppClose: () => void

  getUpdateState: () => Promise<UpdateState>
  checkForUpdates: () => Promise<UpdateState>
  downloadUpdate: () => Promise<UpdateState>
  installUpdate: () => Promise<void>
  onUpdateState: (callback: (state: UpdateState) => void) => () => void

  onConfigUpdated: (callback: () => void) => () => void
  onCdbUpdated: (callback: () => void) => () => void
  onAgentEvent: (callback: (event: AgentStreamEvent) => void) => () => void
}
