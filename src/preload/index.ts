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
  SettingsSectionId
} from '@shared/index'

const api: IpcApi = {
  selectYgoDirectory: () => ipcRenderer.invoke('config:select-ygo-dir'),
  addExtraCdb: () => ipcRenderer.invoke('cdb:add-extra'),
  removeExtraCdb: (cdbPath: string) => ipcRenderer.invoke('cdb:remove-extra', cdbPath),
  setExtraCdbEnabled: (cdbPath: string, enabled: boolean) =>
    ipcRenderer.invoke('cdb:set-extra-enabled', cdbPath, enabled),
  searchCards: (params: CardSearchParams) => ipcRenderer.invoke('cdb:search', params),
  getCardSearchFilterOptions: () => ipcRenderer.invoke('cdb:search-filter-options'),
  getCardsByIds: (ids: number[]) => ipcRenderer.invoke('cdb:get-by-ids', ids),
  getCdbStatus: () => ipcRenderer.invoke('cdb:status'),

  exportLuaFile: (state: DuelPuzzleState, targetPath?: string) =>
    ipcRenderer.invoke('file:export-lua', state, targetPath),
  importLuaFile: () => ipcRenderer.invoke('file:import-lua'),
  exportScreenplayFile: (state: DuelPuzzleState) =>
    ipcRenderer.invoke('file:export-screenplay-md', state),

  saveProjectToLibrary: (state: DuelPuzzleState) =>
    ipcRenderer.invoke('file:save-to-library', state),

  getNovelList: () => ipcRenderer.invoke('library:novel-list'),
  importNovelFile: () => ipcRenderer.invoke('library:novel-import'),
  getNovelChapters: (novelId: string) => ipcRenderer.invoke('library:novel-chapters', novelId),
  getNovelChapterContent: (novelId: string, chapterId: string) =>
    ipcRenderer.invoke('library:novel-chapter-content', novelId, chapterId),
  updateNovelChapterContent: (novelId: string, chapterId: string, content: string) =>
    ipcRenderer.invoke('library:novel-chapter-update', novelId, chapterId, content),
  updateNovelChapterTitle: (novelId: string, chapterId: string, title: string) =>
    ipcRenderer.invoke('library:novel-chapter-title-update', novelId, chapterId, title),
  deleteNovel: (id: string) => ipcRenderer.invoke('library:novel-delete', id),
  resplitNovel: (id: string) => ipcRenderer.invoke('library:novel-resplit', id),

  agentHandoff: (request) => ipcRenderer.invoke('agent:handoff', request),

  openCardNoteWindow: () => ipcRenderer.invoke('window:open-card-notes'),
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

  testRunOcgcore: () => ipcRenderer.invoke('ocgcore:test-run'),

  saveProjectFile: (state: DuelPuzzleState) => ipcRenderer.invoke('file:save-project', state),
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

  createProjectSeries: (name: string) => ipcRenderer.invoke('file:create-project-series', name),
  renameProjectSeries: (oldName: string, newName: string) =>
    ipcRenderer.invoke('file:rename-project-series', oldName, newName),
  deleteProjectSeries: (name: string) => ipcRenderer.invoke('file:delete-project-series', name),
  setProjectSeries: (filePath: string, series: string | null) =>
    ipcRenderer.invoke('file:set-project-series', filePath, series),

  getConfig: () => ipcRenderer.invoke('config:get'),
  saveConfig: (cfg: Partial<AppConfig>) => ipcRenderer.invoke('config:save', cfg),

  getCardImagePath: (code: number, small?: boolean) =>
    ipcRenderer.invoke('image:get-path', code, small),

  openDeckEditor: (deckId?: string) => ipcRenderer.invoke('window:open-deck-editor', deckId),
  consumePendingDeckToEdit: () => ipcRenderer.invoke('deck:consume-pending-edit'),
  onOpenDeckInEditor: (callback) => {
    const handler = (_: unknown, deck: DeckData): void => callback(deck)
    ipcRenderer.on('deck:open-in-editor', handler)
    return () => {
      ipcRenderer.removeListener('deck:open-in-editor', handler)
    }
  },
  getDeckList: () => ipcRenderer.invoke('deck:get-list'),

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
  applyDeckToDuel: (params) => ipcRenderer.invoke('deck:apply-to-duel', params),
  onApplyDeckToDuel: (callback) => {
    const handler = (
      _: unknown,
      params: { player: 0 | 1; deck: DeckData; drawCount?: number }
    ): void => callback(params)
    ipcRenderer.on('deck:applied-to-duel', handler)
    return () => {
      ipcRenderer.removeListener('deck:applied-to-duel', handler)
    }
  },

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
