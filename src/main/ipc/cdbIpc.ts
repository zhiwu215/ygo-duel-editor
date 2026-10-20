import { ipcMain } from 'electron'
import { CardSearchParams } from '@shared/index'
import { cdbService } from '../db/cdbService'
import { configService } from '../services/configService'
import {
  collectFolderCdbPaths,
  currentBundledCdbPaths,
  currentLanguagePack,
  customSyncCdbInfo
} from '../services/gameContent'
import { invalidateScriptReaders } from '../services/duel/ocgcore-engine'
import { imageService } from '../services/imageService'
import { customCardService } from '../services/customCardService'
import { customCdbPath } from '../services/customCardLibrary'
import { ygoproLauncher } from '../services/ygoproLauncher'
import { broadcastToWindows } from '../services/broadcast'

export const enabledExtraPaths = (): string[] => {
  const cfg = configService.get()
  const disabled = cfg.disabledCdbPaths || []
  return (cfg.extraCdbPaths || []).filter((p) => !disabled.includes(p))
}

export function registerCdbIpc(): void {
  ipcMain.handle('cdb:search', async (_, params: CardSearchParams) => {
    const favorites = params.onlyFavorites ? (configService.get().favorites || []) : undefined
    return customCardService.mergeSearchResults(
      cdbService.search(params, favorites),
      params,
      favorites
    )
  })

  ipcMain.handle('cdb:search-filter-options', () => cdbService.getSearchFilterOptions())

  ipcMain.handle('cdb:get-by-ids', async (_, ids: number[]) => {
    return customCardService.mergeCardsByIds(cdbService.getCardsByIds(ids), ids)
  })

  ipcMain.handle('cdb:status', () => {
    return {
      ready: cdbService.isReady(),
      path: cdbService.getCurrentPath(),
      loadedPaths: cdbService.getLoadedPaths(),
      customCdbPath: customCdbPath(),
      libraries: cdbService.listLibraries(),
      customSyncCdb: customSyncCdbInfo()
    }
  })

  ipcMain.handle('cdb:add-extra', async () => {
    const packDir = await ygoproLauncher.selectExtraPack()
    if (!packDir) {
      return { success: false }
    }
    const candidates = collectFolderCdbPaths(packDir)
    if (candidates.length === 0) {
      return { success: false, error: '该文件夹内未找到卡库文件 (.cdb)' }
    }
    const loaded = cdbService.addExtra(candidates)
    if (loaded.length === 0) {
      return { success: false, error: '该文件不是有效的卡库 (缺少 datas/texts 表)' }
    }

    const cfg = configService.get()
    const merged = [...(cfg.extraCdbPaths || []).filter((p) => !loaded.includes(p)), ...loaded]
    configService.save({ extraCdbPaths: merged })
    broadcastToWindows('cdb:updated')
    invalidateScriptReaders()
    const picsDirs = new Set<string>()
    for (const p of loaded) {
      for (const dir of imageService.detectPicsDirsFromCdb(p)) picsDirs.add(dir)
    }
    return {
      success: true,
      path: packDir,
      paths: loaded,
      picsDetected: picsDirs.size > 0
    }
  })

  ipcMain.handle('cdb:remove-extra', async (_, cdbPath: string) => {
    const cfg = configService.get()
    const extras = (cfg.extraCdbPaths || []).filter((p) => p !== cdbPath)
    const disabledCdbPaths = (cfg.disabledCdbPaths || []).filter((p) => p !== cdbPath)
    configService.save({ extraCdbPaths: extras, disabledCdbPaths })
    cdbService.reloadAll(
      cfg.cdbPath,
      currentBundledCdbPaths(),
      extras.filter((p) => !disabledCdbPaths.includes(p)),
      currentLanguagePack()
    )
    broadcastToWindows('cdb:updated')
    invalidateScriptReaders()
    return { success: true, paths: cdbService.getLoadedPaths() }
  })

  ipcMain.handle('cdb:set-extra-enabled', async (_, cdbPath: string, enabled: boolean) => {
    const cfg = configService.get()
    const current = cfg.disabledCdbPaths || []
    const disabledCdbPaths = enabled
      ? current.filter((p) => p !== cdbPath)
      : [...new Set([...current, cdbPath])]
    configService.save({ disabledCdbPaths })
    cdbService.reloadAll(
      cfg.cdbPath,
      currentBundledCdbPaths(),
      (cfg.extraCdbPaths || []).filter((p) => !disabledCdbPaths.includes(p)),
      currentLanguagePack()
    )
    broadcastToWindows('cdb:updated')
    invalidateScriptReaders()
    return { success: true, paths: cdbService.getLoadedPaths() }
  })

  ipcMain.handle('image:set-card-override', async (_, code: number, variantCode: number | null) => {
    try {
      imageService.setCardImageOverride(code, variantCode)
      broadcastToWindows('image:updated')
      return true
    } catch (err) {
      console.error('[registerIpc] image:set-card-override failed:', err)
      return false
    }
  })
}
