import { ipcMain } from 'electron'
import type { UpdateState } from '@shared/index'
import { updateService } from '../services/updateService'

export function registerUpdateIpc(
  checkForUpdates: (manual: boolean) => Promise<UpdateState>
): void {
  ipcMain.handle('update:get-state', () => updateService.currentState)
  ipcMain.handle('update:check', () => checkForUpdates(true))
  ipcMain.handle('update:download', () => updateService.download())
  ipcMain.handle('update:install', () => updateService.install())
}
