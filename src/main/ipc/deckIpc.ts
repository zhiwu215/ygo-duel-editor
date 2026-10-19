import { ipcMain } from 'electron'
import { deckService } from '../services/deckService'

export function registerDeckIpc(): void {
  ipcMain.handle('deck:consume-pending-edit', async () => {
    return deckService.consumePendingDeckToEdit()
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

  ipcMain.handle('favorites:get', async () => {
    return deckService.getFavorites()
  })

  ipcMain.handle('favorites:toggle', async (_, code: number) => {
    return deckService.toggleFavorite(code)
  })
}
