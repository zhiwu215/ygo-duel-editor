import { BrowserWindow, dialog } from 'electron'
import { createHash } from 'crypto'
import {
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  rmdirSync,
  rmSync,
  statSync,
  writeFileSync
} from 'fs'
import { basename, dirname, extname, isAbsolute, join, relative, resolve, sep } from 'path'
import {
  TextLibraryDeleteResult,
  TextLibraryEntry,
  TextLibraryExportResult,
  TextLibraryFolder,
  TextLibraryListResult,
  TextLibraryReadResult,
  TextLibrarySaveRequest,
  TextLibraryTree,
  TextLibraryWriteResult,
  countWords
} from '@shared/index'
import { dataDirService } from './dataDirService'
import { duelDocumentService } from './duelDocumentService'
import { broadcastToWindows } from './broadcast'
import { sanitizeProjectFileName } from '../utils/fileName'
import { toErrorMessageOr } from '../utils/errors'

const LIBRARY_DIRECTORY = 'text-library'
const TEXT_EXTENSION = '.txt'
const GENERATED_META_FILE = '.generated.json'

interface GeneratedMeta {
  generated: Record<string, string>
  active: Record<string, string>
}

export class TextLibraryService {
  public get rootPath(): string {
    return dataDirService.ensureDirectory(LIBRARY_DIRECTORY)
  }

  public reloadDataDirectory(): void {
    dataDirService.ensureDirectory(LIBRARY_DIRECTORY)
  }

  public listTree(): TextLibraryListResult {
    try {
      const root = this.rootPath
      const scanned = this.scanFolder(root, '')
      const tree: TextLibraryTree = { folders: scanned.folders, entries: scanned.entries }
      return { success: true, tree }
    } catch (err) {
      return { success: false, error: toErrorMessageOr(err, '读取文本库失败') }
    }
  }

  public readEntry(relativePath: string): TextLibraryReadResult {
    try {
      const normalized = this.normalizeRelative(relativePath)
      const target = this.resolveRelative(normalized)
      if (!existsSync(target) || !statSync(target).isFile()) {
        return { success: false, error: '文本不存在。' }
      }
      return {
        success: true,
        entry: this.toEntry(target, normalized),
        content: readFileSync(target, 'utf-8')
      }
    } catch (err) {
      return { success: false, error: toErrorMessageOr(err, '读取文本失败') }
    }
  }

  public saveScreenplay(request: TextLibrarySaveRequest): TextLibraryWriteResult {
    try {
      const text = request.text.trim()
      if (!text) return { success: false, error: '台本没有可导出的文本。' }

      const normalizedText = request.text.trimEnd()
      const categoryPath = this.categoryFromSource(request.sourceFilePath)
      const title = sanitizeProjectFileName(request.title || '未命名台本')
      const basePath = categoryPath
        ? `${categoryPath}/${title}${TEXT_EXTENSION}`
        : `${title}${TEXT_EXTENSION}`
      const meta = this.readGeneratedMeta()
      const activePath = meta.active[basePath]
      const preferredPath =
        activePath && existsSync(this.resolveRelative(activePath)) ? activePath : basePath
      let relativePath = preferredPath
      let target = this.resolveRelative(relativePath)
      let createdNew = false

      if (existsSync(target)) {
        const existing = readFileSync(target, 'utf-8').trimEnd()
        const existingHash = this.hashText(existing)
        if (existing === normalizedText) {
          meta.generated[relativePath] = existingHash
          meta.active[basePath] = relativePath
          this.writeGeneratedMeta(meta)
          return { success: true, entry: this.toEntry(target, relativePath), createdNew: false }
        }
        const baseline = meta.generated[relativePath]
        if (!baseline || baseline !== existingHash) {
          relativePath = this.uniqueRelativePath(basePath)
          target = this.resolveRelative(relativePath)
          createdNew = true
        }
      }

      mkdirSync(dirname(target), { recursive: true })
      writeFileSync(target, `${normalizedText}\n`, 'utf-8')
      meta.generated[relativePath] = this.hashText(normalizedText)
      meta.active[basePath] = relativePath
      this.writeGeneratedMeta(meta)

      const entry = this.toEntry(target, relativePath)
      broadcastToWindows('text-library:updated')
      return { success: true, entry, createdNew }
    } catch (err) {
      return { success: false, error: toErrorMessageOr(err, '导出到文本库失败') }
    }
  }

