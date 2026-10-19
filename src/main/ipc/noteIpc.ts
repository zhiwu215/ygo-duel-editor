import { ipcMain } from 'electron'
import { CardNote, CardNoteKind } from '@shared/index'
import { cardNoteService } from '../services/cardNoteService'

export function registerNoteIpc(): void {
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
}
