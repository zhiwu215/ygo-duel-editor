import { ipcMain } from 'electron'
import { dirname } from 'path'
import { CardSearchParams, ExtraCdbCandidate, ExtraCdbLanguageInfo } from '@shared/index'
import { cdbService } from '../db/cdbService'
import { isValidCdb, readCdbCardCount } from '../db/cdbConnections'
import { configService } from '../services/configService'
import { favoritesService } from '../services/favoritesService'
import {
  collectFolderCdbPaths,
  currentBundledCdbPaths,
  customSyncCdbInfo,
  enabledExtraCdbPaths
} from '../services/gameContent'
import {
  currentLanguagePacks,
  extraLanguageFor,
  rememberExtraLanguage
} from '../services/extraCdbLanguage'
import { invalidateScriptReaders } from '../services/duel/ocgcore-engine'
import { imageService } from '../services/imageService'
import { customCardService } from '../services/customCardService'
import { customCdbPath } from '../services/customCardLibrary'
import { ygoproLauncher } from '../services/ygoproLauncher'
import { broadcastToWindows } from '../services/broadcast'

function reloadExtraLibraries(): void {
  cdbService.reloadAll(
    configService.get().cdbPath,
    currentBundledCdbPaths(),
    enabledExtraCdbPaths(),
    currentLanguagePacks()
  )
}

export function registerCdbIpc(): void {
  ipcMain.handle('cdb:search', async (_, params: CardSearchParams) => {
    const favorites = params.onlyFavorites
      ? favoritesService.getCodesFor(params.favoriteCategoryId)
      : undefined
    const custom = customCardService.searchRows(params, Number.MAX_SAFE_INTEGER, favorites)
    return cdbService.search(params, favorites, {
      ...custom,
      revision: customCardService.getRevision()
    })
  })

  ipcMain.handle('cdb:search-filter-options', () => cdbService.getSearchFilterOptions())

  ipcMain.handle('cdb:set-banlist', (_, name: string | null) => {
    cdbService.setPreferredBanlist(name ?? undefined)
    configService.save({ banlistName: name ?? undefined })
    return cdbService.getSearchFilterOptions()
  })

  ipcMain.handle('cdb:get-by-ids', async (_, ids: number[]) => {
    return customCardService.mergeCardsByIds(cdbService.getCardsByIds(ids), ids)
  })

  ipcMain.handle('cdb:status', () => {
    const extraLanguages: Record<string, ExtraCdbLanguageInfo> = {}
    for (const path of configService.get().extraCdbPaths || []) {
      const info = extraLanguageFor(path)
      if (info) extraLanguages[path] = info
    }
    return {
      ready: cdbService.isReady(),
      path: cdbService.getCurrentPath(),
      loadedPaths: cdbService.getLoadedPaths(),
      customCdbPath: customCdbPath(),
      libraries: cdbService.listLibraries(),
      customSyncCdb: customSyncCdbInfo(),
      extraLanguages
    }
  })

  ipcMain.handle('cdb:pick-extra', async () => {
    const packDir = await ygoproLauncher.selectExtraPack()
    if (!packDir) {
      return { success: false, canceled: true }
    }
    const candidates = collectFolderCdbPaths(packDir)
    if (candidates.length === 0) {
      return { success: false, error: '该文件夹内未找到卡库文件 (.cdb)' }
    }
    const configured = new Set(
      (configService.get().extraCdbPaths || []).map((path) => path.toLowerCase())
    )
    const files: ExtraCdbCandidate[] = []
    for (const path of candidates) {
      const cardCount = readCdbCardCount(path)
      if (cardCount === null) continue
      files.push({ path, cardCount, added: configured.has(path.toLowerCase()) })
    }
    if (files.length === 0) {
      return { success: false, error: '该文件夹内没有有效的卡库 (缺少 datas/texts 表)' }
    }
    return { success: true, directory: packDir, files }
  })

  ipcMain.handle('cdb:add-extra', async (_, paths: string[]) => {
    const requested = [...new Set(paths ?? [])].filter(
      (path): path is string => typeof path === 'string' && path.length > 0
    )
    if (requested.length === 0) {
      return { success: false, error: '未选择任何卡库' }
    }
    const loaded = requested.filter((path) => isValidCdb(path))
    if (loaded.length === 0) {
      return { success: false, error: '所选文件不是有效的卡库 (缺少 datas/texts 表)' }
    }

    const cfg = configService.get()
    const merged = [...(cfg.extraCdbPaths || []).filter((p) => !loaded.includes(p)), ...loaded]
    configService.save({ extraCdbPaths: merged })
    reloadExtraLibraries()
    broadcastToWindows('cdb:updated')
    invalidateScriptReaders()
    const picsDirs = new Set<string>()
    for (const p of loaded) {
      for (const dir of imageService.detectPicsDirsFromCdb(p)) picsDirs.add(dir)
    }
    return {
      success: true,
      path: dirname(loaded[0]),
      paths: loaded,
      picsDetected: picsDirs.size > 0,
      extraLanguage: loaded.map((path) => extraLanguageFor(path)).find((info) => info) ?? undefined
    }
  })

  ipcMain.handle('cdb:remove-extra', async (_, cdbPath: string) => {
    const cfg = configService.get()
    const extras = (cfg.extraCdbPaths || []).filter((p) => p !== cdbPath)
    const disabledCdbPaths = (cfg.disabledCdbPaths || []).filter((p) => p !== cdbPath)
    configService.save({ extraCdbPaths: extras, disabledCdbPaths })
    reloadExtraLibraries()
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
    reloadExtraLibraries()
    broadcastToWindows('cdb:updated')
    invalidateScriptReaders()
    return { success: true, paths: cdbService.getLoadedPaths() }
  })

  ipcMain.handle('cdb:set-extra-language', async (_, root: string, languageId: string) => {
    if (!rememberExtraLanguage(root, languageId)) {
      return { success: false, error: '该语言包不存在' }
    }
    reloadExtraLibraries()
    broadcastToWindows('cdb:updated')
    invalidateScriptReaders()
    return { success: true }
  })

  ipcMain.handle('image:set-card-override', async (_, code: number, variantCode: number | null) => {
    try {
      imageService.setCardImageOverride(code, variantCode)
      imageService.invalidateCardImageCache()
      broadcastToWindows('image:updated')
      return true
    } catch (err) {
      console.error('[registerIpc] image:set-card-override failed:', err)
      return false
    }
  })
}
