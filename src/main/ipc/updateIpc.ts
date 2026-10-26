import { ipcMain } from 'electron'
import { updateService } from '../services/updateService'

export function registerUpdateIpc(): void {
  ipcMain.handle('update:get-state', () => updateService.currentState)
  ipcMain.handle('update:check', () => updateService.check())
  ipcMain.handle('update:download', () => updateService.download())
  ipcMain.handle('update:install', () => updateService.install())
}
