import { app } from 'electron'
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
  NovelChapter,
  NovelMeta,
  countWords,
  extractEpubText,
  inferNovelTitle,
  splitNovelChapters
} from '@shared/index'

/** 小说正文文件扩展名 */
const NOVEL_EXTS = ['.txt', '.md', '.epub']

/**
 * 合法化文件名：去掉 Windows 非法字符与结尾的点
 *
 * 用户会拿作品名当文件名，原文里可能带 `/ : * ? " < > |`（如「灼華acceptable龙戏」这类同人标题），
 * 不处理会直接创建失败。
 */
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
 * 小说素材服务：AI 编排决斗对局的**原料层**
 *
 * 只存「还没变成对局」的东西：导入的原文（`novels/<id>.<ext>`）
 * 与按章节拆分的结果（`novels/<id>.chapters.json`）。
 *
 * **为什么小说独立于工程目录**：它是原始素材而非对局成品——一本书能拆出
 * 多个章节、每章可生成多个不同对局，成品统一落进 `projects/*.ygoduel`。
 * 曾经存在的「台本」层（`screenplays/*.yscript`）已删除：台本只存 steps，
 * 而 steps 里的 instanceId / boardAfter / 格子序号都指向具体盘面，
 * 脱离 .ygoduel 无法回放，属于把同一份数据存两遍。
 */
export class LibraryService {
  private novelsDir: string

  constructor() {
    this.novelsDir = join(app.getPath('userData'), 'novels')
    this.ensureDirs()
  }

  private ensureDirs(): void {
    try {
      if (!existsSync(this.novelsDir)) mkdirSync(this.novelsDir, { recursive: true })
    } catch (err) {
      console.error('[LibraryService] Failed to ensure dir:', this.novelsDir, err)
    }
  }

  /* ------------------------------ 小说素材 ------------------------------ */

  private novelId(filePath: string): string {
    return (
      filePath
        .split(/[\\/]/)
        .pop()
        ?.replace(/\.[^.]+$/, '') || 'novel'
    )
  }

  private chaptersPath(novelId: string): string {
    return join(this.novelsDir, `${sanitizeFileName(novelId)}.chapters.json`)
  }

