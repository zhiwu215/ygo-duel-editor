import { CdbCard } from '../card'
import { CustomCard, CustomCardInput } from '../customCard'
import { DuelPuzzleState } from '../duel'
import { DuelStep } from '../story'
import { DeckData, DeckLibrary } from '../deck'
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
import type { EngineSessionFileResult, EngineSessionImportResult } from '../../engine/sessionDoc'
import type { EngineImportReplayResult } from './engine'
import {
  CardSearchFilterOptions,
  CardSearchParams,
  CardSearchResult,
  CdbSelectResult,
  CdbStatusResult,
  GameLanguageOption
} from './cardSearch'
import {
  CustomCardDeleteResult,
  CustomCardPickImageResult,
  CustomCardSaveResult,
  CustomCardScriptInfo,
  CustomCardScriptResult,
  CustomCardSyncResult
} from './customCard'
import {
  AgentFetchModelsParams,
  AgentFetchModelsResult,
  AgentHandoffRequest,
  AgentProviderPreset,
  AgentSendMessageParams,
  AgentSendMessageResult,
  AgentStreamEvent
} from './agent'
import { AppConfig, DataDirectoryResult, SettingsSectionId } from './appConfig'
import { EngineExportReplayParams, EngineExportReplayResult, TestInGameResult } from './engine'
import { DuelProjectMeta } from './project'
import { CardNote, CardNoteEntry, CardNoteKind } from './note'
import { TextChapter, TextMeta } from './text'

export type ScreenplayEdit =
  | { kind: 'addStep'; step: DuelStep }
  | { kind: 'updateStep'; stepId: string; patch: Partial<DuelStep> }
  | { kind: 'deleteStep'; stepId: string }

export interface ScreenplaySnapshot {
  state: DuelPuzzleState
  selectedStepId: string | null
}

export interface IpcApi {
  getAppVersion: () => Promise<string>

  selectYgoDirectory: () => Promise<CdbSelectResult>
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
  getCardsByIds: (ids: number[]) => Promise<Record<number, CdbCard>>
  getCdbStatus: () => Promise<CdbStatusResult>

  listCustomCards: () => Promise<CustomCard[]>
  saveCustomCard: (input: CustomCardInput) => Promise<CustomCardSaveResult>
  deleteCustomCard: (id: number) => Promise<CustomCardDeleteResult>
  pickCustomCardImage: () => Promise<CustomCardPickImageResult>
  applyCustomCardImage: (id: number) => Promise<CustomCardPickImageResult>
  getCustomCardScript: (code: number) => Promise<CustomCardScriptInfo>
  pickCustomCardScript: (code: number) => Promise<CustomCardScriptResult>
  deleteCustomCardScript: (code: number) => Promise<CustomCardScriptResult>
  openCustomCardScriptDir: () => Promise<void>
  syncCustomCardsToGame: () => Promise<CustomCardSyncResult>
  onCustomCardsUpdated: (callback: () => void) => () => void

  exportLuaFile: (
    state: DuelPuzzleState,
    targetPath?: string
  ) => Promise<{ success: boolean; filePath?: string; error?: string }>
  testInYgo: (state: DuelPuzzleState, force?: boolean) => Promise<TestInGameResult>
  importLuaFile: () => Promise<{ success: boolean; state?: DuelPuzzleState; error?: string }>
  exportScreenplayFile: (
    state: DuelPuzzleState
  ) => Promise<{ success: boolean; filePath?: string; error?: string }>

  saveProjectToLibrary: (
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

  agentHandoff: (request: AgentHandoffRequest) => Promise<{ success: boolean; error?: string }>

  openCardNoteWindow: () => Promise<void>
  openTextLibrary: () => Promise<void>

  openScreenplayWindow: () => Promise<void>
  requestScreenplayState: () => Promise<void>
  pushScreenplaySnapshot: (snapshot: ScreenplaySnapshot) => Promise<void>
  sendScreenplayEdit: (edit: ScreenplayEdit) => Promise<void>
  sendScreenplayPreview: (stepId: string) => Promise<void>
  onScreenplaySnapshot: (callback: (snapshot: ScreenplaySnapshot) => void) => () => void
  onScreenplayEdit: (callback: (edit: ScreenplayEdit) => void) => () => void
  onScreenplayPreview: (callback: (stepId: string) => void) => () => void
  onScreenplayStateRequested: (callback: () => void) => () => void
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

  saveProjectFile: (state: DuelPuzzleState) => Promise<{ success: boolean; filePath?: string }>
  saveProjectToPath: (
    filePath: string,
    state: DuelPuzzleState
  ) => Promise<{ success: boolean; filePath?: string; error?: string }>
  loadProjectFile: () => Promise<{ success: boolean; state?: DuelPuzzleState; filePath?: string }>

  getProjectList: () => Promise<DuelProjectMeta[]>
  loadProjectByPath: (
    filePath: string
  ) => Promise<{ success: boolean; state?: DuelPuzzleState; error?: string }>
  deleteProjectFile: (filePath: string) => Promise<{ success: boolean; error?: string }>
  duplicateProjectFile: (
    filePath: string
  ) => Promise<{ success: boolean; newPath?: string; error?: string }>
  revealFileInFolder: (filePath: string) => Promise<void>

  getDefaultDataDirectory: () => Promise<string>
  openDataDirectory: () => Promise<void>
  selectDataDirectory: (migrate: boolean) => Promise<DataDirectoryResult | null>
  resetDataDirectory: (migrate: boolean) => Promise<DataDirectoryResult>
  onDataDirectoryChanged: (callback: () => void) => () => void

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

  getFavorites: () => Promise<number[]>
  toggleFavorite: (code: number) => Promise<{ isFavorite: boolean; favorites: number[] }>
  onFavoritesChanged: (callback: (favorites: number[]) => void) => () => void

  agentSendMessage: (params: AgentSendMessageParams) => Promise<AgentSendMessageResult>
  agentAbort: () => Promise<boolean>

  agentResetSession: () => Promise<boolean>

  agentFetchModels: (params: AgentFetchModelsParams) => Promise<AgentFetchModelsResult>

  agentGetProviderPresets: () => Promise<AgentProviderPreset[]>
  duelExportReplay: (params: EngineExportReplayParams) => Promise<EngineExportReplayResult>

  duelEngineInit: (params: EngineDuelInitParams) => Promise<{
    boardState: EngineBoardState
    pendingRequest: EngineRequest | null
    initialNode: EngineTimelineNode
  }>
  duelEngineSetPolicy: (policy: TimingPolicy) => Promise<TimingPolicy>
  duelEngineSubmitAnswer: (answer: Answer) => Promise<EngineSubmitAnswerResult>
  duelEngineInject: (command: InjectCommand) => Promise<EngineInjectResult>
  duelEngineGetPendingRequest: () => Promise<EngineRequest | null>
  duelEngineJumpToStep: (stepId: string) => Promise<{
    boardState: EngineBoardState
    currentStepId: string
  }>
  duelEngineGetTimeline: () => Promise<EngineTimelineNode[]>
  duelEngineGetProvenance: (ref: EngineCardRef) => Promise<EngineProvenance>
  duelEngineReplaceCard: (ref: EngineCardRef, newCode: number) => Promise<EngineCardEditResult>
  duelEngineRemoveCard: (ref: EngineCardRef) => Promise<EngineCardEditResult>
  duelEngineExportSession: () => Promise<EngineSessionFileResult>
  duelEngineImportSession: () => Promise<EngineSessionImportResult>
  duelEngineImportReplay: () => Promise<EngineImportReplayResult>
  duelEngineExitReplay: () => Promise<void>
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
