import { ipcMain } from 'electron'
import { CardSearchParams, DuelPuzzleState, AppConfig } from '@shared/index'
import { cdbService } from '../db/cdbService'
import { fileService } from '../services/fileService'
import { configService } from '../services/configService'
import { imageService } from '../services/imageService'
import { deckService } from '../services/deckService'
import { ocgcoreService } from '../services/ocgcoreService'
import { agentService } from '../services/agentService'

export function registerAllIpcHandlers(): void {
  // CDB 数据库操作
  ipcMain.handle('cdb:select-file', async () => {
    const selected = await fileService.selectCdbFile()
    if (selected) {
      const ok = cdbService.open(selected)
      if (ok) {
        const detectedGameDir = imageService.detectGameDirectory(selected)
        configService.save({
          cdbPath: selected,
          ...(detectedGameDir ? { gameDirectory: detectedGameDir } : {})
        })
      }
      return selected
    }
    return null
  })

  ipcMain.handle('cdb:load', async (_, path: string) => {
    const ok = cdbService.open(path)
    if (ok) {
      const detectedGameDir = imageService.detectGameDirectory(path)
      configService.save({
        cdbPath: path,
        ...(detectedGameDir ? { gameDirectory: detectedGameDir } : {})
      })
    }
    return ok
  })

  ipcMain.handle('cdb:search', async (_, params: CardSearchParams) => {
    return cdbService.search(params)
  })

  ipcMain.handle('cdb:get-by-ids', async (_, ids: number[]) => {
    return cdbService.getCardsByIds(ids)
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

  ipcMain.handle('config:select-game-dir', async () => {
    const dir = await fileService.selectGameDirectory()
    if (dir) {
      configService.save({ gameDirectory: dir })
    }
    return dir
  })

  // 本地卡图路径查询
  ipcMain.handle('image:get-path', async (_, code: number, small?: boolean) => {
    return imageService.findCardImagePath(code, !!small)
  })

  // 卡组编辑器独立窗口与卡组文件
  ipcMain.handle('window:open-deck-editor', async () => {
    deckService.openDeckEditorWindow()
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
}
