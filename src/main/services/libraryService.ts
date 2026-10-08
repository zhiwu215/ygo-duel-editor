import {
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  statSync,
  writeFileSync,
  unlinkSync
} from 'fs'
import { join } from 'path'
import {
  TextChapter,
  TextMeta,
  countWords,
  extractEpubText,
  inferTextTitle,
  splitTextChapters
} from '@shared/index'
import { dataDirService } from './dataDirService'

const TEXT_EXTS = ['.txt', '.md', '.epub']

function sanitizeFileName(name: string): string {
  const cleaned = name
    .replace(/[\\/:*?"<>|]/g, '_')
    .replace(/\s+/g, ' ')
    .replace(/^\.+/, '')
    .replace(/[. ]+$/, '')
    .trim()
  return cleaned || '未命名'
}

/**
 * 文本素材服务：AI 编排决斗对局的**原料层**
 *
 * 只存「还没变成对局」的东西：导入的原文（`texts/<id>.<ext>`）
 * 与按章节拆分的结果（`texts/<id>.chapters.json`）。
 *
 * **为什么小说独立于工程目录**：它是原始素材而非对局成品——一本书能拆出
 * 多个章节、每章可生成多个不同对局，成品统一落进 `projects/*.ygoduel`。
 * 曾经存在的「台本」层（`screenplays/*.yscript`）已删除：台本只存 steps，
 * 而 steps 里的 instanceId / boardAfter / 格子序号都指向具体盘面，
 * 脱离 .ygoduel 无法回放，属于把同一份数据存两遍。
 */
export class LibraryService {
  private get textsDir(): string {
    return this.ensureDirs()
  }

  public reloadDataDirectory(): void {
    this.ensureDirs()
  }

  private ensureDirs(): string {
    const dir = dataDirService.resolve('texts')
    try {
      if (!existsSync(dir)) mkdirSync(dir, { recursive: true })
    } catch (err) {
      console.error('[LibraryService] Failed to ensure dir:', dir, err)
    }
    return dir
  }

  /* ------------------------------ 文本素材 ------------------------------ */

  private textId(filePath: string): string {
    return (
      filePath
        .split(/[\\/]/)
        .pop()
        ?.replace(/\.[^.]+$/, '') || 'text'
    )
  }

  private chaptersPath(textId: string): string {
    return join(this.textsDir, `${sanitizeFileName(textId)}.chapters.json`)
  }

  public getTextList(): TextMeta[] {
    if (!existsSync(this.textsDir)) return []
    const metas: TextMeta[] = []
    try {
      for (const file of readdirSync(this.textsDir)) {
        if (!TEXT_EXTS.some((ext) => file.toLowerCase().endsWith(ext))) continue
        const filePath = join(this.textsDir, file)
        const id = this.textId(filePath)
        const raw = this.readTextRaw(filePath)
        const chapters = this.readChaptersMeta(id)
        const stat = existsSync(filePath) ? this.safeMtime(filePath) : 0
        metas.push({
          id,
          filePath,
          title: inferTextTitle(file),
          wordCount: raw ? countWords(raw) : 0,
          // 已有拆分结果即视为可用（拆分是导入时同步完成的）
          progress: chapters.length > 0 ? 'split' : 'raw',
          chapterCount: chapters.length || undefined,
          updatedAt: stat
        })
      }
    } catch (err) {
      console.error('[LibraryService] getTextList error:', err)
    }
    return metas.sort((a, b) => b.updatedAt - a.updatedAt)
  }

  private safeMtime(filePath: string): number {
    try {
      // 单独包一层：文件可能在列举后被外部删除
      return statSync(filePath).mtimeMs
    } catch {
      return 0
    }
  }

  private readTextRaw(filePath: string): string {
    try {
      if (!existsSync(filePath)) return ''
      if (filePath.toLowerCase().endsWith('.epub')) {
        // EPUB 是 zip 容器，需要二进制解析；当前按 UTF-8 直读并抽标签，
        // 解析不出来时返回空串由 UI 提示「该 EPUB 暂不支持」
        return extractEpubText(readFileSync(filePath, 'utf-8'))
      }
      return readFileSync(filePath, 'utf-8')
    } catch (err) {
      console.error('[LibraryService] readTextRaw error:', filePath, err)
      return ''
    }
  }

  private readChaptersMeta(textId: string): Array<Omit<TextChapter, 'content'>> {
    try {
      const p = this.chaptersPath(textId)
      if (!existsSync(p)) return []
      const parsed = JSON.parse(readFileSync(p, 'utf-8')) as TextChapter[]
      if (!Array.isArray(parsed)) return []
      return parsed.map((chapter) => ({
        id: chapter.id,
        textId: chapter.textId,
        title: chapter.title,
        index: chapter.index,
        wordCount: chapter.wordCount
      }))
    } catch (err) {
      console.error('[LibraryService] readChaptersMeta error:', err)
      return []
    }
  }

  public importTextFile(pickedPaths: string[]): {
    success: boolean
    canceled?: boolean
    text?: TextMeta
    error?: string
  } {
    if (pickedPaths.length === 0) return { success: false, canceled: true }
    this.ensureDirs()
    const first = pickedPaths[0]
    const baseName = first.split(/[\\/]/).pop() || 'text.txt'
    // 原文件复制进资料库：用户从网上下载的文件可能随时被清理
    const destPath = join(this.textsDir, baseName)
    try {
      writeFileSync(destPath, readFileSync(first))
    } catch (err) {
      console.error('[LibraryService] importTextFile copy error:', err)
      return { success: false, error: '复制文件失败' }
    }

    const meta = this.resplit(destPath)
    return meta
      ? { success: true, text: meta }
      : { success: false, error: '导入失败：无法解析文件内容（EPUB 需为解压后的文本）' }
  }

  private resplit(filePath: string): TextMeta | null {
    const id = this.textId(filePath)
    const raw = this.readTextRaw(filePath)
    if (!raw.trim()) return null

    const title = inferTextTitle(filePath.split(/[\\/]/).pop() || id)
    const result = splitTextChapters(raw, title)
    if (result.chapters.length === 0) return null

    const chapters: TextChapter[] = result.chapters.map((c) => ({
      id: `ch_${c.index}`,
      textId: id,
      title: c.title,
      index: c.index,
      wordCount: c.wordCount,
      content: c.content
    }))
    if (!this.writeChapters(id, chapters)) return null

    return {
      id,
      filePath,
      title,
      wordCount: countWords(raw),
      progress: 'split',
      chapterCount: chapters.length,
      updatedAt: Date.now()
    }
  }

  public resplitText(id: string): { success: boolean; text?: TextMeta; error?: string } {
    const filePath = join(this.textsDir, `${sanitizeFileName(id)}${this.extOfId(id)}`)
    if (!existsSync(filePath)) return { success: false, error: '资料文件不存在' }
    const meta = this.resplit(filePath)
    return meta ? { success: true, text: meta } : { success: false, error: '重新拆分失败' }
  }

  private extOfId(id: string): string {
    // 列表里 id 是去掉扩展名的文件名，重新拆分时要还原扩展名
    for (const ext of TEXT_EXTS) {
      if (existsSync(join(this.textsDir, `${sanitizeFileName(id)}${ext}`))) return ext
    }
    return '.txt'
  }

  public getTextChapters(textId: string): TextChapter[] {
    try {
      const p = this.chaptersPath(textId)
      if (!existsSync(p)) return []
      const parsed = JSON.parse(readFileSync(p, 'utf-8')) as TextChapter[]
      return Array.isArray(parsed) ? parsed : []
    } catch (err) {
      console.error('[LibraryService] getTextChapters error:', err)
      return []
    }
  }

  public getTextChapterContent(
    textId: string,
    chapterId: string
  ): { success: boolean; content?: string; error?: string } {
    const chapter = this.getTextChapters(textId).find((c) => c.id === chapterId)
    if (!chapter) return { success: false, error: '章节不存在' }
    return { success: true, content: chapter.content || '' }
  }

  private writeChapters(textId: string, chapters: TextChapter[]): boolean {
    try {
      writeFileSync(this.chaptersPath(textId), JSON.stringify(chapters, null, 2), 'utf-8')
      return true
    } catch (err) {
      console.error('[LibraryService] write chapters error:', err)
      return false
    }
  }

  public updateTextChapterContent(
    textId: string,
    chapterId: string,
    content: string
  ): { success: boolean; error?: string } {
    const chapters = this.getTextChapters(textId)
    const index = chapters.findIndex((c) => c.id === chapterId)
    if (index === -1) return { success: false, error: '章节不存在' }
    const next = [...chapters]
    next[index] = {
      ...next[index],
      content,
      wordCount: countWords(content)
    }
    return this.writeChapters(textId, next)
      ? { success: true }
      : { success: false, error: '写入章节缓存失败' }
  }

  public updateTextChapterTitle(
    textId: string,
    chapterId: string,
    title: string
  ): { success: boolean; error?: string } {
    const chapters = this.getTextChapters(textId)
    const index = chapters.findIndex((c) => c.id === chapterId)
    if (index === -1) return { success: false, error: '章节不存在' }
    const next = [...chapters]
    next[index] = { ...next[index], title }
    return this.writeChapters(textId, next)
      ? { success: true }
      : { success: false, error: '写入章节缓存失败' }
  }

  public deleteText(id: string): { success: boolean; error?: string } {
    const ext = this.extOfId(id)
    const filePath = join(this.textsDir, `${sanitizeFileName(id)}${ext}`)
    const chaptersFile = this.chaptersPath(id)
    try {
      if (existsSync(filePath)) unlinkSync(filePath)
      if (existsSync(chaptersFile)) unlinkSync(chaptersFile)
      return { success: true }
    } catch (err) {
      console.error('[LibraryService] deleteText error:', err)
      return { success: false, error: err instanceof Error ? err.message : '删除资料失败' }
    }
  }
}

export const libraryService = new LibraryService()
