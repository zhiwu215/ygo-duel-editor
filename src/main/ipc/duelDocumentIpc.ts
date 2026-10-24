import { ipcMain } from 'electron'
import { DuelDocument } from '@shared/index'
import { duelDocumentService } from '../services/duelDocumentService'

export function registerDuelDocumentIpc(): void {
  ipcMain.handle('duel-document:tree', () => duelDocumentService.listTree())

  ipcMain.handle('duel-document:read', (_, filePath: string) =>
    duelDocumentService.readDocument(filePath)
  )

  ipcMain.handle('duel-document:save', (_, filePath: string, document: DuelDocument) =>
    duelDocumentService.saveDocument(filePath, document)
  )

  ipcMain.handle('duel-document:create', (_, folderPath: string, document: DuelDocument) =>
    duelDocumentService.createDocument(folderPath, document)
  )

  ipcMain.handle('duel-document:save-dialog', (_, document: DuelDocument) =>
    duelDocumentService.saveDocumentDialog(document)
  )

  ipcMain.handle('duel-document:open-dialog', () => duelDocumentService.openDocumentDialog())

  ipcMain.handle('duel-document:create-folder', (_, parentPath: string, name: string) =>
    duelDocumentService.createFolder(parentPath, name)
  )

  ipcMain.handle('duel-document:rename-folder', (_, folderPath: string, name: string) =>
    duelDocumentService.renameFolder(folderPath, name)
  )

  ipcMain.handle('duel-document:delete-folder', (_, folderPath: string) =>
    duelDocumentService.deleteFolder(folderPath)
  )

  ipcMain.handle('duel-document:rename', (_, filePath: string, title: string) =>
    duelDocumentService.renameDocument(filePath, title)
  )

  ipcMain.handle('duel-document:move', (_, filePath: string, targetFolder: string) =>
    duelDocumentService.moveDocument(filePath, targetFolder)
  )

  ipcMain.handle('duel-document:delete', (_, filePath: string) =>
    duelDocumentService.deleteDocument(filePath)
  )
}
