import { ipcMain } from 'electron'
import { existsSync } from 'fs'
import { dirname, join } from 'path'
import { GameLanguageOption } from '@shared/index'
import { cdbService } from '../db/cdbService'
import { configService } from '../services/configService'
import {
  currentBundledCdbPaths,
  discoverGameCdbPaths,
  discoverGameLanguagePacks,
  isCustomSyncCdbPath,
  listMdpro3Locales,
  readGameConfigLanguage,
  resolveGameLanguagePack
} from '../services/gameContent'
import { invalidateScriptReaders } from '../services/duel/ocgcore-engine'
import { imageService } from '../services/imageService'
import { ygoproLauncher } from '../services/ygoproLauncher'
import { broadcastToWindows } from '../services/broadcast'
import { enabledExtraPaths } from './cdbIpc'

type GameType = 'ygopro' | 'mdpro3'

const YGO_LANGUAGE_DETAILS: Record<string, string> = {
  en: '卡名/效果：英文；系列名等系统文本：繁中',
  English: '卡名/效果：英文；系列名等系统文本：英文'
}

function gameLanguageOptions(gameDir: string, gameType: GameType): GameLanguageOption[] {
  if (gameType === 'mdpro3') return listMdpro3Locales(gameDir)
  if (gameType === 'ygopro') {
    return discoverGameLanguagePacks(gameDir).map((pack) => ({
      id: pack.id,
      detail: YGO_LANGUAGE_DETAILS[pack.id]
    }))
  }
  return []
}

export function registerConfigIpc(): void {
  ipcMain.handle('config:get', async () => {
    return configService.get()
  })

  ipcMain.handle('config:save', async (_, partial) => {
    return configService.save(partial)
  })

  ipcMain.handle('config:select-ygo-dir', async () => {
    const dir = await ygoproLauncher.selectGameDirectory()
    if (!dir) {
      return { success: false }
    }
    const gameType = ygoproLauncher.detectGameType(dir)
    if (!gameType) {
      return {
        success: false,
        error:
          '未在该目录下找到游戏主程序 (如 ygopro.exe、EDOPro.exe、MDPro3.exe)，请确认选择的是游戏主目录'
      }
    }
    const { primary: discoveredPrimary, additional } = discoverGameCdbPaths(dir, gameType)
    if (!discoveredPrimary) {
      return {
        success: false,
        error:
          gameType === 'mdpro3'
            ? '未在 Data/locales 下找到 cards.cdb，请确认该 MDPro3 目录完整'
            : '未在该目录下找到 cards.cdb (含 cdb/ 与 expansions/ 子目录)，请确认选择的是游戏主目录'
      }
    }
    let primary = discoveredPrimary
    const options = gameLanguageOptions(dir, gameType)
    let languagePack: { id: string; dir?: string; cdbPaths: string[] } | null = null
    let defaultLanguage: string | undefined
    let askLanguage = false
    const preferred = configService.get().preferredLanguage
    const preferredOption = preferred ? options.find((o) => o.id === preferred) : undefined
    if (options.length > 1) {
      if (gameType === 'mdpro3') {
        if (preferredOption?.detail && existsSync(preferredOption.detail)) {
          primary = preferredOption.detail
        } else {
          askLanguage = true
        }
      } else {
        const packs = discoverGameLanguagePacks(dir)
        const preferredPack = resolveGameLanguagePack(packs, preferred)
        if (preferredPack && preferredPack.id === preferred) {
          languagePack = preferredPack
          defaultLanguage = preferredPack.id
        } else {
          const pack = resolveGameLanguagePack(packs, readGameConfigLanguage(dir))
          if (pack) {
            languagePack = pack
            defaultLanguage = pack.id
          }
          askLanguage = true
        }
      }
    }
    cdbService.setGameDirectory(dir)
    const ok = cdbService.open(
      primary,
      additional.filter((p) => !isCustomSyncCdbPath(p)),
      enabledExtraPaths(),
      languagePack
    )
    if (!ok) {
      return { success: false, error: 'cards.cdb 加载失败，文件可能已损坏' }
    }
    configService.save({
      gameDirectory: dir,
      cdbPath: primary,
      gameType,
      gameLanguage: defaultLanguage
    })
    invalidateScriptReaders()
    broadcastToWindows('cdb:updated')
    return {
      success: true,
      path: dir,
      languageOptions: askLanguage ? options : undefined,
      artOnlyImages: gameType === 'mdpro3' && imageService.classifyCardImageDir(dir) === 'art'
    }
  })

  ipcMain.handle('config:select-card-image-dir', async () => {
    const dir = await ygoproLauncher.selectCardImageDirectory()
    if (!dir) {
      return { success: false, canceled: true }
    }
    const picsDir = imageService.resolveCardImageDir(dir)
    if (!picsDir) {
      return {
        success: false,
        error:
          '未在该目录下找到卡图：请选择 YGOPro 的 pics 文件夹，或包含 pics / Picture\\Art 的游戏目录'
      }
    }
    configService.save({ cardImageDirectory: picsDir })
    broadcastToWindows('image:updated')
    return { success: true, path: picsDir }
  })

  ipcMain.handle('config:set-card-image-dir', async (_, dir: string | null) => {
    try {
      configService.save({ cardImageDirectory: dir || undefined })
      broadcastToWindows('image:updated')
      return true
    } catch (err) {
      console.error('[registerConfigIpc] set card image dir failed:', err)
      return false
    }
  })

  ipcMain.handle('config:game-language-options', () => {
    const cfg = configService.get()
    if (!cfg.gameDirectory || !cfg.gameType) return []
    return gameLanguageOptions(cfg.gameDirectory, cfg.gameType)
  })

  ipcMain.handle('config:set-game-language', async (_, languageId: string) => {
    const cfg = configService.get()
    if (!cfg.gameDirectory || !cfg.cdbPath || !cfg.gameType) {
      return { success: false, error: '当前未设置游戏主目录' }
    }
    if (cfg.gameType === 'mdpro3') {
      const localeDir = join(cfg.gameDirectory, 'Data', 'locales', languageId)
      if (
        dirname(localeDir).toLowerCase() !==
        join(cfg.gameDirectory, 'Data', 'locales').toLowerCase()
      ) {
        return { success: false, error: '无效的语言目录' }
      }
      const cdbPath = join(localeDir, 'cards.cdb')
      if (!existsSync(cdbPath)) {
        return { success: false, error: '该语言卡库不存在，可能已被删除' }
      }
      cdbService.setGameDirectory(cfg.gameDirectory)
      const ok = cdbService.open(cdbPath, [], enabledExtraPaths())
      if (!ok) {
        return { success: false, error: '该语言卡库加载失败，文件可能已损坏' }
      }
      configService.save({ cdbPath, preferredLanguage: languageId })
    } else if (cfg.gameType === 'ygopro') {
      const pack = resolveGameLanguagePack(discoverGameLanguagePacks(cfg.gameDirectory), languageId)
      if (!pack || pack.id !== languageId) {
        return { success: false, error: '该语言包不存在' }
      }
      const ok = cdbService.open(cfg.cdbPath, currentBundledCdbPaths(), enabledExtraPaths(), pack)
      if (!ok) {
        return { success: false, error: '语言包加载失败，文件可能已损坏' }
      }
      configService.save({ gameLanguage: languageId, preferredLanguage: languageId })
    } else {
      return { success: false, error: '当前游戏类型不支持语言切换' }
    }
    invalidateScriptReaders()
    broadcastToWindows('cdb:updated')
    return { success: true }
  })
}
