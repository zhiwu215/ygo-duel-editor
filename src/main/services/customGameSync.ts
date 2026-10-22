import { shell } from 'electron'
import {
  copyFileSync,
  existsSync,
  mkdirSync,
  readFileSync,
  rmSync,
  statSync,
  writeFileSync
} from 'fs'
import { dirname, extname, isAbsolute, join, relative, resolve, sep } from 'path'
import { CustomCardOpenDirResult, CustomCardSyncResult, customPoolMask } from '@shared/index'
import { configService } from './configService'
import { customCardService } from './customCardService'
import { writeCustomCardsCdb } from './customCardLibrary'
import { getCustomScriptInfo } from './customCardScript'
import { cdbService } from '../db/cdbService'
import { CUSTOM_CDB_NAME, invalidateGameContentScan } from './gameContent'
import { broadcastToWindows } from './broadcast'

const MANIFEST_NAME = '.yde-custom-sync.json'

interface SyncManifest {
  version: 1
  cdb: string | null
  scripts: string[]
  pics: string[]
}

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

function toRelative(expansionsDir: string, absolutePath: string): string {
  return relative(expansionsDir, absolutePath).split(sep).join('/')
}

function isManagedPath(relativePath: string): boolean {
  if (relativePath === CUSTOM_CDB_NAME) return true
  if (/^script\/c\d+\.lua$/i.test(relativePath)) return true
  return /^pics\/\d+\.(png|jpe?g|webp|gif)$/i.test(relativePath)
}

function resolveManagedPath(expansionsDir: string, relativePath: string): string | null {
  if (!isManagedPath(relativePath)) return null
  const absolutePath = resolve(expansionsDir, relativePath)
  const back = relative(expansionsDir, absolutePath)
  if (!back || back.startsWith('..') || isAbsolute(back)) return null
  return absolutePath
}

function readManifest(path: string): SyncManifest {
  const empty: SyncManifest = { version: 1, cdb: null, scripts: [], pics: [] }
  if (!existsSync(path)) return empty
  try {
    const parsed = JSON.parse(readFileSync(path, 'utf-8')) as Partial<SyncManifest>
    return {
      version: 1,
      cdb: typeof parsed.cdb === 'string' ? parsed.cdb : null,
      scripts: Array.isArray(parsed.scripts)
        ? parsed.scripts.filter((entry): entry is string => typeof entry === 'string')
        : [],
      pics: Array.isArray(parsed.pics)
        ? parsed.pics.filter((entry): entry is string => typeof entry === 'string')
        : []
    }
  } catch (err) {
    console.error('[CustomGameSync] Failed to read sync manifest:', err)
    return empty
  }
}

function writeManifest(path: string, manifest: SyncManifest): void {
  try {
    writeFileSync(path, JSON.stringify(manifest, null, 2), 'utf-8')
  } catch (err) {
    console.error('[CustomGameSync] Failed to write sync manifest:', err)
  }
}

function removeManagedFile(expansionsDir: string, relativePath: string): boolean {
  const target = resolveManagedPath(expansionsDir, relativePath)
  if (!target || !existsSync(target)) return false
  try {
    rmSync(target)
    return true
  } catch (err) {
    console.error('[CustomGameSync] Failed to remove managed file:', err)
    return false
  }
}

export async function openCustomCardSyncDirectory(): Promise<CustomCardOpenDirResult> {
  const gameDirectory = configService.get().gameDirectory
  if (!gameDirectory) return { success: false, error: '未配置游戏目录' }
  if (!existsSync(gameDirectory)) return { success: false, error: '游戏目录不存在' }
  const expansionsDir = join(gameDirectory, 'expansions')
  try {
    mkdirSync(expansionsDir, { recursive: true })
  } catch (err) {
    console.error('[CustomGameSync] Failed to create expansions directory:', err)
    return { success: false, error: '创建同步目录失败' }
  }
  const error = await shell.openPath(expansionsDir)
  return error ? { success: false, error } : { success: true }
}