  public updateEntry(relativePath: string, content: string): TextLibraryWriteResult {
    try {
      const normalized = this.normalizeRelative(relativePath)
      const target = this.resolveRelative(normalized)
      if (!existsSync(target) || !statSync(target).isFile()) {
        return { success: false, error: '文本不存在。' }
      }
      writeFileSync(target, content, 'utf-8')

      const entry = this.toEntry(target, normalized)
      broadcastToWindows('text-library:updated')
      return { success: true, entry }
    } catch (err) {
      return { success: false, error: toErrorMessageOr(err, '保存文本失败') }
    }
  }

  public deleteEntry(relativePath: string): TextLibraryDeleteResult {
    try {
      const normalized = this.normalizeRelative(relativePath)
      const target = this.resolveRelative(normalized)
      if (!existsSync(target) || !statSync(target).isFile()) {
        return { success: false, error: '文本不存在。' }
      }
      rmSync(target, { force: true })
      this.pruneEmptyFolders(dirname(target))
      const meta = this.readGeneratedMeta()
      delete meta.generated[normalized]
      for (const [basePath, activePath] of Object.entries(meta.active)) {
        if (activePath === normalized) delete meta.active[basePath]
      }
      this.writeGeneratedMeta(meta)
      broadcastToWindows('text-library:updated')
      return { success: true }
    } catch (err) {
      return { success: false, error: toErrorMessageOr(err, '删除文本失败') }
    }
  }

  public deleteFolder(relativePath: string): TextLibraryDeleteResult {
    try {
      const normalized = this.normalizeRelative(relativePath).replace(/\/+$/, '')
      const target = this.resolveRelative(normalized)
      if (!existsSync(target) || !statSync(target).isDirectory()) {
        return { success: false, error: '分类不存在。' }
      }
      const prefix = `${normalized}/`
      rmSync(target, { recursive: true, force: true })
      this.pruneEmptyFolders(dirname(target))

      const meta = this.readGeneratedMeta()
      for (const key of Object.keys(meta.generated)) {
        if (key.startsWith(prefix)) delete meta.generated[key]
      }
      for (const [basePath, activePath] of Object.entries(meta.active)) {
        if (basePath.startsWith(prefix) || activePath.startsWith(prefix)) {
          delete meta.active[basePath]
        }
      }
      this.writeGeneratedMeta(meta)
      broadcastToWindows('text-library:updated')
      return { success: true }
    } catch (err) {
      return { success: false, error: toErrorMessageOr(err, '删除分类失败') }
    }
  }

  public async exportEntry(
    relativePath: string,
    window?: BrowserWindow
  ): Promise<TextLibraryExportResult> {
    try {
      const read = this.readEntry(relativePath)
      if (!read.success || read.entry === undefined) {
        return { success: false, error: read.error ?? '读取文本失败' }
      }
      const result = await dialog.showSaveDialog(window || BrowserWindow.getFocusedWindow()!, {
        title: '导出文本',
        defaultPath: `${read.entry.title}${TEXT_EXTENSION}`,
        filters: [
          { name: '纯文本', extensions: ['txt'] },
          { name: 'All Files', extensions: ['*'] }
        ]
      })
      if (result.canceled || !result.filePath) {
        return { success: false, canceled: true }
      }
      const target = extname(result.filePath)
        ? result.filePath
        : `${result.filePath}${TEXT_EXTENSION}`
      writeFileSync(target, read.content ?? '', 'utf-8')
      return { success: true, filePath: target }
    } catch (err) {
      return { success: false, error: toErrorMessageOr(err, '导出文本失败') }
    }
  }

  private normalizeRelative(relativePath: string): string {
    return String(relativePath ?? '')
      .replace(/\\/g, '/')
      .replace(/^\/+/, '')
  }

  private resolveRelative(relativePath: string): string {
    const root = this.rootPath
    const target = resolve(root, relativePath)
    const offset = relative(root, target)
    if (!offset || offset.startsWith('..') || isAbsolute(offset)) {
      throw new Error('文本路径无效。')
    }
    return target
  }

