import { contextBridge, ipcRenderer } from 'electron'
import { electronAPI } from '@electron-toolkit/preload'
import {
  IpcApi,
  CardSearchParams,
  DuelPuzzleState,
  AppConfig,
  DeckData,
  AgentStreamEvent,
  SettingsSectionId
} from '@shared/index'

// 实现类型完备的 IPC 桥接层
const api: IpcApi = {
  selectYgoDirectory: () => ipcRenderer.invoke('config:select-ygo-dir'),
  searchCards: (params: CardSearchParams) => ipcRenderer.invoke('cdb:search', params),
  getCardsByIds: (ids: number[]) => ipcRenderer.invoke('cdb:get-by-ids', ids),
  getCdbStatus: () => ipcRenderer.invoke('cdb:status'),

  exportLuaFile: (state: DuelPuzzleState, targetPath?: string) =>
    ipcRenderer.invoke('file:export-lua', state, targetPath),
  importLuaFile: () => ipcRenderer.invoke('file:import-lua'),
  exportScreenplayFile: (state: DuelPuzzleState) =>
    ipcRenderer.invoke('file:export-screenplay-md', state),
  testRunOcgcore: () => ipcRenderer.invoke('ocgcore:test-run'),

  saveProjectFile: (state: DuelPuzzleState) => ipcRenderer.invoke('file:save-project', state),
  loadProjectFile: () => ipcRenderer.invoke('file:load-project'),

  // 决斗档案
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

  getConfig: () => ipcRenderer.invoke('config:get'),
  saveConfig: (cfg: Partial<AppConfig>) => ipcRenderer.invoke('config:save', cfg),

  getCardImagePath: (code: number, small?: boolean) =>
    ipcRenderer.invoke('image:get-path', code, small),

  // 卡组编辑器独立窗口与卡组文件
  openDeckEditor: () => ipcRenderer.invoke('window:open-deck-editor'),
  getDeckList: () => ipcRenderer.invoke('deck:get-list'),
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

  // 卡片收藏
  getFavorites: () => ipcRenderer.invoke('favorites:get'),
  toggleFavorite: (code) => ipcRenderer.invoke('favorites:toggle', code),
  onFavoritesChanged: (callback) => {
    const handler = (_: unknown, favs: number[]): void => callback(favs)
    ipcRenderer.on('favorites:changed', handler)
    return () => {
      ipcRenderer.removeListener('favorites:changed', handler)
    }
  },

  // AI 决斗编排
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
