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
import {
  CustomCard,
  CustomCardOpenDirResult,
  CustomCardSyncResult,
  CustomCardSyncTarget,
  customPoolMask
} from '@shared/index'
import { configService } from './configService'
import { customCardService } from './customCardService'
import { writeGameCardCdb } from './customCardLibrary'
import { getCustomScriptInfo } from './customCardScript'
import { cdbService } from '../db/cdbService'
import {
  checkGameContentCoverage,
  CUSTOM_CDB_NAME,
  invalidateGameContentScan,
  type GameType
} from './gameContent'
import { findExternalCardImage, findExternalCardScript, importableCard } from './externalCardImport'
import {
  placeholderGameCards,
  placeholderScript,
  placeholderScriptCodes
} from './placeholderGameCards'
import { broadcastToWindows } from './broadcast'

const MANIFEST_NAME = '.yde-custom-sync.json'

interface SyncManifest {
  version: 1
  cdb: string | null
  scripts: string[]
  pics: string[]
  cards: number[]
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

function placeContent(content: Buffer, target: string): boolean {
  if (existsSync(target) && readFileSync(target).equals(content)) return false
  mkdirSync(dirname(target), { recursive: true })
  writeFileSync(target, content)
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
  if (/^(?:\.\.\/)?script\/c\d+\.lua$/i.test(relativePath)) return true
  return /^(?:\.\.\/)?pics\/\d+\.(png|jpe?g|webp|gif)$/i.test(relativePath)
}

function resolveManagedPath(expansionsDir: string, relativePath: string): string | null {
  if (!isManagedPath(relativePath)) return null
  const absolutePath = resolve(expansionsDir, relativePath)
  const gameRoot = dirname(expansionsDir)
  const back = relative(gameRoot, absolutePath)
  if (!back || back.startsWith('..') || isAbsolute(back)) return null
  return absolutePath
}

interface SyncLayout {
  gameDirectory: string
  expansionsDir: string
  scriptDir: string
  picsDir: string
}

export interface CustomSyncTarget {
  gameDirectory: string
  gameType: 'ygopro' | 'mdpro3'
}

export interface CustomSyncOptions {
  cardIds?: number[]
}

function resolveSyncLayout(target?: CustomSyncTarget): SyncLayout | null {
  const config = configService.get()
  const gameDirectory = target?.gameDirectory ?? config.gameDirectory
  if (!gameDirectory) return null
  const mdpro3 = (target?.gameType ?? config.gameType) === 'mdpro3'
  const expansionsDir = join(gameDirectory, 'expansions')
  return {
    gameDirectory,
    expansionsDir,
    scriptDir: mdpro3 ? join(gameDirectory, 'script') : join(expansionsDir, 'script'),
    picsDir: mdpro3 ? join(gameDirectory, 'pics') : join(expansionsDir, 'pics')
  }
}

function readManifest(path: string): SyncManifest {
  const empty: SyncManifest = { version: 1, cdb: null, scripts: [], pics: [], cards: [] }
  if (!existsSync(path)) return empty
  const toList = (value: unknown): string[] =>
    Array.isArray(value) ? value.filter((entry): entry is string => typeof entry === 'string') : []
  try {
    const parsed = JSON.parse(readFileSync(path, 'utf-8')) as Partial<SyncManifest>
    return {
      version: 1,
      cdb: typeof parsed.cdb === 'string' ? parsed.cdb : null,
      scripts: toList(parsed.scripts),
      pics: toList(parsed.pics),
      cards: Array.isArray(parsed.cards)
        ? parsed.cards.filter((entry): entry is number => Number.isInteger(entry) && entry > 0)
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

export async function openCustomCardSyncDirectory(
  target: CustomCardSyncTarget
): Promise<CustomCardOpenDirResult> {
  const layout = resolveSyncLayout()
  if (!layout) return { success: false, error: '未配置游戏目录' }
  if (!existsSync(layout.gameDirectory)) return { success: false, error: '游戏目录不存在' }
  const directory =
    target === 'script'
      ? layout.scriptDir
      : target === 'pics'
        ? layout.picsDir
        : layout.expansionsDir
  try {
    mkdirSync(directory, { recursive: true })
  } catch (err) {
    console.error('[CustomGameSync] Failed to create sync directory:', err)
    return { success: false, error: '创建同步目录失败' }
  }
  const error = await shell.openPath(directory)
  return error ? { success: false, error } : { success: true }
}

function importedCardsFor(ids: Set<number>, customIds: Set<number>): CustomCard[] {
  const cards: CustomCard[] = []
  for (const id of ids) {
    if (customIds.has(id)) continue
    const card = importableCard(id)
    if (card) cards.push(card)
  }
  return cards
}

async function resolveRequestedImport(
  gameDirectory: string,
  gameType: GameType,
  requested: number[]
): Promise<{ dataIds: number[]; scriptIds: number[] }> {
  if (requested.length === 0) return { dataIds: [], scriptIds: [] }
  const coverage = await checkGameContentCoverage(gameDirectory, gameType, requested)
  return { dataIds: coverage.missingDataIds, scriptIds: coverage.missingScriptIds }
}

export async function syncCustomCardsToGame(
  target?: CustomSyncTarget,
  options?: CustomSyncOptions
): Promise<CustomCardSyncResult> {
  const layout = resolveSyncLayout(target)
  if (!layout) {
    return { success: false, error: '未配置游戏目录', cdb: false, scripts: 0, pics: 0, removed: 0 }
  }

  const { gameDirectory, expansionsDir, scriptDir, picsDir } = layout
  const gameType: GameType = target?.gameType ?? configService.get().gameType ?? 'ygopro'
  const manifestPath = join(expansionsDir, MANIFEST_NAME)
  const previous = readManifest(manifestPath)
  const desiredScripts = new Set<string>()
  const desiredPics = new Set<string>()
  const result: CustomCardSyncResult = {
    success: true,
    cdb: false,
    scripts: 0,
    pics: 0,
    removed: 0,
    cards: 0
  }

  try {
    const cards = customCardService.list()
    const customIds = new Set(cards.map((card) => card.id))
    const requested = [...new Set(options?.cardIds ?? [])].filter(
      (id) => Number.isInteger(id) && id > 0 && !customIds.has(id)
    )

    const importedIds = new Set<number>(previous.cards)
    const scriptOnlyIds = new Set<number>()
    const requestedImport = await resolveRequestedImport(gameDirectory, gameType, requested)
    for (const id of requestedImport.dataIds) importedIds.add(id)
    for (const id of requestedImport.scriptIds) scriptOnlyIds.add(id)

    const importedCards = importedCardsFor(importedIds, customIds)

    await writeGameCardCdb(
      [...cards, ...placeholderGameCards()],
      importedCards,
      join(expansionsDir, CUSTOM_CDB_NAME),
      customPoolMask(cdbService.getPoolSchema())
    )
    result.cdb = true
    result.cards = importedCards.length

    for (const card of cards) {
      const script = getCustomScriptInfo(card.id)
      if (script.exists && script.path) {
        const target = join(scriptDir, script.fileName)
        if (placeFile(script.path, target)) result.scripts++
        desiredScripts.add(toRelative(expansionsDir, target))
      }
      const image = customCardService.findImagePath(card.id)
      if (image) {
        const target = join(picsDir, gameImageName(card.id, image))
        if (placeFile(image, target)) result.pics++
        desiredPics.add(toRelative(expansionsDir, target))
      }
    }

    mkdirSync(scriptDir, { recursive: true })
    for (const code of placeholderScriptCodes()) {
      const placeholderScriptPath = join(scriptDir, `c${code}.lua`)
      writeFileSync(placeholderScriptPath, placeholderScript(), 'utf-8')
      result.scripts++
      desiredScripts.add(toRelative(expansionsDir, placeholderScriptPath))
    }

    const importTargets = [...new Set([...importedCards.map((card) => card.id), ...scriptOnlyIds])]
    for (const id of importTargets) {
      const script = findExternalCardScript(id)
      if (script) {
        const target = join(scriptDir, script.fileName)
        if (placeContent(script.content, target)) result.scripts++
        desiredScripts.add(toRelative(expansionsDir, target))
      }
      const image = findExternalCardImage(id)
      if (image) {
        const target = join(picsDir, gameImageName(id, image))
        if (placeFile(image, target)) result.pics++
        desiredPics.add(toRelative(expansionsDir, target))
      }
    }

    for (const relativePath of [...previous.scripts, ...previous.pics]) {
      if (desiredScripts.has(relativePath) || desiredPics.has(relativePath)) continue
      if (removeManagedFile(expansionsDir, relativePath)) result.removed++
    }

    writeManifest(manifestPath, {
      version: 1,
      cdb: CUSTOM_CDB_NAME,
      scripts: [...desiredScripts],
      pics: [...desiredPics],
      cards: importedCards.map((card) => card.id)
    })
    invalidateGameContentScan(gameDirectory)
    broadcastToWindows('cdb:updated')
    return result
  } catch (err) {
    console.error('[CustomGameSync] Failed to sync custom cards to game:', err)
    return { ...result, success: false, error: '同步到游戏目录失败' }
  }
}

export async function cleanCustomCardsFromGame(): Promise<CustomCardSyncResult> {
  const layout = resolveSyncLayout()
  if (!layout) {
    return { success: false, error: '未配置游戏目录', cdb: false, scripts: 0, pics: 0, removed: 0 }
  }

  const { gameDirectory, expansionsDir, scriptDir, picsDir } = layout
  const manifestPath = join(expansionsDir, MANIFEST_NAME)
  const manifest = readManifest(manifestPath)
  const scripts = new Set<string>(manifest.scripts)
  const pics = new Set<string>(manifest.pics)

  for (const card of customCardService.list()) {
    const script = getCustomScriptInfo(card.id)
    if (script.exists) scripts.add(toRelative(expansionsDir, join(scriptDir, script.fileName)))
    const image = customCardService.findImagePath(card.id)
    if (image) {
      pics.add(toRelative(expansionsDir, join(picsDir, gameImageName(card.id, image))))
    }
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
