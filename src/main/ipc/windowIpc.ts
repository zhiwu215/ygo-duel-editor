import { ipcMain, shell, BrowserWindow, app } from 'electron'
import type { IpcMainInvokeEvent } from 'electron'
import { deckService } from '../services/deckService'
import { settingsWindowService } from '../services/settingsWindowService'
import { cardNoteService } from '../services/cardNoteService'
import { textLibraryWindowService } from '../services/textLibraryWindowService'

const resolveSenderWindow = (event: IpcMainInvokeEvent): BrowserWindow | null =>
  BrowserWindow.fromWebContents(event.sender)

export function registerWindowIpc(): void {
  ipcMain.handle('app:get-version', () => {
    return app.getVersion()
  })

  ipcMain.handle('app:open-external', async (_, url: string) => {
    const target = String(url ?? '').trim()
    if (!/^https?:\/\//i.test(target)) return false
    await shell.openExternal(target)
    return true
  })

  ipcMain.handle('window:open-card-notes', async () => {
    cardNoteService.openWindow()
  })

  ipcMain.handle('window:open-text-library', async () => {
    textLibraryWindowService.openWindow()
  })

  ipcMain.handle('window:open-settings', async (_, section) => {
    settingsWindowService.openSettingsWindow(section)
  })

  ipcMain.handle('window:open-deck-editor', async (event, deckId?: string, createNew?: boolean) => {
    deckService.openDeckEditorWindow(
      deckId,
      createNew,
      !deckService.isDeckEditorSender(event.sender)
    )
  })

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
