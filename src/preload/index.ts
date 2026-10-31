import { contextBridge, ipcRenderer } from 'electron'
import { electronAPI } from '@electron-toolkit/preload'
import {
  IpcApi,
  CardSearchParams,
  DuelPuzzleState,
  AppConfig,
  DeckData,
  AgentStreamEvent,
  CustomCardScriptGenerateEvent,
  CardNote,
  CardNoteKind,
  DuelTestSettings,
  SettingsSectionId,
  EngineExportReplayParams,
  EngineExportReplayResult,
  EngineOpenReplayResult,
  EngineSupportInfo,
  ReplayDeleteResult,
  ReplayFileListResult,
  Answer,
  InjectCommand,
  TimingPolicy,
  FavoritesState,
  EngineCardRef,
  UpdateState
} from '@shared/index'

const api: IpcApi = {
  getAppVersion: () => ipcRenderer.invoke('app:get-version'),

  selectYgoDirectory: () => ipcRenderer.invoke('config:select-ygo-dir'),
  selectCardImageDirectory: () => ipcRenderer.invoke('config:select-card-image-dir'),
  selectMdpro3Directory: () => ipcRenderer.invoke('config:select-mdpro3-dir'),
  setCardImageDirectory: (dir: string | null) =>
    ipcRenderer.invoke('config:set-card-image-dir', dir),
  getGameLanguageOptions: () => ipcRenderer.invoke('config:game-language-options'),
  setGameLanguage: (languageId: string) =>
    ipcRenderer.invoke('config:set-game-language', languageId),
  pickExtraCdb: () => ipcRenderer.invoke('cdb:pick-extra'),
  addExtraCdb: (paths: string[]) => ipcRenderer.invoke('cdb:add-extra', paths),
  removeExtraCdb: (cdbPath: string) => ipcRenderer.invoke('cdb:remove-extra', cdbPath),
  setExtraCdbEnabled: (cdbPath: string, enabled: boolean) =>
    ipcRenderer.invoke('cdb:set-extra-enabled', cdbPath, enabled),
  setExtraCdbLanguage: (root: string, languageId: string) =>
    ipcRenderer.invoke('cdb:set-extra-language', root, languageId),
  searchCards: (params: CardSearchParams) => ipcRenderer.invoke('cdb:search', params),
  getCardSearchFilterOptions: () => ipcRenderer.invoke('cdb:search-filter-options'),
  setCardBanlist: (name: string | null) => ipcRenderer.invoke('cdb:set-banlist', name),
  getCardsByIds: (ids: number[]) => ipcRenderer.invoke('cdb:get-by-ids', ids),
  getCdbStatus: () => ipcRenderer.invoke('cdb:status'),

  listCustomCards: () => ipcRenderer.invoke('customcard:list'),
  saveCustomCard: (input) => ipcRenderer.invoke('customcard:save', input),
  allocateCustomCardId: () => ipcRenderer.invoke('customcard:allocate-id'),
  deleteCustomCard: (id) => ipcRenderer.invoke('customcard:delete', id),
  pickCustomCardImage: () => ipcRenderer.invoke('customcard:pick-image'),
  applyCustomCardImage: (id) => ipcRenderer.invoke('customcard:apply-image', id),
  getCustomCardScript: (code) => ipcRenderer.invoke('customcard:script-info', code),
  readCustomCardScriptContent: (code) => ipcRenderer.invoke('customcard:read-script-content', code),
  pickCustomCardScriptFile: () => ipcRenderer.invoke('customcard:pick-script-file'),
  importCustomCardScript: (code, filePath) =>
    ipcRenderer.invoke('customcard:import-script', code, filePath),
  testCustomCardScript: (input) => ipcRenderer.invoke('customcard:test-script', input),
  generateCustomCardScript: (input) => ipcRenderer.invoke('customcard:generate-script', input),
  abortCustomCardScriptGeneration: () => ipcRenderer.invoke('customcard:abort-generate-script'),
  onCustomCardScriptGenerateEvent: (callback) => {
    const handler = (_: unknown, event: unknown): void =>
      callback(event as CustomCardScriptGenerateEvent)
    ipcRenderer.on('customcard:generate-script-progress', handler)
    return () => {
      ipcRenderer.removeListener('customcard:generate-script-progress', handler)
    }
  },
  saveCustomCardScriptContent: (code, content) =>
    ipcRenderer.invoke('customcard:save-script-content', code, content),
  deleteCustomCardScript: (code) => ipcRenderer.invoke('customcard:delete-script', code),
  openCustomCardScriptDir: () => ipcRenderer.invoke('customcard:open-script-dir'),
  openCustomCardSyncDir: (target) => ipcRenderer.invoke('customcard:open-sync-dir', target),
  getCustomSetcodeNames: () => ipcRenderer.invoke('customcard:list-setcodes'),
  renameCustomSetcode: (codeHex, name) =>
    ipcRenderer.invoke('customcard:rename-setcode', codeHex, name),
  syncCustomCardsToGame: (target?: 'mdpro3', cardIds?: number[]) =>
    ipcRenderer.invoke('customcard:sync-to-game', target, cardIds),
  cleanCustomCardsFromGame: () => ipcRenderer.invoke('customcard:clean-from-game'),
  onCustomCardsUpdated: (callback) => {
    const handler = (): void => callback()
    ipcRenderer.on('custom-cards:updated', handler)
    return () => {
      ipcRenderer.removeListener('custom-cards:updated', handler)
    }
  },

  exportLuaFile: (state: DuelPuzzleState, targetPath?: string) =>
    ipcRenderer.invoke('file:export-lua', state, targetPath),
  testInYgo: (state: DuelPuzzleState, force?: boolean, test?: DuelTestSettings) =>
    ipcRenderer.invoke('file:test-in-ygo', state, force, test),
  importLuaFile: () => ipcRenderer.invoke('file:import-lua'),
  exportScreenplayFile: (state: DuelPuzzleState) =>
    ipcRenderer.invoke('file:export-screenplay-md', state),

  getTextList: () => ipcRenderer.invoke('library:text-list'),
  importTextFile: () => ipcRenderer.invoke('library:text-import'),
  getTextChapters: (textId) => ipcRenderer.invoke('library:text-chapters', textId),
  getTextChapterContent: (textId, chapterId) =>
    ipcRenderer.invoke('library:text-chapter-content', textId, chapterId),
  updateTextChapterContent: (textId, chapterId, content) =>
    ipcRenderer.invoke('library:text-chapter-update', textId, chapterId, content),
  updateTextChapterTitle: (textId, chapterId, title) =>
    ipcRenderer.invoke('library:text-chapter-title-update', textId, chapterId, title),
  deleteText: (id) => ipcRenderer.invoke('library:text-delete', id),
  resplitText: (id) => ipcRenderer.invoke('library:text-resplit', id),

  getTextLibraryTree: () => ipcRenderer.invoke('text-library:list'),
  readTextLibraryEntry: (relativePath) => ipcRenderer.invoke('text-library:read', relativePath),
  saveScreenplayToTextLibrary: (request) =>
    ipcRenderer.invoke('text-library:save-screenplay', request),
  updateTextLibraryEntry: (relativePath, content) =>
    ipcRenderer.invoke('text-library:update', relativePath, content),
  deleteTextLibraryEntry: (relativePath) => ipcRenderer.invoke('text-library:delete', relativePath),
  deleteTextLibraryFolder: (relativePath) =>
    ipcRenderer.invoke('text-library:delete-folder', relativePath),
  exportTextLibraryEntry: (relativePath) =>
    ipcRenderer.invoke('text-library:export-file', relativePath),
  onTextLibraryUpdated: (callback) => {
    const handler = (): void => callback()
    ipcRenderer.on('text-library:updated', handler)
    return () => {
      ipcRenderer.removeListener('text-library:updated', handler)
    }
  },

  openCardNoteWindow: () => ipcRenderer.invoke('window:open-card-notes'),
  openTextLibrary: () => ipcRenderer.invoke('window:open-text-library'),
  listCardNotes: () => ipcRenderer.invoke('note:list-all'),
  getCardNotes: (cardCode: number, kind?: CardNoteKind | 'all') =>
    ipcRenderer.invoke('note:get', cardCode, kind),
  saveCardNote: (note: CardNote, originalTitle?: string) =>
    ipcRenderer.invoke('note:save', note, originalTitle),
  deleteCardNote: (cardCode: number, kind: CardNoteKind, title: string) =>
    ipcRenderer.invoke('note:delete', cardCode, kind, title),
  exportCardNoteLibrary: () => ipcRenderer.invoke('note:export'),
  importCardNoteLibrary: () => ipcRenderer.invoke('note:import'),
  reorderCardNotes: (cardCode: number, kind: CardNoteKind, titles: string[]) =>
    ipcRenderer.invoke('note:reorder', cardCode, kind, titles),

  duelExportReplay: (params: EngineExportReplayParams): Promise<EngineExportReplayResult> =>
    ipcRenderer.invoke('duel:export-replay', params),

  duelOpenReplay: (filePath: string): Promise<EngineOpenReplayResult> =>
    ipcRenderer.invoke('duel:open-replay', filePath),

  duelListReplays: (): Promise<ReplayFileListResult> => ipcRenderer.invoke('duel:list-replays'),

  duelDeleteReplays: (fileNames: string[]): Promise<ReplayDeleteResult> =>
    ipcRenderer.invoke('duel:delete-replays', fileNames),

  getDuelEngineSupport: (): Promise<EngineSupportInfo> => ipcRenderer.invoke('duel-engine:support'),
  getDuelEngineSessionDoc: () => ipcRenderer.invoke('duel-engine:get-session-doc'),
  restoreDuelEngineSession: (doc) => ipcRenderer.invoke('duel-engine:restore-session', doc),

  duelEngineInit: (params) => ipcRenderer.invoke('duel-engine:init', params),
  duelEngineSetPolicy: (policy: TimingPolicy) =>
    ipcRenderer.invoke('duel-engine:set-policy', policy),
  duelEngineSubmitAnswer: (answer: Answer) =>
    ipcRenderer.invoke('duel-engine:submit-answer', answer),
  duelEngineInject: (command: InjectCommand) => ipcRenderer.invoke('duel-engine:inject', command),
  duelEngineGetPendingRequest: () => ipcRenderer.invoke('duel-engine:get-pending-request'),
  duelEngineGetProvenance: (ref: EngineCardRef) =>
    ipcRenderer.invoke('duel-engine:get-provenance', ref),
  duelEngineReplaceCard: (ref: EngineCardRef, newCode: number) =>
    ipcRenderer.invoke('duel-engine:replace-card', ref, newCode),
  duelEngineRemoveCard: (ref: EngineCardRef) => ipcRenderer.invoke('duel-engine:remove-card', ref),
  duelEngineJumpToStep: (stepId) => ipcRenderer.invoke('duel-engine:jump-to-step', stepId),
  duelEngineGetTimeline: () => ipcRenderer.invoke('duel-engine:get-timeline'),
  duelEngineImportReplay: () => ipcRenderer.invoke('duel-engine:import-replay'),
  duelEngineExitReplay: () => ipcRenderer.invoke('duel-engine:exit-replay'),
  onReplayImportStarting: (callback) => {
    const handler = (): void => callback()
    ipcRenderer.on('duel-engine:replay-import-starting', handler)
    return () => {
      ipcRenderer.removeListener('duel-engine:replay-import-starting', handler)
    }
  },

  getDuelDocumentTree: () => ipcRenderer.invoke('duel-document:tree'),
  readDuelDocument: (filePath) => ipcRenderer.invoke('duel-document:read', filePath),
  saveDuelDocument: (filePath, document) =>
    ipcRenderer.invoke('duel-document:save', filePath, document),
  createDuelDocument: (folderPath, document) =>
    ipcRenderer.invoke('duel-document:create', folderPath, document),
  saveDuelDocumentDialog: (document) => ipcRenderer.invoke('duel-document:save-dialog', document),
  openDuelDocumentDialog: () => ipcRenderer.invoke('duel-document:open-dialog'),
  createDuelDocumentFolder: (parentPath, name) =>
    ipcRenderer.invoke('duel-document:create-folder', parentPath, name),
  renameDuelDocumentFolder: (folderPath, name) =>
    ipcRenderer.invoke('duel-document:rename-folder', folderPath, name),
  deleteDuelDocumentFolder: (folderPath) =>
    ipcRenderer.invoke('duel-document:delete-folder', folderPath),
  renameDuelDocument: (filePath, title) =>
    ipcRenderer.invoke('duel-document:rename', filePath, title),
  moveDuelDocument: (filePath, targetFolder) =>
    ipcRenderer.invoke('duel-document:move', filePath, targetFolder),
  deleteDuelDocument: (filePath) => ipcRenderer.invoke('duel-document:delete', filePath),

  getDefaultDataDirectory: () => ipcRenderer.invoke('data:get-default-dir'),
  openDataDirectory: () => ipcRenderer.invoke('data:open-dir'),
  selectDataDirectory: (migrate: boolean) => ipcRenderer.invoke('data:select-dir', migrate),
  resetDataDirectory: (migrate: boolean) => ipcRenderer.invoke('data:reset-dir', migrate),
  onDataDirectoryChanged: (callback: () => void) => {
    const listener = (): void => callback()
    ipcRenderer.on('data-dir:changed', listener)
    return () => {
      ipcRenderer.removeListener('data-dir:changed', listener)
    }
  },

  getConfig: () => ipcRenderer.invoke('config:get'),
  saveConfig: (cfg: Partial<AppConfig>) => ipcRenderer.invoke('config:save', cfg),
  getGamePathStatus: () => ipcRenderer.invoke('config:game-path-status'),

  setCardImageOverride: (code: number, variantCode: number | null) =>
    ipcRenderer.invoke('image:set-card-override', code, variantCode),
  onCardImageUpdated: (callback) => {
    const handler = (): void => callback()
    ipcRenderer.on('image:updated', handler)
    return () => {
      ipcRenderer.removeListener('image:updated', handler)
    }
  },

  openDeckEditor: (deckId?: string, createNew?: boolean) =>
    ipcRenderer.invoke('window:open-deck-editor', deckId, createNew),
  consumePendingDeckToEdit: () => ipcRenderer.invoke('deck:consume-pending-edit'),
  onOpenDeckInEditor: (callback) => {
    const handler = (_: unknown, deck: DeckData, returnToMain: boolean): void =>
      callback(deck, returnToMain)
    ipcRenderer.on('deck:open-in-editor', handler)
    return () => {
      ipcRenderer.removeListener('deck:open-in-editor', handler)
    }
  },
  getDeckLibrary: () => ipcRenderer.invoke('deck:get-library'),
  createDeckGroup: (name, parent) => ipcRenderer.invoke('deck:create-group', name, parent ?? null),
  renameDeckGroup: (oldName, newName) => ipcRenderer.invoke('deck:rename-group', oldName, newName),
  deleteDeckGroup: (name) => ipcRenderer.invoke('deck:delete-group', name),
  assignDeckGroup: (deckId, group) => ipcRenderer.invoke('deck:assign-group', deckId, group),
  saveDeckToLibrary: (deck) => ipcRenderer.invoke('deck:save-to-library', deck),
  deleteDeckFromLibrary: (id) => ipcRenderer.invoke('deck:delete-from-library', id),
  duplicateDeckInLibrary: (id) => ipcRenderer.invoke('deck:duplicate-in-library', id),
  saveDeckFile: (deck) => ipcRenderer.invoke('deck:save-file', deck),
  loadDeckFile: () => ipcRenderer.invoke('deck:load-file'),

  getFavorites: () => ipcRenderer.invoke('favorites:get'),
  toggleFavorite: (code) => ipcRenderer.invoke('favorites:toggle', code),
  addFavoriteCategory: (name) => ipcRenderer.invoke('favorites:add-category', name),
  renameFavoriteCategory: (id, name) => ipcRenderer.invoke('favorites:rename-category', id, name),
  deleteFavoriteCategory: (id) => ipcRenderer.invoke('favorites:delete-category', id),
  setFavoriteCategory: (code, categoryId, member) =>
    ipcRenderer.invoke('favorites:set-category', code, categoryId, member),
  setFavoriteUngrouped: (code) => ipcRenderer.invoke('favorites:set-ungrouped', code),
  onFavoritesChanged: (callback) => {
    const handler = (_: unknown, state: FavoritesState): void => callback(state)
    ipcRenderer.on('favorites:changed', handler)
    return () => {
      ipcRenderer.removeListener('favorites:changed', handler)
    }
  },

  agentSendMessage: (params) => ipcRenderer.invoke('agent:send-message', params),
  agentAbort: () => ipcRenderer.invoke('agent:abort'),
  agentResetSession: () => ipcRenderer.invoke('agent:reset-session'),
  agentFetchModels: (params) => ipcRenderer.invoke('agent:fetch-models', params),
  agentGetProviderPresets: () => ipcRenderer.invoke('agent:get-provider-presets'),
  openSettingsWindow: (section) => ipcRenderer.invoke('window:open-settings', section),
  onSettingsNavigate: (callback) => {
    const handler = (_: unknown, section: SettingsSectionId): void => callback(section)
    ipcRenderer.on('settings:navigate', handler)
    return () => {
      ipcRenderer.removeListener('settings:navigate', handler)
    }
  },
  openExternal: (url: string) => ipcRenderer.invoke('app:open-external', url),
  windowMinimize: () => ipcRenderer.invoke('window:minimize'),
  windowToggleMaximize: () => ipcRenderer.invoke('window:toggle-maximize'),
  windowClose: () => ipcRenderer.invoke('window:close'),
  windowIsMaximized: () => ipcRenderer.invoke('window:is-maximized'),
  onWindowMaximizedChange: (callback) => {
    const handler = (_: unknown, maximized: boolean): void => callback(maximized)
    ipcRenderer.on('window:maximized-changed', handler)
    return () => {
      ipcRenderer.removeListener('window:maximized-changed', handler)
    }
  },
  getUpdateState: () => ipcRenderer.invoke('update:get-state'),
  checkForUpdates: () => ipcRenderer.invoke('update:check'),
  downloadUpdate: () => ipcRenderer.invoke('update:download'),
  installUpdate: () => ipcRenderer.invoke('update:install'),
  onUpdateState: (callback) => {
    const handler = (_: unknown, state: UpdateState): void => callback(state)
    ipcRenderer.on('update:state', handler)
    return () => {
      ipcRenderer.removeListener('update:state', handler)
    }
  },
  onAppBeforeClose: (callback) => {
    const handler = (): void => callback()
    ipcRenderer.on('app:before-close', handler)
    return () => {
      ipcRenderer.removeListener('app:before-close', handler)
    }
  },
  confirmAppClose: () => ipcRenderer.send('app:close-ready'),
  onConfigUpdated: (callback) => {
    const handler = (): void => callback()
    ipcRenderer.on('config:updated', handler)
    return () => {
      ipcRenderer.removeListener('config:updated', handler)
    }
  },
  onCdbUpdated: (callback) => {
    const handler = (): void => callback()
    ipcRenderer.on('cdb:updated', handler)
    return () => {
      ipcRenderer.removeListener('cdb:updated', handler)
    }
  },
  onAgentEvent: (callback) => {
    const handler = (_: unknown, event: unknown): void => callback(event as AgentStreamEvent)
    ipcRenderer.on('agent:event', handler)
    return () => {
      ipcRenderer.removeListener('agent:event', handler)
    }
  }
}

if (process.contextIsolated) {
  try {
    contextBridge.exposeInMainWorld('electron', electronAPI)
    contextBridge.exposeInMainWorld('api', api)
  } catch (error) {
    console.error(error)
  }
} else {
  // @ts-ignore (fallback when contextIsolation is disabled)
  window.electron = electronAPI
  // @ts-ignore (fallback when contextIsolation is disabled)
  window.api = api
}
