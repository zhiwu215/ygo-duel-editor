import { ipcMain } from 'electron'
import { dataDirService } from '../services/dataDirService'
import { customCardService } from '../services/customCardService'
import { libraryService } from '../services/libraryService'

const reloadDataServices = (): void => {
  customCardService.resetCache()
  libraryService.reloadDataDirectory()
}

export function registerDataDirIpc(): void {
  ipcMain.handle('data:get-default-dir', async () => {
    return dataDirService.defaultDirectory
  })

  ipcMain.handle('data:open-dir', async () => {
    return dataDirService.openDataDirectory()
  })

  ipcMain.handle('data:select-dir', async (_, migrate: boolean) => {
    const res = await dataDirService.selectDataDirectory(undefined, migrate)
    if (res && !res.error) reloadDataServices()
    return res
  })

  ipcMain.handle('data:reset-dir', async (_, migrate: boolean) => {
    const res = dataDirService.resetToDefault(migrate)
    reloadDataServices()
    return res
  })
}
