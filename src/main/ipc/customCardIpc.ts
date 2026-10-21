import { ipcMain } from 'electron'
import { CustomCardInput } from '@shared/index'
import { customCardService } from '../services/customCardService'
import { imageService } from '../services/imageService'
import { openCustomScriptDir } from '../services/customCardLibrary'
import { syncCustomCardsToGame } from '../services/customGameSync'
import { toErrorMessageOr } from '../utils/errors'

export function registerCustomCardIpc(): void {
  ipcMain.handle('customcard:list', () => {
    return customCardService.list()
  })

  ipcMain.handle('customcard:save', (_, input: CustomCardInput) => {
    try {
      const card = customCardService.save(input)
      imageService.invalidateCardImageCache()
      return { success: true, card }
    } catch (err) {
      console.error('[registerIpc] customcard:save failed:', err)
      return { success: false, error: toErrorMessageOr(err, '保存失败') }
    }
  })

  ipcMain.handle('customcard:delete', (_, id: number) => {
    try {
      customCardService.remove(id)
      imageService.invalidateCardImageCache()
      return { success: true }
    } catch (err) {
      console.error('[registerIpc] customcard:delete failed:', err)
      return { success: false, error: toErrorMessageOr(err, '删除失败') }
    }
  })

  ipcMain.handle('customcard:pick-image', async () => {
    return customCardService.pickImageSource()
  })

  ipcMain.handle('customcard:apply-image', async (_, id: number) => {
    const result = await customCardService.pickAndApplyImage(id)
    if (result.success) imageService.invalidateCardImageCache()
    return result
  })

  ipcMain.handle('customcard:script-info', (_, code: number) => {
    return customCardService.scriptInfo(code)
  })

  ipcMain.handle('customcard:pick-script', async (_, code: number) => {
    return customCardService.pickScript(code)
  })

  ipcMain.handle('customcard:delete-script', (_, code: number) => {
    return customCardService.deleteScript(code)
  })

  ipcMain.handle('customcard:open-script-dir', async () => {
    await openCustomScriptDir()
  })

  ipcMain.handle('customcard:sync-to-game', () => {
    return syncCustomCardsToGame()
  })
}
