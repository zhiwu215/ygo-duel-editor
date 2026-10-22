import { BrowserWindow, dialog, shell } from 'electron'
import { existsSync, mkdirSync, readFileSync, rmSync, statSync, writeFileSync } from 'fs'
import { basename, dirname, extname, join } from 'path'
import { DirScriptReader } from 'koishipro-core.js'
import {
  CustomCardScriptInfo,
  CustomCardScriptPickResult,
  CustomCardScriptResult
} from '@shared/index'
import { configService } from './configService'
import { dataDirService } from './dataDirService'

const SCRIPT_EXTENSION = '.lua'

function customScriptDir(): string {
  return dataDirService.ensureDirectory(join('custom', 'script'))
}

export function getCustomScriptDirectory(): string {
  return customScriptDir()
}

function customScriptName(code: number): string {
  return `c${code}${SCRIPT_EXTENSION}`
}

function customScriptPath(code: number): string {
  return join(customScriptDir(), customScriptName(code))
}

function gameScriptDir(): string | null {
  const gameDirectory = configService.get().gameDirectory
  return gameDirectory ? join(gameDirectory, 'expansions', 'script') : null
}

function scriptSearchDirs(): string[] {
  const gameDir = gameScriptDir()
  return gameDir ? [customScriptDir(), gameDir] : [customScriptDir()]
}

function findCustomScriptPath(code: number): string | null {
  const name = customScriptName(code)
  for (const dir of scriptSearchDirs()) {
    const path = join(dir, name)
    if (existsSync(path)) return path
  }
  return null
}

function readText(path: string): string {
  return readFileSync(path, 'utf-8').replace(/^\uFEFF/, '')
}

function collectStringIds(content: string): number[] {
  const ids = new Set<number>()
  const pattern = /aux\s*\.\s*Stringid\s*\(\s*[^,()]+?\s*,\s*(\d{1,2})\s*\)/g
  let match: RegExpExecArray | null
  while ((match = pattern.exec(content)) !== null) {
    const index = Number(match[1])
    if (index >= 0 && index < 16) ids.add(index)
  }
  return [...ids].sort((left, right) => left - right)
}

function suggestedIdFromName(fileName: string): number | undefined {
  const match = /^c(\d+)\.lua$/i.exec(fileName)
  if (!match) return undefined
  const id = Number(match[1])
  return Number.isSafeInteger(id) && id > 0 && id <= 0x7fffffff ? id : undefined
}

function hardcodedScriptId(content: string): number | undefined {
  const match = /\blocal\s+id\s*=\s*(\d+)\b/.exec(content)
  if (!match) return undefined
  const id = Number(match[1])
  return Number.isSafeInteger(id) && id > 0 ? id : undefined
}

export function readCustomScriptContent(code: number): string | null {
  const found = findCustomScriptPath(code)
  if (!found) return null
  try {
    return readText(found)
  } catch {
    return null
  }
}

export function getCustomScriptInfo(code: number): CustomCardScriptInfo {
  const found = findCustomScriptPath(code)
  const path = found ?? customScriptPath(code)
  const info: CustomCardScriptInfo = {
    code,
    fileName: customScriptName(code),
    path,
    exists: false,
    stringIds: []
  }
  if (!found) return info
  try {
    const stat = statSync(found)
    return {
      ...info,
      exists: true,
      size: stat.size,
      updatedAt: stat.mtimeMs,
      stringIds: collectStringIds(readText(found))
    }
  } catch (err) {
    console.error('[CustomCardScript] Failed to stat script:', err)
    return info
  }
}

