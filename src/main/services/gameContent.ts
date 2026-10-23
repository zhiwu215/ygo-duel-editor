import Database from 'better-sqlite3'
import { existsSync, readdirSync, readFileSync, statSync } from 'fs'
import { basename, dirname, join } from 'path'
import { DuelPuzzleState, GameLanguageOption } from '@shared/index'
import { configService } from './configService'
import { readZipEntryNames } from '../utils/zipEntryNames'

export type GameType = 'ygopro' | 'mdpro3'

export const DEFAULT_MDPRO3_LOCALE = 'zh-CN'

export interface GameCdbDiscovery {
  primary: string | null
  additional: string[]
}

export interface GameContentCoverage {
  missingDataIds: number[]
  missingScriptIds: number[]
}

interface GameContentScan {
  cdbPaths: string[]
  zipPaths: string[]
  fileScriptIds: Set<number>
  rootScriptIds: Set<number>
}

const SCRIPT_NAME_PATTERN = /(?:^|\/)c(\d+)\.lua$/i
const CLIENT_EXCLUDED_CDB_NAMES = new Set(['cards-skills-unofficial.cdb'])
const CDB_QUERY_CHUNK_SIZE = 500
const SCAN_MAX_DEPTH = 5
const ZIP_READ_LIMIT = 64 * 1024 * 1024
const TYPE_MONSTER = 0x1
const TYPE_NORMAL = 0x10
const TYPE_EFFECT = 0x20
const TYPE_TOKEN = 0x4000000
const SCAN_SKIP_DIRS = new Set([
  'pics',
  'hdpics',
  'sound',
  'textures',
  'fonts',
  'movies',
  'skin',
  'bgm',
  'windbot',
  'replay',
  'deck',
  'puzzles',
  'config',
  'lflists',
  'screenshot',
  'screenshots',
  '.git'
])

export function isGameProgramName(name: string): boolean {
  return /(?:ygo|pro|kcg)[^\\/]*\.exe$/i.test(name)
}

export function isKcgGameDirectory(gameDir: string | undefined): boolean {
  if (!gameDir) return false
  if (/kcg/i.test(basename(gameDir))) return true
  try {
    if (
      readdirSync(gameDir).some((name) => /kcg/i.test(name) && name.toLowerCase().endsWith('.exe'))
    ) {
      return true
    }
  } catch {}
  return (
    existsSync(join(gameDir, 'script', 'official')) &&
    existsSync(join(gameDir, 'repositories', 'kcg'))
  )
}

export function discoverGameCdbPaths(gameDir: string, gameType: GameType): GameCdbDiscovery {
  const scan = getGameContentScan(gameDir)
  if (gameType === 'mdpro3') {
    return { primary: locateMdpro3Cdb(gameDir, scan), additional: [] }
  }

  const preferred = [
    join(gameDir, 'cards.cdb'),
    join(gameDir, 'cdb', 'cards.cdb'),
    join(gameDir, 'expansions', 'cards.cdb')
  ]
  const primary = preferred.find((p) => scan.cdbPaths.includes(p)) ?? scan.cdbPaths[0] ?? null
  const additional = scan.cdbPaths.filter(
    (p) => p !== primary && !CLIENT_EXCLUDED_CDB_NAMES.has(basename(p).toLowerCase())
  )
  return { primary, additional }
}

export const CUSTOM_CDB_NAME = 'yde-custom.cdb'

export function isCustomSyncCdbPath(path: string): boolean {
  const segments = path.split(/[\\/]/)
  const name = segments[segments.length - 1] ?? ''
  return name.toLowerCase() === CUSTOM_CDB_NAME
}

export interface CustomSyncCdbInfo {
  path: string
  exists: boolean
}

export function customSyncCdbInfo(): CustomSyncCdbInfo | null {
  const gameDir = configService.get().gameDirectory
  if (!gameDir) return null
  const path = join(gameDir, 'expansions', CUSTOM_CDB_NAME)
  return { path, exists: existsSync(path) }
}

export function currentBundledCdbPaths(): string[] {
  const cfg = configService.get()
  if (!cfg.gameDirectory) return []
  const { additional } = discoverGameCdbPaths(cfg.gameDirectory, cfg.gameType ?? 'ygopro')
  return additional.filter((p) => !isCustomSyncCdbPath(p))
}

export interface GameLanguagePack {
  id: string

  dir?: string

  cdbPaths: string[]
}

function collectLanguagePacks(languageRoot: string): GameLanguagePack[] {
  let entries: Array<{ name: string; isDirectory: boolean }>
  try {
    entries = readdirSync(languageRoot, { withFileTypes: true }).map((e) => ({
      name: e.name,
      isDirectory: e.isDirectory()
    }))
  } catch {
    return []
  }
  const packs: GameLanguagePack[] = []
  for (const entry of entries) {
    if (!entry.isDirectory || entry.name.startsWith('.')) continue
    const dir = join(languageRoot, entry.name)
    packs.push({ id: entry.name, dir, cdbPaths: collectFolderCdbPaths(dir) })
  }
  return packs
}