  private uniqueRelativePath(relativePath: string): string {
    if (!existsSync(this.resolveRelative(relativePath))) return relativePath
    const extension = extname(relativePath)
    const base = relativePath.slice(0, -extension.length)
    let index = 2
    let candidate = `${base}_${index}${extension}`
    while (existsSync(this.resolveRelative(candidate))) {
      index += 1
      candidate = `${base}_${index}${extension}`
    }
    return candidate
  }

  private hashText(text: string): string {
    return createHash('sha256').update(text).digest('hex')
  }

  private get generatedMetaPath(): string {
    return join(this.rootPath, GENERATED_META_FILE)
  }

  private readGeneratedMeta(): GeneratedMeta {
    const empty: GeneratedMeta = { generated: {}, active: {} }
    try {
      const filePath = this.generatedMetaPath
      if (!existsSync(filePath)) return empty
      const parsed = JSON.parse(readFileSync(filePath, 'utf-8')) as Partial<GeneratedMeta>
      const generated: Record<string, string> = {}
      for (const [key, value] of Object.entries(parsed.generated ?? {})) {
        if (typeof value === 'string') generated[key] = value
      }
      const active: Record<string, string> = {}
      for (const [key, value] of Object.entries(parsed.active ?? {})) {
        if (typeof value === 'string') active[key] = value
      }
      return { generated, active }
    } catch {
      return empty
    }
  }

  private writeGeneratedMeta(meta: GeneratedMeta): void {
    try {
      const filePath = this.generatedMetaPath
      if (Object.keys(meta.generated).length === 0 && Object.keys(meta.active).length === 0) {
        rmSync(filePath, { force: true })
        return
      }
      mkdirSync(dirname(filePath), { recursive: true })
      writeFileSync(filePath, JSON.stringify(meta, null, 2), 'utf-8')
    } catch (err) {
      console.error('[TextLibraryService] 写入导出记录失败:', err)
    }
  }

  private categoryFromSource(sourceFilePath: string | null): string {
    if (!sourceFilePath) return ''
    const root = duelDocumentService.rootPath
    const offset = relative(root, dirname(sourceFilePath))
    if (!offset || offset.startsWith('..') || isAbsolute(offset)) return ''
    return offset.split(sep).filter(Boolean).join('/')
  }

  private pruneEmptyFolders(start: string): void {
    const root = this.rootPath
    let current = start
    while (current !== root && existsSync(current)) {
      try {
        if (readdirSync(current).length > 0) return
        rmdirSync(current)
      } catch {
        return
      }
      current = dirname(current)
    }
  }

  private scanFolder(absolutePath: string, relativePath: string): TextLibraryFolder {
    const folder: TextLibraryFolder = {
      name: basename(absolutePath),
      path: relativePath,
      folders: [],
      entries: []
    }
    let entries
    try {
      entries = readdirSync(absolutePath, { withFileTypes: true })
    } catch {
      return folder
    }
    for (const entry of entries.sort((left, right) => left.name.localeCompare(right.name, 'zh'))) {
      if (entry.name.startsWith('.')) continue
      const childRelative = relativePath ? `${relativePath}/${entry.name}` : entry.name
      const childAbsolute = join(absolutePath, entry.name)
      if (entry.isDirectory()) {
        folder.folders.push(this.scanFolder(childAbsolute, childRelative))
        continue
      }
      if (!entry.isFile() || extname(entry.name).toLowerCase() !== TEXT_EXTENSION) continue
      try {
        folder.entries.push(this.toEntry(childAbsolute, childRelative))
      } catch {
        continue
      }
    }
    return folder
  }

  private toEntry(absolutePath: string, relativePath: string): TextLibraryEntry {
    const content = readFileSync(absolutePath, 'utf-8')
    const slash = relativePath.lastIndexOf('/')
    return {
      path: relativePath,
      title: basename(absolutePath, extname(absolutePath)),
      categoryPath: slash >= 0 ? relativePath.slice(0, slash) : '',
      wordCount: countWords(content),
      updatedAt: statSync(absolutePath).mtimeMs
    }
  }
}

export const textLibraryService = new TextLibraryService()
