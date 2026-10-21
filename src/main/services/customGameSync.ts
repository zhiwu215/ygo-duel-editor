import { copyFileSync, existsSync, mkdirSync, readFileSync, statSync } from 'fs'
import { dirname, extname, join } from 'path'
import { CustomCardSyncResult, customPoolMask } from '@shared/index'
import { configService } from './configService'
import { customCardService } from './customCardService'
import { getCustomScriptInfo, writeCustomCardsCdb } from './customCardLibrary'
import { cdbService } from '../db/cdbService'
import { CUSTOM_CDB_NAME, invalidateGameContentScan } from './gameContent'
import { broadcastToWindows } from './broadcast'

function filesDiffer(source: string, target: string): boolean {
  try {
    if (statSync(source).size !== statSync(target).size) return true
    return !readFileSync(target).equals(readFileSync(source))
  } catch {
    return true
  }
}

function placeFile(source: string, target: string): boolean {
  if (existsSync(target) && !filesDiffer(source, target)) return false
  mkdirSync(dirname(target), { recursive: true })
  copyFileSync(source, target)
  return true
}

function gameImageName(code: number, source: string): string {
  const ext = extname(source).toLocaleLowerCase()
  return `${code}${ext === '.jpeg' ? '.jpg' : ext}`
}

export async function syncCustomCardsToGame(): Promise<CustomCardSyncResult> {
  const gameDirectory = configService.get().gameDirectory
  if (!gameDirectory) {
    return { success: false, error: '未配置游戏目录', cdb: false, scripts: 0, pics: 0 }
  }

  const expansionsDir = join(gameDirectory, 'expansions')
  const scriptDir = join(expansionsDir, 'script')
  const picsDir = join(expansionsDir, 'pics')
  const result: CustomCardSyncResult = { success: true, cdb: false, scripts: 0, pics: 0 }

  try {
    const cards = customCardService.list()
    await writeCustomCardsCdb(
      cards,
      join(expansionsDir, CUSTOM_CDB_NAME),
      customPoolMask(cdbService.getPoolSchema())
    )
    result.cdb = true

    for (const card of cards) {
      const script = getCustomScriptInfo(card.id)
      if (script.exists && script.path) {
        if (placeFile(script.path, join(scriptDir, script.fileName))) result.scripts++
      }
      const image = customCardService.findImagePath(card.id)
      if (image) {
        if (placeFile(image, join(picsDir, gameImageName(card.id, image)))) result.pics++
      }
    }
    invalidateGameContentScan(gameDirectory)
    broadcastToWindows('cdb:updated')
    return result
  } catch (err) {
    console.error('[CustomGameSync] Failed to sync custom cards to game:', err)
    return { success: false, error: '同步到游戏目录失败', cdb: false, scripts: 0, pics: 0 }
  }
}
