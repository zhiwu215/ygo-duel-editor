import { ipcMain, dialog, BrowserWindow } from 'electron'
import { libraryService } from '../services/libraryService'

export function registerLibraryIpc(): void {
  ipcMain.handle('library:text-list', async () => {
    return libraryService.getTextList()
  })

  ipcMain.handle('library:text-import', async () => {
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
    return libraryService.importTextFile(picked.filePaths)
  })

  ipcMain.handle('library:text-chapters', async (_, textId: string) => {
    return libraryService.getTextChapters(textId)
  })

  ipcMain.handle('library:text-chapter-content', async (_, textId: string, chapterId: string) => {
    return libraryService.getTextChapterContent(textId, chapterId)
  })

  ipcMain.handle(
    'library:text-chapter-update',
    async (_, textId: string, chapterId: string, content: string) => {
      return libraryService.updateTextChapterContent(textId, chapterId, content)
    }
  )

  ipcMain.handle(
    'library:text-chapter-title-update',
    async (_, textId: string, chapterId: string, title: string) => {
      return libraryService.updateTextChapterTitle(textId, chapterId, title)
    }
  )

  ipcMain.handle('library:text-delete', async (_, id: string) => {
    return libraryService.deleteText(id)
  })

  ipcMain.handle('library:text-resplit', async (_, id: string) => {
    return libraryService.resplitText(id)
  })
}
