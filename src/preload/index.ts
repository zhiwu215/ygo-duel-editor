import { contextBridge, ipcRenderer } from 'electron'
import { electronAPI } from '@electron-toolkit/preload'
import { IpcApi, CardSearchParams, DuelPuzzleState, AppConfig, DeckData } from '@shared/index'

// 实现类型完备的 IPC 桥接层
const api: IpcApi = {
  selectCdbFile: () => ipcRenderer.invoke('cdb:select-file'),
  loadCdb: (path: string) => ipcRenderer.invoke('cdb:load', path),
  searchCards: (params: CardSearchParams) => ipcRenderer.invoke('cdb:search', params),
  getCardsByIds: (ids: number[]) => ipcRenderer.invoke('cdb:get-by-ids', ids),

  exportLuaFile: (state: DuelPuzzleState, targetPath?: string) =>
    ipcRenderer.invoke('file:export-lua', state, targetPath),
  importLuaFile: () => ipcRenderer.invoke('file:import-lua'),

  saveProjectFile: (state: DuelPuzzleState) => ipcRenderer.invoke('file:save-project', state),
  loadProjectFile: () => ipcRenderer.invoke('file:load-project'),

  getConfig: () => ipcRenderer.invoke('config:get'),
  saveConfig: (cfg: Partial<AppConfig>) => ipcRenderer.invoke('config:save', cfg),
  selectGameDirectory: () => ipcRenderer.invoke('config:select-game-dir'),

  getCardImagePath: (code: number, small?: boolean) =>
    ipcRenderer.invoke('image:get-path', code, small),

  // 卡组编辑器独立窗口与卡组文件
  openDeckEditor: () => ipcRenderer.invoke('window:open-deck-editor'),
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
