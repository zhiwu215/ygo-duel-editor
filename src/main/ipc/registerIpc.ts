import { ipcMain, shell, BrowserWindow, dialog } from 'electron'
import type { IpcMainInvokeEvent } from 'electron'
import {
  CardSearchParams,
  DuelPuzzleState,
  AppConfig,
  CardNote,
  CardNoteKind,
  CustomCardInput
} from '@shared/index'
import { cdbService } from '../db/cdbService'
import { fileService } from '../services/fileService'
import { configService } from '../services/configService'
import { imageService } from '../services/imageService'
import { deckService } from '../services/deckService'
import { ocgcoreService } from '../services/ocgcoreService'
import { agentService } from '../services/agentService'
import { settingsWindowService } from '../services/settingsWindowService'
import { libraryService } from '../services/libraryService'
import { cardNoteService } from '../services/cardNoteService'
import { customCardService } from '../services/customCardService'

const notifyCdbUpdated = (): void => {
  for (const win of BrowserWindow.getAllWindows()) {
    if (!win.isDestroyed()) win.webContents.send('cdb:updated')
  }
}

const enabledExtraPaths = (): string[] => {
  const cfg = configService.get()
  const disabled = cfg.disabledCdbPaths || []
  return (cfg.extraCdbPaths || []).filter((p) => !disabled.includes(p))
}

