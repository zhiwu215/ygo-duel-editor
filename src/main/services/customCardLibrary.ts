import Database from 'better-sqlite3'
import { BrowserWindow, dialog, shell } from 'electron'
import { existsSync, mkdirSync, readFileSync, rmSync, statSync, writeFileSync } from 'fs'
import { basename, dirname, extname, join } from 'path'
import { DirScriptReader } from 'koishipro-core.js'
import {
  CustomCard,
  CustomCardScriptInfo,
  CustomCardScriptResult,
  customCardToCdbCard
} from '@shared/index'
import { cdbService } from '../db/cdbService'
import { configService } from './configService'
import { dataDirService } from './dataDirService'
import { broadcastToWindows } from './broadcast'

const LIBRARY_DIR = 'custom'
const CDB_FILE = 'cards.cdb'
const SCRIPT_DIR = 'script'
const SCRIPT_EXTENSION = '.lua'

const DATAS_COLUMNS = [
  'id',
  'ot',
  'alias',
  'setcode',
  'type',
  'atk',
  'def',
  'level',
  'race',
  'attribute',
  'category'
]

const TEXT_COLUMNS = ['id', 'name', 'desc', ...Array.from({ length: 16 }, (_, i) => `str${i + 1}`)]

export function customLibraryDir(): string {
  return dataDirService.ensureDirectory(LIBRARY_DIR)
}

export function customCdbPath(): string {
  return join(customLibraryDir(), CDB_FILE)
}

export function customScriptDir(): string {
  return dataDirService.ensureDirectory(join(LIBRARY_DIR, SCRIPT_DIR))
}

export function customScriptName(code: number): string {
  return `c${code}${SCRIPT_EXTENSION}`
}

export function customScriptPath(code: number): string {
  return join(customScriptDir(), customScriptName(code))
}

export function isCustomCdbPath(cdbPath: string): boolean {
  return (
    basename(cdbPath).toLowerCase() === CDB_FILE &&
    basename(dirname(cdbPath)).toLowerCase() === LIBRARY_DIR
  )
}

function createTables(db: Database.Database): void {
  db.exec(
    `CREATE TABLE IF NOT EXISTS datas (${DATAS_COLUMNS.map((c) => `${c} integer`).join(', ')})`
  )
  db.exec(`CREATE TABLE IF NOT EXISTS texts (${TEXT_COLUMNS.map((c) => `${c} text`).join(', ')})`)
}

function writeCdb(cards: CustomCard[]): void {
  const cdbPath = customCdbPath()
  mkdirSync(dirname(cdbPath), { recursive: true })
  const db = new Database(cdbPath)
  try {
    createTables(db)
    const insertData = db.prepare(
      `INSERT INTO datas (${DATAS_COLUMNS.join(', ')}) VALUES (${DATAS_COLUMNS.map(() => '?').join(', ')})`
    )
    const insertText = db.prepare('INSERT INTO texts (id, name, desc) VALUES (?, ?, ?)')
    const rebuild = db.transaction((list: CustomCard[]) => {
      db.prepare('DELETE FROM datas').run()
      db.prepare('DELETE FROM texts').run()
      for (const card of list) {
        const cdbCard = customCardToCdbCard(card)
        insertData.run(
          cdbCard.id,
          cdbCard.ot ?? 0,
          cdbCard.alias ?? 0,
          cdbCard.setcode ?? 0,
          cdbCard.type ?? 0,
          cdbCard.atk ?? 0,
          cdbCard.def ?? 0,
          cdbCard.level ?? 0,
          cdbCard.race ?? 0,
          cdbCard.attribute ?? 0,
          cdbCard.category ?? 0
        )
        insertText.run(cdbCard.id, cdbCard.name ?? '', cdbCard.desc ?? '')
      }
    })
    rebuild(cards)
  } finally {
    db.close()
  }
}

export function syncCustomCardLibrary(cards: CustomCard[]): void {
  try {
    writeCdb(cards)
  } catch (err) {
    console.error('[CustomCardLibrary] Failed to write custom cdb:', err)
    return
  }

  try {
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

    cdbService.reloadAll(cfg.cdbPath, nextExtras)
    broadcastToWindows('cdb:updated')
  } catch (err) {
    console.error('[CustomCardLibrary] Failed to register custom cdb:', err)
  }
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
  const path = customScriptPath(code)
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
    const path = customScriptPath(code)
    if (existsSync(path)) rmSync(path)
    return { success: true, info: getCustomScriptInfo(code) }
  } catch (err) {
    console.error('[CustomCardLibrary] Failed to remove script:', err)
    return { success: false, error: '脚本删除失败' }
  }
}

export async function openCustomScriptDir(): Promise<void> {
  try {
    await shell.openPath(customScriptDir())
  } catch (err) {
    console.error('[CustomCardLibrary] Failed to open script dir:', err)
  }
}