export async function syncCustomCardsToGame(): Promise<CustomCardSyncResult> {
  const gameDirectory = configService.get().gameDirectory
  if (!gameDirectory) {
    return { success: false, error: '未配置游戏目录', cdb: false, scripts: 0, pics: 0, removed: 0 }
  }

  const expansionsDir = join(gameDirectory, 'expansions')
  const scriptDir = join(expansionsDir, 'script')
  const picsDir = join(expansionsDir, 'pics')
  const manifestPath = join(expansionsDir, MANIFEST_NAME)
  const previous = readManifest(manifestPath)
  const desired = new Set<string>()
  const result: CustomCardSyncResult = {
    success: true,
    cdb: false,
    scripts: 0,
    pics: 0,
    removed: 0
  }

  try {
    const cards = customCardService.list()
    await writeCustomCardsCdb(
      cards,
      join(expansionsDir, CUSTOM_CDB_NAME),
      customPoolMask(cdbService.getPoolSchema())
    )
    result.cdb = true
    desired.add(CUSTOM_CDB_NAME)

    for (const card of cards) {
      const script = getCustomScriptInfo(card.id)
      if (script.exists && script.path) {
        const target = join(scriptDir, script.fileName)
        if (placeFile(script.path, target)) result.scripts++
        desired.add(toRelative(expansionsDir, target))
      }
      const image = customCardService.findImagePath(card.id)
      if (image) {
        const target = join(picsDir, gameImageName(card.id, image))
        if (placeFile(image, target)) result.pics++
        desired.add(toRelative(expansionsDir, target))
      }
    }

    for (const relativePath of [...previous.scripts, ...previous.pics]) {
      if (desired.has(relativePath)) continue
      if (removeManagedFile(expansionsDir, relativePath)) result.removed++
    }

    writeManifest(manifestPath, {
      version: 1,
      cdb: CUSTOM_CDB_NAME,
      scripts: [...desired].filter((entry) => entry.startsWith('script/')),
      pics: [...desired].filter((entry) => entry.startsWith('pics/'))
    })
    invalidateGameContentScan(gameDirectory)
    broadcastToWindows('cdb:updated')
    return result
  } catch (err) {
    console.error('[CustomGameSync] Failed to sync custom cards to game:', err)
    return {
      success: false,
      error: '同步到游戏目录失败',
      cdb: false,
      scripts: 0,
      pics: 0,
      removed: 0
    }
  }
}

export async function cleanCustomCardsFromGame(): Promise<CustomCardSyncResult> {
  const gameDirectory = configService.get().gameDirectory
  if (!gameDirectory) {
    return { success: false, error: '未配置游戏目录', cdb: false, scripts: 0, pics: 0, removed: 0 }
  }

  const expansionsDir = join(gameDirectory, 'expansions')
  const manifestPath = join(expansionsDir, MANIFEST_NAME)
  const manifest = readManifest(manifestPath)
  const scripts = new Set<string>(manifest.scripts)
  const pics = new Set<string>(manifest.pics)

  for (const card of customCardService.list()) {
    const script = getCustomScriptInfo(card.id)
    if (script.exists) scripts.add(`script/${script.fileName}`)
    const image = customCardService.findImagePath(card.id)
    if (image) pics.add(`pics/${gameImageName(card.id, image)}`)
  }

  let removedScripts = 0
  let removedPics = 0
  let cdbRemoved = false
  for (const relativePath of scripts) {
    if (removeManagedFile(expansionsDir, relativePath)) removedScripts++
  }
  for (const relativePath of pics) {
    if (removeManagedFile(expansionsDir, relativePath)) removedPics++
  }
  if (removeManagedFile(expansionsDir, CUSTOM_CDB_NAME)) cdbRemoved = true
  if (existsSync(manifestPath)) {
    try {
      rmSync(manifestPath)
    } catch (err) {
      console.error('[CustomGameSync] Failed to remove sync manifest:', err)
    }
  }

  invalidateGameContentScan(gameDirectory)
  broadcastToWindows('cdb:updated')
  return {
    success: true,
    cdb: cdbRemoved,
    scripts: removedScripts,
    pics: removedPics,
    removed: removedScripts + removedPics + (cdbRemoved ? 1 : 0)
  }
}
