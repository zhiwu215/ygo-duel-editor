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
  ScreenplayDoc,
  ScreenplayMeta,
  countWords,
  extractEpubText,
  inferNovelTitle,
  splitNovelChapters
} from '@shared/index'
import { configService } from './configService'

/** 台本文件扩展名 */
const SCREENPLAY_EXT = '.yscript'
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
 * 资料库服务：台本（剧情编排）与小说资料（AI 编排素材）
 *
 * 两者都**独立于决斗工程**存储在userData 下：
 * - 台本放在 `screenplays/`，一个台本一个 `.yscript` JSON
 * - 小说放在 `novels/`（原文件）+ `novels/<id>.chapters.json`（拆分结果）
 *
 * 为什么不塞进工程目录：台本是「创作灵感层」，可以脱离任何具体盘面存在；
 * 混进projects/ 会和 .ygoduel 工程文件混在一起，列表扫描与用户预期都会乱。
 */
export class LibraryService {
  private screenplaysDir: string
  private novelsDir: string

  constructor() {
    const base = app.getPath('userData')
    this.screenplaysDir = join(base, 'screenplays')
    this.novelsDir = join(base, 'novels')
    this.ensureDirs()
  }

  private ensureDirs(): void {
    for (const dir of [this.screenplaysDir, this.novelsDir]) {
      try {
        if (!existsSync(dir)) mkdirSync(dir, { recursive: true })
      } catch (err) {
        console.error('[LibraryService] Failed to ensure dir:', dir, err)
      }
    }
  }

  private screenplaysRoot(): string {
    const custom = configService.get().projectsDirectory
    if (custom && existsSync(custom)) {
      const dir = join(custom, 'screenplays')
      try {
        if (!existsSync(dir)) mkdirSync(dir, { recursive: true })
      } catch (err) {
        console.error('[LibraryService] Failed to ensure custom screenplays dir:', err)
      }
      return dir
    }
    this.ensureDirs()
    return this.screenplaysDir
  }

  /* ------------------------------ 台本 ------------------------------ */

  private screenplaysPath(id: string): string {
    return join(this.screenplaysRoot(), `${sanitizeFileName(id)}${SCREENPLAY_EXT}`)
  }

  public getScreenplayList(): ScreenplayMeta[] {
    const root = this.screenplaysRoot()
    if (!existsSync(root)) return []
    const metas: ScreenplayMeta[] = []
    try {
      for (const file of readdirSync(root)) {
        if (!file.endsWith(SCREENPLAY_EXT)) continue
        const filePath = join(root, file)
        const doc = this.readScreenplayDoc(filePath)
        if (!doc) continue
        metas.push({
          id: doc.id,
          filePath,
          title: doc.title || doc.id,
          synopsis: doc.synopsis,
          tags: doc.tags,
          stepCount: Array.isArray(doc.steps) ? doc.steps.length : 0,
          updatedAt: doc.updatedAt || 0,
          cardCodes: Array.from(
            new Set((doc.steps || []).map((s) => s.cardCode).filter((c): c is number => Boolean(c)))
          )
        })
      }
    } catch (err) {
      console.error('[LibraryService] getScreenplayList error:', err)
    }
    return metas.sort((a, b) => b.updatedAt - a.updatedAt)
  }

  private readScreenplayDoc(filePath: string): ScreenplayDoc | null {
    try {
      if (!existsSync(filePath)) return null
      const parsed = JSON.parse(readFileSync(filePath, 'utf-8')) as ScreenplayDoc
      if (!parsed || typeof parsed !== 'object') return null
      if (!Array.isArray(parsed.steps)) return null
      return parsed
    } catch (err) {
      console.error('[LibraryService] readScreenplayDoc error:', filePath, err)
      return null
    }
  }

  public createScreenplay(title: string): { success: boolean; id?: string; error?: string } {
    const clean = title.trim()
    if (!clean) return { success: false, error: '台本标题不能为空' }
    const id = sanitizeFileName(clean)
    const filePath = this.screenplaysPath(id)
    if (existsSync(filePath)) return { success: false, error: '已存在同名台本' }

    const doc: ScreenplayDoc = {
      id,
      title: clean,
      synopsis: '',
      tags: [],
      steps: [],
      updatedAt: Date.now(),
      version: '1.0.0'
    }
    try {
      writeFileSync(filePath, JSON.stringify(doc, null, 2), 'utf-8')
      return { success: true, id }
    } catch (err) {
      console.error('[LibraryService] createScreenplay error:', err)
      return { success: false, error: err instanceof Error ? err.message : '创建台本失败' }
    }
  }

  public saveScreenplay(screenplay: ScreenplayDoc): { success: boolean; error?: string } {
    const id = sanitizeFileName(screenplay.id || screenplay.title || '未命名')
    const doc: ScreenplayDoc = {
      ...screenplay,
      id,
      title: screenplay.title?.trim() || id,
      steps: Array.isArray(screenplay.steps) ? screenplay.steps : [],
      updatedAt: Date.now(),
      version: screenplay.version || '1.0.0'
    }
    try {
      writeFileSync(this.screenplaysPath(id), JSON.stringify(doc, null, 2), 'utf-8')
      return { success: true }
    } catch (err) {
      console.error('[LibraryService] saveScreenplay error:', err)
      return { success: false, error: err instanceof Error ? err.message : '保存台本失败' }
    }
  }

  public loadScreenplay(id: string): { success: boolean; screenplay?: ScreenplayDoc } {
    const doc = this.readScreenplayDoc(this.screenplaysPath(id))
    if (!doc) return { success: false }
    return { success: true, screenplay: doc }
  }

  public deleteScreenplay(id: string): { success: boolean; error?: string } {
    const filePath = this.screenplaysPath(id)
    try {
      if (existsSync(filePath)) unlinkSync(filePath)
      return { success: true }
    } catch (err) {
      console.error('[LibraryService] deleteScreenplay error:', err)
      return { success: false, error: err instanceof Error ? err.message : '删除台本失败' }
    }
  }

  public duplicateScreenplay(id: string): { success: boolean; id?: string; error?: string } {
    const src = this.readScreenplayDoc(this.screenplaysPath(id))
    if (!src) return { success: false, error: '台本不存在' }
    // 加时间戳避免与「(副本)」在多次复制时重名
    const newId = `${src.id}_副本${Date.now().toString(36).slice(-4)}`
    return this.saveScreenplay({ ...src, id: newId, title: `${src.title} (副本)` })
  }

  /* ------------------------------ 小说资料 ------------------------------ */

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