export function discoverGameLanguagePacks(gameDir: string): GameLanguagePack[] {
  const packs = collectLanguagePacks(join(gameDir, 'config', 'languages'))
  if (packs.length === 0) return []
  return [{ id: 'en', cdbPaths: [] }, ...packs]
}

export function readGameConfigLanguage(gameDir: string): string | null {
  try {
    const content = readFileSync(join(gameDir, 'config', 'system.conf'), 'utf-8')
    const match = content.match(/^language\s*=\s*(\S+)\s*$/m)
    return match ? match[1] : null
  } catch {
    return null
  }
}

export function resolveGameLanguagePack(
  packs: GameLanguagePack[],
  preferred: string | undefined | null
): GameLanguagePack | null {
  if (packs.length === 0) return null
  return packs.find((p) => preferred != null && p.id === preferred) ?? packs[0]
}

export function currentLanguagePack(languageOverride?: string): GameLanguagePack | null {
  const cfg = configService.get()
  if (!cfg.gameDirectory || cfg.gameType !== 'ygopro') return null
  const packs = discoverGameLanguagePacks(cfg.gameDirectory)
  if (packs.length === 0) return null
  const preferred =
    languageOverride ?? cfg.gameLanguage ?? readGameConfigLanguage(cfg.gameDirectory)
  return resolveGameLanguagePack(packs, preferred)
}

function collectCdbFiles(dir: string, out: string[]): void {
  let entries: string[]
  try {
    entries = readdirSync(dir)
  } catch {
    return
  }
  for (const entry of entries.sort()) {
    if (!entry.toLowerCase().endsWith('.cdb')) continue
    const full = join(dir, entry)
    if (!out.includes(full)) out.push(full)
  }
}

export function collectFolderCdbPaths(folder: string): string[] {
  const out: string[] = []
  collectCdbFiles(folder, out)
  try {
    for (const entry of readdirSync(folder, { withFileTypes: true })) {
      if (entry.isDirectory()) collectCdbFiles(join(folder, entry.name), out)
    }
  } catch {}
  return out
}

export function collectStateCardIds(state: DuelPuzzleState): number[] {
  const ids = new Set<number>()
  for (const card of state.cards) {
    if (card.code > 0) ids.add(card.code)
  }
  for (const scene of Object.values(state.scenarios ?? {})) {
    for (const card of scene.cards) {
      if (card.code > 0) ids.add(card.code)
    }
  }
  return [...ids]
}

export async function checkGameContentCoverage(
  gameDir: string,
  gameType: GameType,
  cardIds: number[]
): Promise<GameContentCoverage> {
  const scan = getGameContentScan(gameDir)

  const dataCovered = new Set<number>()
  const typesById = new Map<number, number>()
  const aliasById = new Map<number, number>()
  for (const cdbPath of scan.cdbPaths) {
    for (const row of coveredIdsWithTypeFromCdb(cdbPath, cardIds)) {
      dataCovered.add(row.id)
      if (!typesById.has(row.id)) typesById.set(row.id, row.type)
      if (row.alias && !aliasById.has(row.id)) aliasById.set(row.id, row.alias)
    }
  }
  const missingDataSet = new Set<number>()
  for (const id of cardIds) {
    if (!dataCovered.has(id)) missingDataSet.add(id)
  }
  const missingDataIds = [...missingDataSet]

  const scriptIds =
    gameType === 'mdpro3'
      ? await collectMdpro3ScriptIds(scan, gameDir)
      : await collectGameScriptIds(scan)
  const hasScript = (id: number): boolean => {
    let current = id
    const seen = new Set<number>()
    while (current > 0 && !seen.has(current)) {
      if (scriptIds.has(current)) return true
      seen.add(current)
      current = aliasById.get(current) ?? 0
    }
    return false
  }
  const missingScriptIds = cardIds.filter((id) => {
    if (missingDataSet.has(id)) return false
    return scriptRequired(typesById.get(id) ?? 0) && !hasScript(id)
  })

  return { missingDataIds, missingScriptIds }
}

function scriptRequired(type: number): boolean {
  if ((type & TYPE_TOKEN) !== 0) return false
  if ((type & TYPE_MONSTER) === 0) return true
  return (type & TYPE_NORMAL) === 0 || (type & TYPE_EFFECT) !== 0
}

const scanCache = new Map<string, GameContentScan>()

export function invalidateGameContentScan(gameDir?: string): void {
  if (gameDir) scanCache.delete(gameDir)
  else scanCache.clear()
}

function getGameContentScan(gameDir: string): GameContentScan {
  const cached = scanCache.get(gameDir)
  if (cached) return cached

  const scan: GameContentScan = {
    cdbPaths: [],
    zipPaths: [],
    fileScriptIds: new Set(),
    rootScriptIds: new Set()
  }
  walkGameDir(gameDir, 1, scan, false)
  scan.cdbPaths.sort()
  scanCache.set(gameDir, scan)
  return scan
}

