import { contextBridge, ipcRenderer } from 'electron'
import { electronAPI } from '@electron-toolkit/preload'
import {
  IpcApi,
  CardSearchParams,
  DuelPuzzleState,
  AppConfig,
  DeckData,
  AgentStreamEvent,
  AgentHandoffRequest,
  CardNote,
  CardNoteKind,
  SettingsSectionId,
  EngineExportReplayParams,
  EngineExportReplayResult,
  Answer,
  InjectCommand,
  TimingPolicy,
  ScreenplayEdit,
  ScreenplaySnapshot
} from '@shared/index'

const api: IpcApi = {
  getAppVersion: () => ipcRenderer.invoke('app:get-version'),

  selectYgoDirectory: () => ipcRenderer.invoke('config:select-ygo-dir'),
  addExtraCdb: () => ipcRenderer.invoke('cdb:add-extra'),
  removeExtraCdb: (cdbPath: string) => ipcRenderer.invoke('cdb:remove-extra', cdbPath),
  setExtraCdbEnabled: (cdbPath: string, enabled: boolean) =>
    ipcRenderer.invoke('cdb:set-extra-enabled', cdbPath, enabled),
  searchCards: (params: CardSearchParams) => ipcRenderer.invoke('cdb:search', params),
  getCardSearchFilterOptions: () => ipcRenderer.invoke('cdb:search-filter-options'),
  getCardsByIds: (ids: number[]) => ipcRenderer.invoke('cdb:get-by-ids', ids),
  getCdbStatus: () => ipcRenderer.invoke('cdb:status'),

  listCustomCards: () => ipcRenderer.invoke('customcard:list'),
  saveCustomCard: (input) => ipcRenderer.invoke('customcard:save', input),
  deleteCustomCard: (id) => ipcRenderer.invoke('customcard:delete', id),
  pickCustomCardImage: () => ipcRenderer.invoke('customcard:pick-image'),
  applyCustomCardImage: (id) => ipcRenderer.invoke('customcard:apply-image', id),
  getCustomCardScript: (code) => ipcRenderer.invoke('customcard:script-info', code),
  pickCustomCardScript: (code) => ipcRenderer.invoke('customcard:pick-script', code),
  deleteCustomCardScript: (code) => ipcRenderer.invoke('customcard:delete-script', code),
  openCustomCardScriptDir: () => ipcRenderer.invoke('customcard:open-script-dir'),
  syncCustomCardsToGame: () => ipcRenderer.invoke('customcard:sync-to-game'),
  onCustomCardsUpdated: (callback) => {
    const handler = (): void => callback()
    ipcRenderer.on('custom-cards:updated', handler)
    return () => {
      ipcRenderer.removeListener('custom-cards:updated', handler)
    }
  },

  exportLuaFile: (state: DuelPuzzleState, targetPath?: string) =>
    ipcRenderer.invoke('file:export-lua', state, targetPath),
  testInYgo: (state: DuelPuzzleState) => ipcRenderer.invoke('file:test-in-ygo', state),
  importLuaFile: () => ipcRenderer.invoke('file:import-lua'),
  exportScreenplayFile: (state: DuelPuzzleState) =>
    ipcRenderer.invoke('file:export-screenplay-md', state),

  saveProjectToLibrary: (state: DuelPuzzleState) =>
    ipcRenderer.invoke('file:save-to-library', state),

  getTextList: () => ipcRenderer.invoke('library:text-list'),
  importTextFile: () => ipcRenderer.invoke('library:text-import'),
  getTextChapters: (textId: string) => ipcRenderer.invoke('library:text-chapters', textId),
  getTextChapterContent: (textId: string, chapterId: string) =>
    ipcRenderer.invoke('library:text-chapter-content', textId, chapterId),
  updateTextChapterContent: (textId: string, chapterId: string, content: string) =>
    ipcRenderer.invoke('library:text-chapter-update', textId, chapterId, content),
  updateTextChapterTitle: (textId: string, chapterId: string, title: string) =>
    ipcRenderer.invoke('library:text-chapter-title-update', textId, chapterId, title),
  deleteText: (id: string) => ipcRenderer.invoke('library:text-delete', id),
  resplitText: (id: string) => ipcRenderer.invoke('library:text-resplit', id),

  agentHandoff: (request) => ipcRenderer.invoke('agent:handoff', request),

  openCardNoteWindow: () => ipcRenderer.invoke('window:open-card-notes'),
  openTextLibrary: () => ipcRenderer.invoke('window:open-text-library'),
  openScreenplayWindow: () => ipcRenderer.invoke('screenplay:open-window'),
  requestScreenplayState: () => ipcRenderer.invoke('screenplay:request-state'),
  pushScreenplaySnapshot: (snapshot) => ipcRenderer.invoke('screenplay:push-state', snapshot),
  sendScreenplayEdit: (edit) => ipcRenderer.invoke('screenplay:edit', edit),
  sendScreenplayPreview: (stepId: string) => ipcRenderer.invoke('screenplay:preview', stepId),
  onScreenplaySnapshot: (callback) => {
    const handler = (_: unknown, snapshot: unknown): void =>
      callback(snapshot as ScreenplaySnapshot)
    ipcRenderer.on('screenplay:state', handler)
    return () => {
      ipcRenderer.removeListener('screenplay:state', handler)
    }
  },
  onScreenplayEdit: (callback) => {
    const handler = (_: unknown, edit: unknown): void => callback(edit as ScreenplayEdit)
    ipcRenderer.on('screenplay:edit', handler)
    return () => {
      ipcRenderer.removeListener('screenplay:edit', handler)
    }
  },
  onScreenplayPreview: (callback) => {
    const handler = (_: unknown, stepId: unknown): void => callback(stepId as string)
    ipcRenderer.on('screenplay:preview', handler)
    return () => {
      ipcRenderer.removeListener('screenplay:preview', handler)
    }
  },
  onScreenplayStateRequested: (callback) => {
    const handler = (): void => callback()
    ipcRenderer.on('screenplay:request-state', handler)
    return () => {
      ipcRenderer.removeListener('screenplay:request-state', handler)
    }
  },
  listCardNotes: () => ipcRenderer.invoke('note:list-all'),
  getCardNotes: (cardCode: number, kind?: CardNoteKind | 'all') =>
    ipcRenderer.invoke('note:get', cardCode, kind),
  saveCardNote: (note: CardNote) => ipcRenderer.invoke('note:save', note),
  deleteCardNote: (cardCode: number, kind: CardNoteKind, label: string) =>
    ipcRenderer.invoke('note:delete', cardCode, kind, label),
  exportCardNoteLibrary: () => ipcRenderer.invoke('note:export'),
  importCardNoteLibrary: () => ipcRenderer.invoke('note:import'),
  reorderCardNotes: (cardCode: number, kind: CardNoteKind, labels: string[]) =>
    ipcRenderer.invoke('note:reorder', cardCode, kind, labels),

  duelExportReplay: (params: EngineExportReplayParams): Promise<EngineExportReplayResult> =>
    ipcRenderer.invoke('duel:export-replay', params),

  duelEngineInit: (params) => ipcRenderer.invoke('duel-engine:init', params),
  duelEngineSetPolicy: (policy: TimingPolicy) =>
    ipcRenderer.invoke('duel-engine:set-policy', policy),
  duelEngineSubmitAnswer: (answer: Answer) =>
    ipcRenderer.invoke('duel-engine:submit-answer', answer),
  duelEngineInject: (command: InjectCommand) => ipcRenderer.invoke('duel-engine:inject', command),
  duelEngineGetPendingRequest: () => ipcRenderer.invoke('duel-engine:get-pending-request'),
  duelEngineJumpToStep: (stepId) => ipcRenderer.invoke('duel-engine:jump-to-step', stepId),
  duelEngineGetTimeline: () => ipcRenderer.invoke('duel-engine:get-timeline'),
  duelEngineGetProvenance: (ref) => ipcRenderer.invoke('duel-engine:provenance', ref),
  duelEngineReplaceCard: (ref, newCode) =>
    ipcRenderer.invoke('duel-engine:replace-card', ref, newCode),
  duelEngineRemoveCard: (ref) => ipcRenderer.invoke('duel-engine:remove-card', ref),
  duelEngineExportSession: () => ipcRenderer.invoke('duel-engine:export-session'),
  duelEngineImportSession: () => ipcRenderer.invoke('duel-engine:import-session'),
  duelEngineImportReplay: () => ipcRenderer.invoke('duel-engine:import-replay'),
  duelEngineExitReplay: () => ipcRenderer.invoke('duel-engine:exit-replay'),

  saveProjectFile: (state: DuelPuzzleState) => ipcRenderer.invoke('file:save-project', state),
  saveProjectToPath: (filePath: string, state: DuelPuzzleState) =>
    ipcRenderer.invoke('file:save-project-to-path', filePath, state),
  loadProjectFile: () => ipcRenderer.invoke('file:load-project'),

  getProjectList: () => ipcRenderer.invoke('file:get-project-list'),
  loadProjectByPath: (filePath: string) =>
    ipcRenderer.invoke('file:load-project-by-path', filePath),
  deleteProjectFile: (filePath: string) => ipcRenderer.invoke('file:delete-project-file', filePath),
  duplicateProjectFile: (filePath: string) =>
    ipcRenderer.invoke('file:duplicate-project-file', filePath),
  revealFileInFolder: (filePath: string) => ipcRenderer.invoke('file:reveal-file', filePath),
  getProjectsDirectory: () => ipcRenderer.invoke('file:get-projects-dir'),
  openProjectsDirectory: () => ipcRenderer.invoke('file:open-projects-dir'),
  selectProjectsDirectory: () => ipcRenderer.invoke('file:select-projects-dir'),

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

  createProjectSeries: (name: string) => ipcRenderer.invoke('file:create-project-series', name),
  renameProjectSeries: (oldName: string, newName: string) =>
    ipcRenderer.invoke('file:rename-project-series', oldName, newName),
  deleteProjectSeries: (name: string) => ipcRenderer.invoke('file:delete-project-series', name),
  setProjectSeries: (filePath: string, series: string | null) =>
    ipcRenderer.invoke('file:set-project-series', filePath, series),

  getConfig: () => ipcRenderer.invoke('config:get'),
  saveConfig: (cfg: Partial<AppConfig>) => ipcRenderer.invoke('config:save', cfg),

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
  onFavoritesChanged: (callback) => {
    const handler = (_: unknown, favs: number[]): void => callback(favs)
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
  },
  onAgentHandoff: (callback) => {
    const handler = (_: unknown, request: unknown): void => callback(request as AgentHandoffRequest)
    ipcRenderer.on('agent:handoff-request', handler)
    return () => {
      ipcRenderer.removeListener('agent:handoff-request', handler)
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