export function registerAllIpcHandlers(): void {
  ipcMain.handle('cdb:search', async (_, params: CardSearchParams) => {
    return customCardService.mergeSearchResults(cdbService.search(params), params)
  })

  ipcMain.handle('cdb:search-filter-options', () => cdbService.getSearchFilterOptions())

  ipcMain.handle('cdb:get-by-ids', async (_, ids: number[]) => {
    return customCardService.mergeCardsByIds(cdbService.getCardsByIds(ids), ids)
  })

  ipcMain.handle('customcard:list', () => {
    return customCardService.list()
  })

  ipcMain.handle('customcard:save', (_, input: CustomCardInput) => {
    try {
      const card = customCardService.save(input)
      return { success: true, card }
    } catch (err) {
      console.error('[registerIpc] customcard:save failed:', err)
      return { success: false, error: err instanceof Error ? err.message : '保存失败' }
    }
  })

  ipcMain.handle('customcard:delete', (_, id: number) => {
    try {
      customCardService.remove(id)
      return { success: true }
    } catch (err) {
      console.error('[registerIpc] customcard:delete failed:', err)
      return { success: false, error: err instanceof Error ? err.message : '删除失败' }
    }
  })

  ipcMain.handle('customcard:pick-image', async (_, id: number) => {
    return customCardService.pickImage(id)
  })

  ipcMain.handle('cdb:status', () => {
    return {
      ready: cdbService.isReady(),
      path: cdbService.getCurrentPath(),
      loadedPaths: cdbService.getLoadedPaths()
    }
  })

  ipcMain.handle('cdb:add-extra', async () => {
    const cdbPath = await fileService.selectExtraCdb()
    if (!cdbPath) {
      return { success: false }
    }
    const cfg = configService.get()
    const extras = (cfg.extraCdbPaths || []).filter((p) => p !== cdbPath)
    const merged = [...extras, cdbPath]
    const loaded = cdbService.addExtra([cdbPath])
    if (loaded.length === 0) {
      return { success: false, error: '该文件不是有效的卡库 (缺少 datas/texts 表)' }
    }

    const detectedPics = imageService.detectPicsDirsFromCdb(cdbPath)
    configService.save({ extraCdbPaths: merged })
    notifyCdbUpdated()
    return {
      success: true,
      path: cdbPath,
      picsDetected: detectedPics.length > 0
    }
  })

  ipcMain.handle('cdb:remove-extra', async (_, cdbPath: string) => {
    const cfg = configService.get()
    const extras = (cfg.extraCdbPaths || []).filter((p) => p !== cdbPath)
    const disabledCdbPaths = (cfg.disabledCdbPaths || []).filter((p) => p !== cdbPath)
    configService.save({ extraCdbPaths: extras, disabledCdbPaths })
    cdbService.reloadAll(
      cfg.cdbPath,
      extras.filter((p) => !disabledCdbPaths.includes(p))
    )
    notifyCdbUpdated()
    return { success: true, paths: cdbService.getLoadedPaths() }
  })

  ipcMain.handle('cdb:set-extra-enabled', async (_, cdbPath: string, enabled: boolean) => {
    const cfg = configService.get()
    const current = cfg.disabledCdbPaths || []
    const disabledCdbPaths = enabled
      ? current.filter((p) => p !== cdbPath)
      : [...new Set([...current, cdbPath])]
    configService.save({ disabledCdbPaths })
    cdbService.reloadAll(
      cfg.cdbPath,
      (cfg.extraCdbPaths || []).filter((p) => !disabledCdbPaths.includes(p))
    )
    notifyCdbUpdated()
    return { success: true, paths: cdbService.getLoadedPaths() }
  })

  ipcMain.handle('file:export-lua', async (_, state: DuelPuzzleState, targetPath?: string) => {
    return fileService.exportLuaFile(state, targetPath)
  })

  ipcMain.handle('file:import-lua', async () => {
    return fileService.importLuaFile()
  })

  ipcMain.handle('file:export-screenplay-md', async (_, state: DuelPuzzleState) => {
    return fileService.exportScreenplayFile(state)
  })

  ipcMain.handle('file:save-to-library', async (_, state: DuelPuzzleState) => {
    return fileService.saveProjectToLibrary(state)
  })

  ipcMain.handle('library:novel-list', async () => {
    return libraryService.getNovelList()
  })

  ipcMain.handle('library:novel-import', async () => {
    const picked = await dialog.showOpenDialog(BrowserWindow.getFocusedWindow()!, {
      title: '导入小说资料',
      properties: ['openFile'],
      filters: [
        { name: '文本小说', extensions: ['txt', 'md', 'epub'] },
        { name: '所有文件', extensions: ['*'] }
      ]
    })
    if (picked.canceled || picked.filePaths.length === 0) {
      return { success: false, canceled: true }
    }
    return libraryService.importNovelFile(picked.filePaths)
  })

  ipcMain.handle('library:novel-chapters', async (_, novelId: string) => {
    return libraryService.getNovelChapters(novelId)
  })

  ipcMain.handle('library:novel-chapter-content', async (_, novelId: string, chapterId: string) => {
    return libraryService.getNovelChapterContent(novelId, chapterId)
  })

  ipcMain.handle(
    'library:novel-chapter-update',
    async (_, novelId: string, chapterId: string, content: string) => {
      return libraryService.updateNovelChapterContent(novelId, chapterId, content)
    }
  )

  ipcMain.handle(
    'library:novel-chapter-title-update',
    async (_, novelId: string, chapterId: string, title: string) => {
      return libraryService.updateNovelChapterTitle(novelId, chapterId, title)
    }
  )

  ipcMain.handle('library:novel-delete', async (_, id: string) => {
    return libraryService.deleteNovel(id)
  })

  ipcMain.handle('library:novel-resplit', async (_, id: string) => {
    return libraryService.resplitNovel(id)
  })

  ipcMain.handle('window:open-card-notes', async () => {
    cardNoteService.openWindow()
  })

  ipcMain.handle('note:list-all', async () => {
    return cardNoteService.listAll()
  })

  ipcMain.handle('note:get', async (_, cardCode: number, kind?: CardNoteKind) => {
    return cardNoteService.getNotes(cardCode, kind)
  })

  ipcMain.handle('note:save', async (_, note: CardNote) => {
    return cardNoteService.saveNote(note)
  })

  ipcMain.handle('note:delete', async (_, cardCode: number, kind: CardNoteKind, label: string) => {
    return cardNoteService.deleteNote(cardCode, kind, label)
  })

  ipcMain.handle('note:export', async () => {
    return cardNoteService.exportLibrary()
  })

  ipcMain.handle('note:import', async () => {
    return cardNoteService.importLibrary()
  })

  ipcMain.handle(
    'note:reorder',
    async (_, cardCode: number, kind: CardNoteKind, labels: string[]) => {
      return cardNoteService.reorderNotes(cardCode, kind, labels)
    }
  )

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

  ipcMain.handle('file:create-project-series', async (_, name: string) => {
    return fileService.createProjectSeries(name)
  })

  ipcMain.handle('file:rename-project-series', async (_, oldName: string, newName: string) => {
    return fileService.renameProjectSeries(oldName, newName)
  })

  ipcMain.handle('file:delete-project-series', async (_, name: string) => {
    return fileService.deleteProjectSeries(name)
  })

  ipcMain.handle('file:set-project-series', async (_, filePath: string, series: string | null) => {
    return fileService.setProjectSeries(filePath, series)
  })

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
    const ok = cdbService.open(cdbPath, enabledExtraPaths())
    if (!ok) {
      return { success: false, error: 'cards.cdb 加载失败，文件可能已损坏' }
    }
    configService.save({ gameDirectory: dir, cdbPath })
    notifyCdbUpdated()
    return { success: true, path: dir }
  })

  ipcMain.handle('image:get-path', async (_, code: number, small?: boolean) => {
    return imageService.findCardImagePath(code, !!small)
  })

  ipcMain.handle('window:open-deck-editor', async (_, deckId?: string) => {
    deckService.openDeckEditorWindow(deckId)
  })

  ipcMain.handle('deck:consume-pending-edit', async () => {
    return deckService.consumePendingDeckToEdit()
  })

  ipcMain.handle('window:open-settings', async (_, section) => {
    settingsWindowService.openSettingsWindow(section)
  })

  ipcMain.handle('deck:get-list', async () => {
    return deckService.getDeckList()
  })

  ipcMain.handle('deck:get-library', async () => {
    return deckService.getLibrary()
  })

  ipcMain.handle('deck:create-group', async (_, name: string, parent?: string | null) => {
    return deckService.createGroup(name, parent)
  })

  ipcMain.handle('deck:rename-group', async (_, oldName: string, newName: string) => {
    return deckService.renameGroup(oldName, newName)
  })

  ipcMain.handle('deck:delete-group', async (_, name: string) => {
    return deckService.deleteGroup(name)
  })

  ipcMain.handle('deck:assign-group', async (_, deckId: string, group: string) => {
    return deckService.assignDeckToGroup(deckId, group)
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

  ipcMain.handle('favorites:get', async () => {
    return deckService.getFavorites()
  })

  ipcMain.handle('favorites:toggle', async (_, code: number) => {
    return deckService.toggleFavorite(code)
  })

  ipcMain.handle('agent:send-message', async (_, params) => {
    return agentService.sendMessage(params)
  })

  ipcMain.handle('agent:handoff', async (_, request) => {
    return agentService.handoff(request)
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

  ipcMain.handle('app:open-external', async (_, url: string) => {
    const target = String(url ?? '').trim()
    if (!/^https?:\/\//i.test(target)) return false
    await shell.openExternal(target)
    return true
  })

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