function walkGameDir(dir: string, depth: number, scan: GameContentScan, rootScript: boolean): void {
  let entries: Array<{ name: string; isDirectory: boolean }>
  try {
    entries = readdirSync(dir, { withFileTypes: true }).map((e) => ({
      name: e.name,
      isDirectory: e.isDirectory()
    }))
  } catch {
    return
  }
  for (const entry of entries) {
    const full = join(dir, entry.name)
    if (entry.isDirectory) {
      if (depth < SCAN_MAX_DEPTH && !SCAN_SKIP_DIRS.has(entry.name.toLowerCase())) {
        walkGameDir(
          full,
          depth + 1,
          scan,
          rootScript || (depth === 1 && entry.name.toLowerCase() === 'script')
        )
      }
      continue
    }
    const lower = entry.name.toLowerCase()
    if (lower.endsWith('.cdb')) {
      scan.cdbPaths.push(full)
    } else if (lower.endsWith('.zip')) {
      scan.zipPaths.push(full)
    } else {
      const id = parseScriptId(entry.name)
      if (id !== null) {
        scan.fileScriptIds.add(id)
        if (rootScript) scan.rootScriptIds.add(id)
      }
    }
  }
}

async function collectGameScriptIds(scan: GameContentScan): Promise<Set<number>> {
  const ids = new Set<number>(scan.fileScriptIds)
  for (const zipPath of scan.zipPaths) {
    for (const id of await collectZipScriptIds(zipPath)) ids.add(id)
  }
  return ids
}

async function collectMdpro3ScriptIds(
  scan: GameContentScan,
  gameDir: string
): Promise<Set<number>> {
  const ids = new Set<number>(scan.rootScriptIds)
  const scriptZip = join(gameDir, 'Data', 'script.zip')
  if (existsSync(scriptZip)) {
    for (const id of await collectZipScriptIds(scriptZip)) ids.add(id)
  }
  return ids
}

async function collectZipScriptIds(zipPath: string): Promise<Set<number>> {
  let cached = zipScriptIdCache.get(zipPath)
  if (!cached) {
    cached = new Set<number>()
    try {
      if (statSync(zipPath).size <= ZIP_READ_LIMIT) {
        for (const name of readZipEntryNames(zipPath)) {
          const id = parseScriptId(name)
          if (id !== null) cached.add(id)
        }
      }
    } catch {}
    zipScriptIdCache.set(zipPath, cached)
  }
  return cached
}

function parseScriptId(name: string): number | null {
  const m = SCRIPT_NAME_PATTERN.exec(name)
  return m ? Number(m[1]) : null
}

const zipScriptIdCache = new Map<string, Set<number>>()

function locateMdpro3Cdb(gameDir: string, scan: GameContentScan): string | null {
  const preferred = [
    join(gameDir, 'Data', 'locales', DEFAULT_MDPRO3_LOCALE, 'cards.cdb'),
    join(gameDir, 'expansions', 'cards.cdb'),
    join(gameDir, 'cards.cdb')
  ]
  const found = preferred.find((p) => scan.cdbPaths.includes(p))
  if (found) return found
  return scan.cdbPaths.find((p) => /cards\.cdb$/i.test(p)) ?? null
}

export function listMdpro3Locales(gameDir: string): GameLanguageOption[] {
  const scan = getGameContentScan(gameDir)
  const localesDir = join(gameDir, 'Data', 'locales').toLowerCase()
  const out: GameLanguageOption[] = []
  for (const cdbPath of scan.cdbPaths) {
    const localeDir = dirname(cdbPath)
    if (dirname(localeDir).toLowerCase() !== localesDir) continue
    if (basename(cdbPath).toLowerCase() !== 'cards.cdb') continue
    out.push({ id: basename(localeDir), detail: cdbPath })
  }
  return out.sort((a, b) => {
    if (a.id === DEFAULT_MDPRO3_LOCALE) return -1
    if (b.id === DEFAULT_MDPRO3_LOCALE) return 1
    return a.id.localeCompare(b.id)
  })
}

function coveredIdsWithTypeFromCdb(
  cdbPath: string,
  ids: number[]
): Array<{ id: number; type: number; alias: number }> {
  let db: Database.Database | null = null
  try {
    db = new Database(cdbPath, { readonly: true, fileMustExist: true })
    const covered: Array<{ id: number; type: number; alias: number }> = []
    for (let i = 0; i < ids.length; i += CDB_QUERY_CHUNK_SIZE) {
      const chunk = ids.slice(i, i + CDB_QUERY_CHUNK_SIZE)
      const placeholders = chunk.map(() => '?').join(',')
      const rows = db
        .prepare(`SELECT id, type, alias FROM datas WHERE id IN (${placeholders})`)
        .all(...chunk) as Array<{ id: number; type: number; alias: number }>
      for (const row of rows) covered.push(row)
    }
    return covered
  } catch {
    return []
  } finally {
    try {
      db?.close()
    } catch {}
  }
}
