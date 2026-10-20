import { BrowserWindow, dialog, shell } from 'electron'
import { existsSync, mkdirSync, readFileSync, rmSync, statSync, writeFileSync } from 'fs'
import { basename, dirname, extname, join } from 'path'
import * as sqlJsNamespace from 'sql.js'
import type { SqlJsStatic } from 'sql.js'
import { CardDataEntry, YGOProCdb } from 'ygopro-cdb-encode'
import { DirScriptReader } from 'koishipro-core.js'
import {
  CustomCard,
  CustomCardScriptInfo,
  CustomCardScriptResult,
  customCardToCdbCard
} from '@shared/index'
import { cdbService } from '../db/cdbService'
import { configService } from './configService'
import { CUSTOM_CDB_NAME, currentBundledCdbPaths, currentLanguagePack } from './gameContent'
import { dataDirService } from './dataDirService'
import { broadcastToWindows } from './broadcast'

const LIBRARY_DIR = 'custom'
const SCRIPT_DIR = 'script'
const SCRIPT_EXTENSION = '.lua'

export function customLibraryDir(): string {
  return dataDirService.ensureDirectory(LIBRARY_DIR)
}

export function customCdbPath(): string {
  return join(customLibraryDir(), CUSTOM_CDB_NAME)
}

export function customScriptDir(): string {
  return dataDirService.ensureDirectory(join(LIBRARY_DIR, SCRIPT_DIR))
}

export function customScriptName(code: number): string {
  return `c${code}${SCRIPT_EXTENSION}`
}

function primaryCustomScriptDir(): string {
  const gameDirectory = configService.get().gameDirectory
  return gameDirectory ? join(gameDirectory, 'expansions', 'script') : customScriptDir()
}

function customScriptDirs(): string[] {
  return configService.get().gameDirectory
    ? [primaryCustomScriptDir(), customScriptDir()]
    : [customScriptDir()]
}

export function customScriptPath(code: number): string {
  return join(primaryCustomScriptDir(), customScriptName(code))
}

function findCustomScriptPath(code: number): string | null {
  const name = customScriptName(code)
  for (const dir of customScriptDirs()) {
    const path = join(dir, name)
    if (existsSync(path)) return path
  }
  return null
}

export function isCustomCdbPath(cdbPath: string): boolean {
  return (
    basename(cdbPath).toLowerCase() === CUSTOM_CDB_NAME &&
    basename(dirname(cdbPath)).toLowerCase() === LIBRARY_DIR
  )
}

let sqlPromise: Promise<SqlJsStatic> | null = null

function resolveInitSqlJs(): (config?: unknown) => Promise<SqlJsStatic> {
  const ns = sqlJsNamespace as unknown as {
    initSqlJs?: (config?: unknown) => Promise<SqlJsStatic>
    default?: (config?: unknown) => Promise<SqlJsStatic>
  }
  const init = ns.initSqlJs ?? ns.default
  if (!init) {
    throw new Error('sql.js 模块加载失败：找不到初始化入口。')
  }
  return init
}

function loadSqlJs(): Promise<SqlJsStatic> {
  const existing = sqlPromise
  if (existing) return existing
  const created = resolveInitSqlJs()()
  sqlPromise = created
  return created
}

function toCardEntry(card: CustomCard): CardDataEntry {
  const cdbCard = customCardToCdbCard(card)
  return new CardDataEntry().fromPartial({
    code: cdbCard.id,
    ot: cdbCard.ot,
    alias: cdbCard.alias,
    setcode: [],
    type: cdbCard.type,
    attack: cdbCard.atk,
    defense: cdbCard.def,
    level: cdbCard.level,
    race: cdbCard.race,
    attribute: cdbCard.attribute,
    category: Number(cdbCard.category),
    name: cdbCard.name,
    desc: cdbCard.desc,
    strings: []
  })
}

async function writeCdb(cards: CustomCard[]): Promise<void> {
  const cdbPath = customCdbPath()
  mkdirSync(dirname(cdbPath), { recursive: true })
  const SQL = await loadSqlJs()
  const cdb = new YGOProCdb(SQL)
  try {
    for (const card of cards) cdb.addCard(toCardEntry(card))
    writeFileSync(cdbPath, Buffer.from(cdb.export()))
  } finally {
    cdb.finalize()
  }
}

let writeQueue: Promise<void> = Promise.resolve()