export async function pickCustomCardScriptFile(): Promise<CustomCardScriptPickResult> {
  const picked = await dialog.showOpenDialog(BrowserWindow.getFocusedWindow()!, {
    title: '导入自定义卡片脚本',
    properties: ['openFile'],
    filters: [
      { name: 'Lua 脚本', extensions: ['lua'] },
      { name: '所有文件', extensions: ['*'] }
    ]
  })
  if (picked.canceled || picked.filePaths.length === 0) {
    return { success: false, canceled: true }
  }

  const filePath = picked.filePaths[0]
  const fileName = basename(filePath)
  if (extname(filePath).toLowerCase() !== SCRIPT_EXTENSION) {
    return { success: false, error: '只支持 .lua 脚本文件' }
  }
  if (!existsSync(filePath)) {
    return { success: false, error: '文件不存在' }
  }

  try {
    const content = readText(filePath)
    if (!content.trim()) return { success: false, error: '脚本内容为空' }
    return {
      success: true,
      filePath,
      fileName,
      suggestedId: suggestedIdFromName(fileName),
      stringIds: collectStringIds(content),
      size: statSync(filePath).size
    }
  } catch (err) {
    console.error('[CustomCardScript] Failed to read script:', err)
    return { success: false, error: '脚本读取失败' }
  }
}

export function importCustomScript(code: number, sourcePath: string): CustomCardScriptResult {
  if (!existsSync(sourcePath)) return { success: false, error: '文件不存在' }
  if (extname(sourcePath).toLowerCase() !== SCRIPT_EXTENSION) {
    return { success: false, error: '只支持 .lua 脚本文件' }
  }

  try {
    const content = readText(sourcePath)
    if (!content.trim()) return { success: false, error: '脚本内容为空' }

    const target = customScriptPath(code)
    mkdirSync(dirname(target), { recursive: true })
    writeFileSync(target, content, 'utf-8')

    const warnings: string[] = []
    const sourceId = suggestedIdFromName(basename(sourcePath))
    if (sourceId !== undefined && sourceId !== code) {
      warnings.push(
        `源文件名 ${basename(sourcePath)} 与当前卡密不一致，已关联为 ${customScriptName(code)}`
      )
    }
    const hardcodedId = hardcodedScriptId(content)
    if (hardcodedId !== undefined && hardcodedId !== code) {
      warnings.push(`脚本内容写死了卡密 ${hardcodedId}，可能与当前卡密不一致`)
    }

    return {
      success: true,
      info: getCustomScriptInfo(code),
      warning: warnings.length > 0 ? warnings.join('；') : undefined
    }
  } catch (err) {
    console.error('[CustomCardScript] Failed to import script:', err)
    return { success: false, error: '脚本导入失败' }
  }
}

export function writeCustomScriptContent(code: number, content: string): CustomCardScriptResult {
  if (!content.trim()) return { success: false, error: '脚本内容为空' }
  try {
    const target = customScriptPath(code)
    mkdirSync(dirname(target), { recursive: true })
    writeFileSync(target, content, 'utf-8')
    return { success: true, info: getCustomScriptInfo(code) }
  } catch (err) {
    console.error('[CustomCardScript] Failed to write script:', err)
    return { success: false, error: '脚本保存失败' }
  }
}

export function removeCustomScript(code: number): CustomCardScriptResult {
  try {
    const name = customScriptName(code)
    for (const dir of scriptSearchDirs()) {
      const path = join(dir, name)
      if (existsSync(path)) rmSync(path)
    }
    return { success: true, info: getCustomScriptInfo(code) }
  } catch (err) {
    console.error('[CustomCardScript] Failed to remove script:', err)
    return { success: false, error: '脚本删除失败' }
  }
}

export async function openCustomScriptDir(): Promise<void> {
  try {
    await shell.openPath(customScriptDir())
  } catch (err) {
    console.error('[CustomCardScript] Failed to open script dir:', err)
  }
}

let cachedReader: { dir: string; read: (path: string) => Uint8Array | null } | null = null

export function readCustomScript(scriptPath: string): Uint8Array | null {
  const dir = customScriptDir()
  if (!cachedReader || cachedReader.dir !== dir) {
    const raw = DirScriptReader(dir, dataDirService.ensureDirectory('custom')) as unknown as (
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

  const content = cachedReader.read(scriptPath)
  if (content) return content

  const gameDir = gameScriptDir()
  if (!gameDir) return null
  const fallback = join(gameDir, basename(scriptPath))
  if (!existsSync(fallback)) return null
  try {
    return new Uint8Array(readFileSync(fallback))
  } catch {
    return null
  }
}
