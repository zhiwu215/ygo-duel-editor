import { ipcMain } from 'electron'
import { screenplayWindowService } from '../services/screenplayWindowService'

export function registerScreenplayIpc(): void {
  ipcMain.handle('screenplay:open-window', () => screenplayWindowService.openWindow())
  ipcMain.handle('screenplay:request-state', (event) =>
    screenplayWindowService.forwardExcept(event.sender, 'screenplay:request-state')
  )
  ipcMain.handle('screenplay:push-state', (event, snapshot) =>
    screenplayWindowService.forwardExcept(event.sender, 'screenplay:state', snapshot)
  )
  ipcMain.handle('screenplay:edit', (event, edit) =>
    screenplayWindowService.forwardExcept(event.sender, 'screenplay:edit', edit)
  )
  ipcMain.handle('screenplay:preview', (event, stepId) =>
    screenplayWindowService.forwardExcept(event.sender, 'screenplay:preview', stepId)
  )
}