export function syncCustomCardLibrary(cards: CustomCard[]): void {
  writeQueue = writeQueue
    .then(async () => {
      try {
        await writeCdb(cards)
      } catch (err) {
        console.error('[CustomCardLibrary] Failed to write custom cdb:', err)
        return
      }
      try {
        registerCustomCdb()
      } catch (err) {
        console.error('[CustomCardLibrary] Failed to register custom cdb:', err)
      }
    })
    .catch(() => undefined)
}

function registerCustomCdb(): void {
  const cdbPath = customCdbPath()
  const cfg = configService.get()
  const extras = (cfg.extraCdbPaths || []).filter((p) => !isCustomCdbPath(p))
  const disabled = (cfg.disabledCdbPaths || []).filter((p) => !isCustomCdbPath(p))
  const nextExtras = [...extras, cdbPath]

  if (
    nextExtras.length !== (cfg.extraCdbPaths || []).length ||
    disabled.length !== (cfg.disabledCdbPaths || []).length
  ) {
    configService.save({ extraCdbPaths: nextExtras, disabledCdbPaths: disabled })
  }

  cdbService.reloadAll(cfg.cdbPath, currentBundledCdbPaths(), nextExtras, currentLanguagePack())
  broadcastToWindows('cdb:updated')
}

export function isCustomCdbLoaded(): boolean {
  const target = customCdbPath().toLowerCase()
  return cdbService.getLoadedPaths().some((p) => p.toLowerCase() === target)
}

let cachedReader: { dir: string; read: (path: string) => Uint8Array | null } | null = null

export function readCustomScript(scriptPath: string): Uint8Array | null {
  const dir = customScriptDir()
  const root = customLibraryDir()
  if (!cachedReader || cachedReader.dir !== dir) {
    const raw = DirScriptReader(dir, root) as unknown as (
      path: string
    ) => string | Uint8Array | null | undefined
    cachedReader = {
      dir,
      read: (path) => {
        const content = raw(path)
        if (content == null) return null
        return typeof content === 'string' ? new TextEncoder().encode(content) : content
      }
    }
  }
  return cachedReader.read(scriptPath)
}

export function getCustomScriptInfo(code: number): CustomCardScriptInfo {
  const path = findCustomScriptPath(code) ?? customScriptPath(code)
  const info: CustomCardScriptInfo = {
    code,
    fileName: customScriptName(code),
    path,
    exists: false
  }
  try {
    if (!existsSync(path)) return info
    const stat = statSync(path)
    return { ...info, exists: true, size: stat.size, updatedAt: stat.mtimeMs }
  } catch (err) {
    console.error('[CustomCardLibrary] Failed to stat script:', err)
    return info
  }
}

export async function importCustomScript(code: number): Promise<CustomCardScriptResult> {
  const picked = await dialog.showOpenDialog(BrowserWindow.getFocusedWindow()!, {
    title: `导入自建卡脚本（c${code}.lua）`,
    properties: ['openFile'],
    filters: [
      { name: 'Lua 脚本', extensions: ['lua'] },
      { name: '所有文件', extensions: ['*'] }
    ]
  })
  if (picked.canceled || picked.filePaths.length === 0) return { success: false, canceled: true }

  const source = picked.filePaths[0]
  if (!existsSync(source)) return { success: false, error: '文件不存在' }
  if (extname(source).toLowerCase() !== SCRIPT_EXTENSION) {
    return { success: false, error: '只支持 .lua 脚本文件' }
  }

  try {
    const content = readFileSync(source, 'utf-8').replace(/^\uFEFF/, '')
    if (!content.trim()) return { success: false, error: '脚本内容为空' }
    const target = customScriptPath(code)
    mkdirSync(dirname(target), { recursive: true })
    writeFileSync(target, content, 'utf-8')
    return { success: true, info: getCustomScriptInfo(code) }
  } catch (err) {
    console.error('[CustomCardLibrary] Failed to import script:', err)
    return { success: false, error: '脚本导入失败' }
  }
}

export function removeCustomScript(code: number): CustomCardScriptResult {
  try {
    const name = customScriptName(code)
    for (const dir of customScriptDirs()) {
      const path = join(dir, name)
      if (existsSync(path)) rmSync(path)
    }
    return { success: true, info: getCustomScriptInfo(code) }
  } catch (err) {
    console.error('[CustomCardLibrary] Failed to remove script:', err)
    return { success: false, error: '脚本删除失败' }
  }
}

export async function openCustomScriptDir(): Promise<void> {
  try {
    const dir = primaryCustomScriptDir()
    if (!existsSync(dir)) mkdirSync(dir, { recursive: true })
    await shell.openPath(dir)
  } catch (err) {
    console.error('[CustomCardLibrary] Failed to open script dir:', err)
  }
}
