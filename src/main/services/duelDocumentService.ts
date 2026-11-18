import { BrowserWindow, dialog } from 'electron'
import {
  existsSync,
  mkdirSync,
  readFileSync,
  renameSync,
  rmSync,
  statSync,
  writeFileSync
} from 'fs'
import { basename, dirname, extname, isAbsolute, join, relative, resolve } from 'path'
import {
  DuelDocument,
  DuelDocumentListResult,
  DuelDocumentReadResult,
  DuelDocumentWriteResult
} from '@shared/index'
import { DuelSessionParseError, parseDuelDocumentJson, serializeDuelDocument } from '@shared/index'
import { DuelDocumentIndex } from './duelDocumentIndex'
import { dataDirService } from './dataDirService'
import { sanitizeFileName } from '../utils/fileName'
import { toErrorMessageOr } from '../utils/errors'

const DOCUMENT_EXTENSION = '.ygoduel'

function sanitizeSegment(name: string, fallback: string): string {
  const cleaned = sanitizeFileName(name.trim())
    .replace(/[\\/:*?"<>|]/g, '_')
    .trim()
  return cleaned || fallback
}

function uniquePath(target: string): string {
  if (!existsSync(target)) return target
  const extension = extname(target)
  const base = target.slice(0, -extension.length)
  let index = 2
  let candidate = `${base}_${index}${extension}`
  while (existsSync(candidate)) {
    index += 1
    candidate = `${base}_${index}${extension}`
  }
  return candidate
}

function isSamePath(left: string, right: string): boolean {
  return resolve(left).toLowerCase() === resolve(right).toLowerCase()
}

export class DuelDocumentService {
  private index = new DuelDocumentIndex()

  public get rootPath(): string {
    return dataDirService.ensureDirectory('projects')
  }

  public resolveRelative(relativePath: string): string {
    const target = resolve(this.rootPath, relativePath)
    const offset = relative(this.rootPath, target)
    if (offset.startsWith('..') || isAbsolute(offset)) {
      throw new Error('目录超出对局文档根目录。')
    }
    return target
  }

  public listTree(): DuelDocumentListResult {
    try {
      this.ensureRoot()
      const root = this.index.scan(this.rootPath, (path) => this.readDocument(path))
      return {
        success: true,
        tree: {
          rootPath: this.rootPath,
          folders: root.folders,
          documents: root.documents
        }
      }
    } catch (err) {
      return { success: false, error: toErrorMessageOr(err, '读取对局目录失败') }
    }
  }

  public readDocument(filePath: string): DuelDocumentReadResult {
    try {
      const content = readFileSync(filePath, 'utf-8')
      const document = parseDuelDocumentJson(content)
      const fileNameTitle = basename(filePath, extname(filePath))
      if (document.state && !document.state.title?.trim() && fileNameTitle) {
        document.state.title = fileNameTitle
      }
      return {
        success: true,
        filePath,
        document
      }
    } catch (err) {
      return {
        success: false,
        filePath,
        ...(err instanceof DuelSessionParseError ? { recoveryState: err.state } : {}),
        error: toErrorMessageOr(err, '读取对局文档失败')
      }
    }
  }

  public saveDocument(filePath: string, document: DuelDocument): DuelDocumentWriteResult {
    try {
      return this.writeDocument(filePath, document)
    } catch (err) {
      return { success: false, error: toErrorMessageOr(err, '保存对局文档失败') }
    }
  }

  public createDocument(folderPath: string, document: DuelDocument): DuelDocumentWriteResult {
    try {
      const folder = folderPath ? this.resolveRelative(folderPath) : this.rootPath
      const title = sanitizeSegment(document.state.title || '', '未命名对局')
      const target = join(folder, `${title}${DOCUMENT_EXTENSION}`)
      if (existsSync(target)) {
        return { success: false, error: '已存在同名台本。' }
      }
      return this.writeDocument(target, document)
    } catch (err) {
      return { success: false, error: toErrorMessageOr(err, '新建对局文档失败') }
    }
  }

  public duplicateDocument(filePath: string, title: string): DuelDocumentWriteResult {
    try {
      const read = this.readDocument(filePath)
      if (!read.success || !read.document) {
        return { success: false, error: read.error ?? '读取对局文档失败' }
      }
      const document = read.document
      document.state.title = title.trim() || document.state.title
      const target = join(
        dirname(filePath),
        `${sanitizeSegment(document.state.title, '未命名对局')}${DOCUMENT_EXTENSION}`
      )
      if (existsSync(target)) {
        return { success: false, error: '已存在同名台本。' }
      }
      return this.writeDocument(target, document)
    } catch (err) {
      return { success: false, error: toErrorMessageOr(err, '复制对局文档失败') }
    }
  }

  public async saveDocumentDialog(
    document: DuelDocument,
    window?: BrowserWindow
  ): Promise<DuelDocumentWriteResult> {
    const title = sanitizeSegment(document.state.title || '', '未命名对局')
    const result = await dialog.showSaveDialog(window || BrowserWindow.getFocusedWindow()!, {
      title: '保存对局文档',
      defaultPath: join(this.rootPath, `${title}${DOCUMENT_EXTENSION}`),
      filters: [
        { name: 'YGO 对局文档', extensions: ['ygoduel'] },
        { name: 'All Files', extensions: ['*'] }
      ]
    })
    if (result.canceled || !result.filePath) {
      return { success: false }
    }
    const target = result.filePath.toLowerCase().endsWith(DOCUMENT_EXTENSION)
      ? result.filePath
      : `${result.filePath}${DOCUMENT_EXTENSION}`
    const newTitle = basename(target, extname(target))
    document.state.title = newTitle
    return this.saveDocument(target, document)
  }

  public async openDocumentDialog(window?: BrowserWindow): Promise<DuelDocumentReadResult> {
    const result = await dialog.showOpenDialog(window || BrowserWindow.getFocusedWindow()!, {
      title: '打开对局文档',
      defaultPath: this.rootPath,
      filters: [
        { name: 'YGO 对局文档', extensions: ['ygoduel'] },
        { name: 'All Files', extensions: ['*'] }
      ],
      properties: ['openFile']
    })
    if (result.canceled || result.filePaths.length === 0) {
      return { success: false }
    }
    return this.readDocument(result.filePaths[0])
  }

  public createFolder(parentPath: string, name: string): DuelDocumentWriteResult {
    try {
      const parent = parentPath ? this.resolveRelative(parentPath) : this.rootPath
      const folder = uniquePath(join(parent, sanitizeSegment(name, '新分类')))
      mkdirSync(folder, { recursive: true })
      return { success: true, filePath: folder }
    } catch (err) {
      return { success: false, error: toErrorMessageOr(err, '新建分类失败') }
    }
  }

  public renameFolder(folderPath: string, name: string): DuelDocumentWriteResult {
    try {
      const source = this.resolveRelative(folderPath)
      if (!existsSync(source) || !statSync(source).isDirectory()) {
        return { success: false, error: '目录不存在。' }
      }
      const target = join(dirname(source), sanitizeSegment(name, basename(source)))
      if (target === source) return { success: true, filePath: source }
      if (existsSync(target)) {
        return { success: false, error: '同名目录已存在。' }
      }
      renameSync(source, target)
      return { success: true, filePath: target }
    } catch (err) {
      return { success: false, error: toErrorMessageOr(err, '重命名分类失败') }
    }
  }

  public deleteFolder(folderPath: string): DuelDocumentWriteResult {
    try {
      const target = this.resolveRelative(folderPath)
      if (target === this.rootPath) {
        return { success: false, error: '不能删除根目录。' }
      }
      rmSync(target, { recursive: true, force: true })
      return { success: true, filePath: target }
    } catch (err) {
      return { success: false, error: toErrorMessageOr(err, '删除分类失败') }
    }
  }

  public renameDocument(filePath: string, title: string): DuelDocumentWriteResult {
    try {
      const read = this.readDocument(filePath)
      if (!read.success || !read.document) {
        return { success: false, error: read.error ?? '读取对局文档失败' }
      }
      const document = read.document
      document.state.title = title.trim() || document.state.title
      const target = join(
        dirname(filePath),
        `${sanitizeSegment(document.state.title, '未命名对局')}${DOCUMENT_EXTENSION}`
      )
      const keepPath = isSamePath(target, filePath)
      if (!keepPath && existsSync(target)) {
        return { success: false, error: '已存在同名台本。' }
      }
      const write = this.writeDocument(target, document)
      if (!write.success) return write
      if (!keepPath) rmSync(filePath, { force: true })
      return write
    } catch (err) {
      return { success: false, error: toErrorMessageOr(err, '重命名对局文档失败') }
    }
  }

  public moveDocument(filePath: string, targetFolder: string): DuelDocumentWriteResult {
    try {
      const targetDir = targetFolder ? this.resolveRelative(targetFolder) : this.rootPath
      if (!existsSync(targetDir) || !statSync(targetDir).isDirectory()) {
        return { success: false, error: '目标分类不存在。' }
      }
      const target = uniquePath(join(targetDir, basename(filePath)))
      renameSync(filePath, target)
      return { success: true, filePath: target }
    } catch (err) {
      return { success: false, error: toErrorMessageOr(err, '移动对局文档失败') }
    }
  }

  public deleteDocument(filePath: string): DuelDocumentWriteResult {
    try {
      rmSync(filePath, { force: true })
      return { success: true, filePath }
    } catch (err) {
      return { success: false, error: toErrorMessageOr(err, '删除对局文档失败') }
    }
  }

  public ensureRoot(): string {
    const root = this.rootPath
    if (!existsSync(root)) mkdirSync(root, { recursive: true })
    return root
  }

  private writeDocument(filePath: string, document: DuelDocument): DuelDocumentWriteResult {
    const target = filePath.toLowerCase().endsWith(DOCUMENT_EXTENSION)
      ? filePath
      : `${filePath}${DOCUMENT_EXTENSION}`
    mkdirSync(dirname(target), { recursive: true })
    const temporary = `${target}.tmp`
    writeFileSync(temporary, serializeDuelDocument(document), 'utf-8')
    renameSync(temporary, target)
    return { success: true, filePath: target }
  }
}

export const duelDocumentService = new DuelDocumentService()
