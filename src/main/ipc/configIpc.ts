import { ipcMain } from 'electron'
import { AppConfig } from '@shared/index'
import { cdbService } from '../db/cdbService'
import { configService } from '../services/configService'
import { ygoproLauncher } from '../services/ygoproLauncher'
import { broadcastToWindows } from '../services/broadcast'
import { enabledExtraPaths } from './cdbIpc'

export function registerConfigIpc(): void {
  ipcMain.handle('config:get', async () => {
    return configService.get()
  })

  ipcMain.handle('config:save', async (_, partial: Partial<AppConfig>) => {
    return configService.save(partial)
  })

  ipcMain.handle('config:select-ygo-dir', async () => {
    const dir = await ygoproLauncher.selectGameDirectory()
    if (!dir) {
      return { success: false }
    }
    const cdbPath = ygoproLauncher.locateCardsCdb(dir)
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
    broadcastToWindows('cdb:updated')
    return { success: true, path: dir }
  })
}