  public getNovelList(): NovelMeta[] {
    if (!existsSync(this.novelsDir)) return []
    const metas: NovelMeta[] = []
    try {
      for (const file of readdirSync(this.novelsDir)) {
        if (!NOVEL_EXTS.some((ext) => file.toLowerCase().endsWith(ext))) continue
        const filePath = join(this.novelsDir, file)
        const id = this.novelId(filePath)
        const raw = this.readNovelRaw(filePath)
        const chapters = this.readChaptersMeta(id)
        const stat = existsSync(filePath) ? this.safeMtime(filePath) : 0
        metas.push({
          id,
          filePath,
          title: inferNovelTitle(file),
          wordCount: raw ? countWords(raw) : 0,
          // 已有拆分结果即视为可用（拆分是导入时同步完成的）
          progress: chapters.length > 0 ? 'split' : 'raw',
          chapterCount: chapters.length || undefined,
          updatedAt: stat
        })
      }
    } catch (err) {
      console.error('[LibraryService] getNovelList error:', err)
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

  private readNovelRaw(filePath: string): string {
    try {
      if (!existsSync(filePath)) return ''
      if (filePath.toLowerCase().endsWith('.epub')) {
        // EPUB 是 zip 容器，需要二进制解析；当前按 UTF-8 直读并抽标签，
        // 解析不出来时返回空串由 UI 提示「该 EPUB 暂不支持」
        return extractEpubText(readFileSync(filePath, 'utf-8'))
      }
      return readFileSync(filePath, 'utf-8')
    } catch (err) {
      console.error('[LibraryService] readNovelRaw error:', filePath, err)
      return ''
    }
  }

  private readChaptersMeta(novelId: string): Array<Omit<NovelChapter, 'content'>> {
    try {
      const p = this.chaptersPath(novelId)
      if (!existsSync(p)) return []
      const parsed = JSON.parse(readFileSync(p, 'utf-8')) as NovelChapter[]
      if (!Array.isArray(parsed)) return []
      return parsed.map((chapter) => ({
        id: chapter.id,
        novelId: chapter.novelId,
        title: chapter.title,
        index: chapter.index,
        wordCount: chapter.wordCount
      }))
    } catch (err) {
      console.error('[LibraryService] readChaptersMeta error:', err)
      return []
    }
  }

  public importNovelFile(pickedPaths: string[]): {
    success: boolean
    novel?: NovelMeta
    error?: string
  } {
    if (pickedPaths.length === 0) return { success: false, error: '未选择文件' }
    this.ensureDirs()
    const first = pickedPaths[0]
    const baseName = first.split(/[\\/]/).pop() || 'novel.txt'
    // 原文件复制进资料库：用户从网上下载的文件可能随时被清理
    const destPath = join(this.novelsDir, baseName)
    try {
      writeFileSync(destPath, readFileSync(first))
    } catch (err) {
      console.error('[LibraryService] importNovelFile copy error:', err)
      return { success: false, error: '复制文件失败' }
    }

    const meta = this.resplit(destPath)
    return meta
      ? { success: true, novel: meta }
      : { success: false, error: '导入失败：无法解析文件内容（EPUB 需为解压后的文本）' }
  }

  private resplit(filePath: string): NovelMeta | null {
    const id = this.novelId(filePath)
    const raw = this.readNovelRaw(filePath)
    if (!raw.trim()) return null

    const title = inferNovelTitle(filePath.split(/[\\/]/).pop() || id)
    const result = splitNovelChapters(raw, title)
    if (result.chapters.length === 0) return null

    const chapters: NovelChapter[] = result.chapters.map((c) => ({
      id: `ch_${c.index}`,
      novelId: id,
      title: c.title,
      index: c.index,
      wordCount: c.wordCount,
      content: c.content
    }))
    try {
      writeFileSync(this.chaptersPath(id), JSON.stringify(chapters, null, 2), 'utf-8')
    } catch (err) {
      console.error('[LibraryService] write chapters error:', err)
      return null
    }

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

  public resplitNovel(id: string): { success: boolean; novel?: NovelMeta; error?: string } {
    const filePath = join(this.novelsDir, `${sanitizeFileName(id)}${this.extOfId(id)}`)
    if (!existsSync(filePath)) return { success: false, error: '资料文件不存在' }
    const meta = this.resplit(filePath)
    return meta ? { success: true, novel: meta } : { success: false, error: '重新拆分失败' }
  }

  private extOfId(id: string): string {
    // 列表里 id 是去掉扩展名的文件名，重新拆分时要还原扩展名
    for (const ext of NOVEL_EXTS) {
      if (existsSync(join(this.novelsDir, `${sanitizeFileName(id)}${ext}`))) return ext
    }
    return '.txt'
  }

  public getNovelChapters(novelId: string): NovelChapter[] {
    try {
      const p = this.chaptersPath(novelId)
      if (!existsSync(p)) return []
      const parsed = JSON.parse(readFileSync(p, 'utf-8')) as NovelChapter[]
      return Array.isArray(parsed) ? parsed : []
    } catch (err) {
      console.error('[LibraryService] getNovelChapters error:', err)
      return []
    }
  }

  public getNovelChapterContent(
    novelId: string,
    chapterId: string
  ): { success: boolean; content?: string; error?: string } {
    const chapter = this.getNovelChapters(novelId).find((c) => c.id === chapterId)
    if (!chapter) return { success: false, error: '章节不存在' }
    return { success: true, content: chapter.content || '' }
  }

  public deleteNovel(id: string): { success: boolean; error?: string } {
    const ext = this.extOfId(id)
    const filePath = join(this.novelsDir, `${sanitizeFileName(id)}${ext}`)
    const chaptersFile = this.chaptersPath(id)
    try {
      if (existsSync(filePath)) unlinkSync(filePath)
      if (existsSync(chaptersFile)) unlinkSync(chaptersFile)
      return { success: true }
    } catch (err) {
      console.error('[LibraryService] deleteNovel error:', err)
      return { success: false, error: err instanceof Error ? err.message : '删除资料失败' }
    }
  }
}

export const libraryService = new LibraryService()
