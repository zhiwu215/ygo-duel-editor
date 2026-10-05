import { ipcMain, shell, BrowserWindow } from 'electron'
import type { IpcMainInvokeEvent } from 'electron'
import { CardSearchParams, DuelPuzzleState, AppConfig } from '@shared/index'
import { cdbService } from '../db/cdbService'
import { fileService } from '../services/fileService'
import { configService } from '../services/configService'
import { imageService } from '../services/imageService'
import { deckService } from '../services/deckService'
import { ocgcoreService } from '../services/ocgcoreService'
import { agentService } from '../services/agentService'
import { settingsWindowService } from '../services/settingsWindowService'

export function registerAllIpcHandlers(): void {
  // CDB 数据库操作
  ipcMain.handle('cdb:search', async (_, params: CardSearchParams) => {
    return cdbService.search(params)
  })

  ipcMain.handle('cdb:search-filter-options', () => cdbService.getSearchFilterOptions())

  ipcMain.handle('cdb:get-by-ids', async (_, ids: number[]) => {
    return cdbService.getCardsByIds(ids)
  })

  ipcMain.handle('cdb:status', () => {
    return {
      ready: cdbService.isReady(),
      path: cdbService.getCurrentPath()
    }
  })

  // Lua 脚本导入导出
  ipcMain.handle('file:export-lua', async (_, state: DuelPuzzleState, targetPath?: string) => {
    return fileService.exportLuaFile(state, targetPath)
  })

  ipcMain.handle('file:import-lua', async () => {
    return fileService.importLuaFile()
  })

  ipcMain.handle('file:export-screenplay-md', async (_, state: DuelPuzzleState) => {
    return fileService.exportScreenplayFile(state)
  })

  // 规则引擎校验与探针
  ipcMain.handle('ocgcore:test-run', async () => {
    try {
      const core = await ocgcoreService.getCore()
      const [maj, min] = core.getVersion()
      return {
        success: true,
        version: `${maj}.${min}`,
        message: 'ocgcore-wasm 核心加载成功，随时可执行模拟与校验'
      }
    } catch (err: unknown) {
      console.error('[registerIpc] ocgcore:test-run failed:', err)
      return {
        success: false,
        error: err instanceof Error ? err.message : 'ocgcore-wasm 加载失败'
      }
    }
  })

  // 项目工程保存打开与决斗档案库
  ipcMain.handle('file:save-project', async (_, state: DuelPuzzleState) => {
    return fileService.saveProjectFile(state)
  })

  ipcMain.handle('file:load-project', async () => {
    return fileService.loadProjectFile()
  })

  ipcMain.handle('file:get-project-list', async () => {
    return fileService.getProjectList()
  })

  ipcMain.handle('file:load-project-by-path', async (_, filePath: string) => {
    return fileService.loadProjectByPath(filePath)
  })

  ipcMain.handle('file:delete-project-file', async (_, filePath: string) => {
    return fileService.deleteProjectFile(filePath)
  })

  ipcMain.handle('file:duplicate-project-file', async (_, filePath: string) => {
    return fileService.duplicateProjectFile(filePath)
  })

  ipcMain.handle('file:reveal-file', async (_, filePath: string) => {
    return fileService.revealFileInFolder(filePath)
  })

  ipcMain.handle('file:get-projects-dir', async () => {
    return fileService.getProjectsDirectory()
  })

  ipcMain.handle('file:open-projects-dir', async () => {
    return fileService.openProjectsDirectory()
  })

  ipcMain.handle('file:select-projects-dir', async () => {
    return fileService.selectProjectsDirectory()
  })

  // 用户配置
  ipcMain.handle('config:get', async () => {
    return configService.get()
  })

  ipcMain.handle('config:save', async (_, partial: Partial<AppConfig>) => {
    return configService.save(partial)
  })

  ipcMain.handle('config:select-ygo-dir', async () => {
    const dir = await fileService.selectGameDirectory()
    if (!dir) {
      return { success: false }
    }
    const cdbPath = fileService.locateCardsCdb(dir)
    if (!cdbPath) {
      return {
        success: false,
        error: '未在该目录下找到 cards.cdb，请确认选择的是 YGOPro 等游戏的主目录'
      }
    }
    const ok = cdbService.open(cdbPath)
    if (!ok) {
      return { success: false, error: 'cards.cdb 加载失败，文件可能已损坏' }
    }
    configService.save({ gameDirectory: dir, cdbPath })
    return { success: true, path: dir }
  })

  // 本地卡图路径查询
  ipcMain.handle('image:get-path', async (_, code: number, small?: boolean) => {
    return imageService.findCardImagePath(code, !!small)
  })

  // 卡组编辑器独立窗口与卡组文件
  ipcMain.handle('window:open-deck-editor', async () => {
    deckService.openDeckEditorWindow()
  })

  // 全局设置独立窗口，可指定进入后停留的分区
  ipcMain.handle('window:open-settings', async (_, section) => {
    settingsWindowService.openSettingsWindow(section)
  })

  ipcMain.handle('deck:get-list', async () => {
    return deckService.getDeckList()
  })

  ipcMain.handle('deck:save-to-library', async (_, deck) => {
    return deckService.saveDeckToLibrary(deck)
  })

  ipcMain.handle('deck:delete-from-library', async (_, id: string) => {
    return deckService.deleteDeckFromLibrary(id)
  })

  ipcMain.handle('deck:duplicate-in-library', async (_, id: string) => {
    return deckService.duplicateDeckInLibrary(id)
  })

  ipcMain.handle('deck:save-file', async (_, deck) => {
    return deckService.saveDeckFile(deck)
  })

  ipcMain.handle('deck:load-file', async () => {
    return deckService.loadDeckFile()
  })

  ipcMain.handle('deck:apply-to-duel', async (_, params) => {
    return deckService.applyDeckToDuel(params)
  })

  // 卡片收藏夹
  ipcMain.handle('favorites:get', async () => {
    return deckService.getFavorites()
  })

  ipcMain.handle('favorites:toggle', async (_, code: number) => {
    return deckService.toggleFavorite(code)
  })

  // AI 决斗编排
  ipcMain.handle('agent:send-message', async (_, params) => {
    return agentService.sendMessage(params)
  })

  ipcMain.handle('agent:abort', async () => {
    return agentService.abort()
  })

  ipcMain.handle('agent:reset-session', async () => {
    return agentService.resetSession()
  })

  ipcMain.handle('agent:fetch-models', async (_, params) => {
    return agentService.fetchModels(String(params?.baseUrl ?? ''), String(params?.apiKey ?? ''))
  })

  ipcMain.handle('agent:get-provider-presets', async () => {
    return agentService.getProviderPresets()
  })

  // 通用宿主能力：用系统默认浏览器打开外部链接
  ipcMain.handle('app:open-external', async (_, url: string) => {
    const target = String(url ?? '').trim()
    if (!/^https?:\/\//i.test(target)) return false
    await shell.openExternal(target)
    return true
  })

  // 主窗口无边框 (frame: false) 后的自绘窗口控件
  const resolveSenderWindow = (event: IpcMainInvokeEvent): BrowserWindow | null =>
    BrowserWindow.fromWebContents(event.sender)

  ipcMain.handle('window:minimize', (event) => {
    resolveSenderWindow(event)?.minimize()
  })

  ipcMain.handle('window:toggle-maximize', (event) => {
    const win = resolveSenderWindow(event)
    if (!win) return false
    if (win.isMaximized()) {
      win.unmaximize()
    } else {
      win.maximize()
    }
    return win.isMaximized()
  })

  ipcMain.handle('window:close', (event) => {
    resolveSenderWindow(event)?.close()
  })

  ipcMain.handle('window:is-maximized', (event) => {
    return resolveSenderWindow(event)?.isMaximized() ?? false
  })
}
