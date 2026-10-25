import { BrowserWindow, ipcMain } from 'electron'
import { TextLibrarySaveRequest } from '@shared/index'
import { textLibraryService } from '../services/textLibraryService'

export function registerTextLibraryIpc(): void {
  ipcMain.handle('text-library:list', () => textLibraryService.listTree())

  ipcMain.handle('text-library:read', (_, relativePath: string) =>
    textLibraryService.readEntry(relativePath)
  )

  ipcMain.handle('text-library:save-screenplay', (_, request: TextLibrarySaveRequest) =>
    textLibraryService.saveScreenplay(request)
  )

  ipcMain.handle('text-library:update', (_, relativePath: string, content: string) =>
    textLibraryService.updateEntry(relativePath, content)
  )

  ipcMain.handle('text-library:delete', (_, relativePath: string) =>
    textLibraryService.deleteEntry(relativePath)
  )

  ipcMain.handle('text-library:delete-folder', (_, relativePath: string) =>
    textLibraryService.deleteFolder(relativePath)
  )

  ipcMain.handle('text-library:export-file', (event, relativePath: string) => {
    const window = BrowserWindow.fromWebContents(event.sender) ?? undefined
    return textLibraryService.exportEntry(relativePath, window)
  })
}
