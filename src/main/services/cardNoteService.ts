import { app, dialog, BrowserWindow, shell } from 'electron'
import { is } from '@electron-toolkit/utils'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs'
import { join } from 'path'
import {
  CardNote,
  CardNoteEntry,
  CardNoteKind,
  CardNoteLibrary,
  CdbCard,
  DefaultCardNote
} from '@shared/index'
import { cdbService } from '../db/cdbService'
import { dataDirService } from './dataDirService'
import icon from '../../../resources/icon.png?asset'

const LIBRARY_FILE = 'card_notes.json'

const DEFAULT_FILE = 'card_default.json'

export class CardNoteService {
  private window: BrowserWindow | null = null

  private get filePath(): string {
    return dataDirService.resolve(LIBRARY_FILE)
  }

  normalizeCode(cardCode: number): number {
    if (!Number.isFinite(cardCode) || cardCode <= 0) return cardCode
    try {
      const card = cdbService.getCardById(cardCode)
      return card?.alias ? card.alias : cardCode
    } catch {
      return cardCode
    }
  }

  private variantCodesOf(rootCode: number): number[] {
    try {
      return cdbService.getAliasGroupIds(rootCode)
    } catch {
      return [rootCode]
    }
  }

  private emptyLibrary(): CardNoteLibrary {
    return { notes: {} }
  }

  private defaultPathCandidates(): string[] {
    return [
      join(__dirname, '../../resources', DEFAULT_FILE),
      join(__dirname, '../../../resources/app.asar.unpack/resources', DEFAULT_FILE),

      join(process.resourcesPath ?? '', DEFAULT_FILE),
      join(process.resourcesPath ?? '', 'app.asar.unpack/resources', DEFAULT_FILE)
    ]
  }

  private readDefaults(): CardNote[] {
    for (const path of this.defaultPathCandidates()) {
      try {
        if (!existsSync(path)) continue
        const parsed = JSON.parse(readFileSync(path, 'utf-8')) as DefaultCardNote[]
        if (!Array.isArray(parsed)) continue

        const byKey = new Map<string, CardNote>()
        for (const e of parsed) {
          if (!e || !Number.isFinite(e.cardCode) || e.cardCode <= 0) continue
          const note: CardNote = {
            cardCode: this.normalizeCode(e.cardCode),
            kind: e.kind === 'note' ? 'note' : 'chant',
            title: (e.title || '').trim(),
            text: (e.text || '').trim(),
            user: e.user,
            source: e.source,
            readonly: true
          }
          if (!note.title || !note.text) continue
          const k = `${note.kind}::${note.title}`
          if (byKey.has(k)) {
            console.warn('[CardNoteService] card_default.json 存在重复条目:', k)
            continue
          }
          byKey.set(k, note)
        }
        return [...byKey.values()]
      } catch (err) {
        console.error('[CardNoteService] 读取预置图鉴失败:', path, err)
      }
    }
    console.warn('[CardNoteService] 未找到 card_default.json，仅显示用户自录条目')
    return []
  }

  private readLibrary(): CardNoteLibrary {
    const raw = this.readFile(this.filePath)
    if (!raw) return this.emptyLibrary()
    const parsed = raw as Partial<CardNoteLibrary>
    if (!parsed.notes || typeof parsed.notes !== 'object') return this.emptyLibrary()
    const notes: Record<string, CardNote[]> = {}
    for (const [key, list] of Object.entries(parsed.notes)) {
      const code = Number(key)
      if (!Number.isFinite(code) || code <= 0 || this.normalizeCode(code) !== code) continue
      const entries = this.normalizeEntries(list)
      if (entries.length > 0) notes[key] = entries
    }
    return { notes }
  }

  private readFile(path: string): Record<string, unknown> | null {
    try {
      if (!existsSync(path)) return null
      const parsed = JSON.parse(readFileSync(path, 'utf-8')) as Record<string, unknown>
      if (!parsed || typeof parsed !== 'object') return null
      return parsed
    } catch (err) {
      console.error('[CardNoteService] 读取手记库失败:', path, err)
      return null
    }
  }

  private normalizeEntry(c: Partial<CardNote>): CardNote | null {
    const title = (c.title ?? '').trim()
    const text = (c.text ?? '').trim()
    if (!Number.isFinite(c.cardCode) || (c.cardCode as number) <= 0) return null
    if (!title || !text) return null
    const entry: CardNote = {
      cardCode: c.cardCode as number,
      kind: c.kind === 'note' ? 'note' : 'chant',
      title,
      text
    }
    if (c.user && c.user.trim()) entry.user = c.user.trim()
    if (c.source && c.source.trim()) entry.source = c.source.trim()
    return entry
  }

  private normalizeEntries(list: unknown): CardNote[] {
    if (!Array.isArray(list)) return []
    return list
      .map((c) => this.normalizeEntry(c as Partial<CardNote>))
      .filter((c): c is CardNote => c !== null)
  }

  private writeLibrary(lib: CardNoteLibrary): { success: boolean; error?: string } {
    try {
      const dir = dataDirService.getDataDirectory()
      if (!existsSync(dir)) mkdirSync(dir, { recursive: true })
      writeFileSync(this.filePath, JSON.stringify(lib, null, 2), 'utf-8')
      return { success: true }
    } catch (err) {
      console.error('[CardNoteService] 写入手记库失败:', err)
      return { success: false, error: err instanceof Error ? err.message : '写入失败' }
    }
  }

  public getNotes(cardCode: number, kind?: CardNoteKind | 'all'): CardNote[] {
    const lib = this.readLibrary()
    const root = this.normalizeCode(cardCode)
    const byKey = new Map<string, CardNote>()
    const presetKeys = new Set<string>()

    const list = lib.notes[String(root)]
    if (Array.isArray(list)) {
      for (const c of list) {
        if (kind && kind !== 'all' && c.kind !== kind) continue
        const k = `${c.kind}::${c.title}`
        if (!byKey.has(k)) byKey.set(k, c)
      }
    }

    for (const d of this.readDefaults()) {
      if (d.cardCode !== root) continue
      if (kind && kind !== 'all' && d.kind !== kind) continue
      const k = `${d.kind}::${d.title}`
      presetKeys.add(k)
      if (!byKey.has(k)) byKey.set(k, d)
    }

    return this.sortForDisplay(Array.from(byKey.values()), presetKeys)
  }

  private sortForDisplay(list: CardNote[], presetKeys: Set<string>): CardNote[] {
    return list
      .map((note, index) => ({ note, index }))
      .sort((a, b) => {
        const pa = a.note.readonly || presetKeys.has(`${a.note.kind}::${a.note.title}`) ? 0 : 1
        const pb = b.note.readonly || presetKeys.has(`${b.note.kind}::${b.note.title}`) ? 0 : 1
        if (pa !== pb) return pa - pb
        return a.index - b.index
      })
      .map((x) => x.note)
  }

  public listAll(): CardNoteEntry[] {
    const lib = this.readLibrary()
    const byCode = new Map<number, CardNote[]>()
    for (const [key, list] of Object.entries(lib.notes)) {
      if (!Array.isArray(list) || list.length === 0) continue
      const raw = Number(key)
      if (!Number.isFinite(raw) || raw <= 0 || this.normalizeCode(raw) !== raw) continue
      byCode.set(raw, [...(byCode.get(raw) ?? []), ...list])
    }

    for (const d of this.readDefaults()) {
      byCode.set(d.cardCode, [...(byCode.get(d.cardCode) ?? []), d])
    }

    const codes = [...byCode.keys()]
    if (codes.length === 0) return []

    let nameMap: Record<number, CdbCard> = {}
    try {
      nameMap = cdbService.getCardsByIds(codes)
    } catch (err) {
      console.error('[CardNoteService] 批量取卡名失败，回退为显示卡密:', err)
    }

    return codes
      .map((code) => {
        const byKey = new Map<string, CardNote>()
        const presetKeys = new Set<string>()
        for (const c of byCode.get(code) ?? []) {
          if (c.readonly) presetKeys.add(`${c.kind}::${c.title}`)
          const k = `${c.kind}::${c.title}`
          if (!byKey.has(k)) byKey.set(k, c)
        }
        const all = this.sortForDisplay(Array.from(byKey.values()), presetKeys)
        if (all.length === 0) return null
        return {
          cardCode: code,
          cardName: nameMap[code]?.name || `卡密 ${code}`,
          variantCodes: this.variantCodesOf(code),
          chants: all.filter((c) => c.kind === 'chant'),
          notes: all.filter((c) => c.kind === 'note')
        }
      })
      .filter((x): x is CardNoteEntry => x !== null)
      .sort((a, b) => a.cardName.localeCompare(b.cardName, 'zh-CN'))
  }

  public saveNote(note: CardNote, originalTitle?: string): { success: boolean; error?: string } {
    const code = this.normalizeCode(note.cardCode)
    const kind: CardNoteKind = note.kind === 'note' ? 'note' : 'chant'
    const title = (note.title || '').trim()
    const text = (note.text || '').trim()
    if (!Number.isFinite(code) || code <= 0) return { success: false, error: '卡密无效' }
    if (!title) return { success: false, error: '请填写标题' }
    if (!text) return { success: false, error: '内容不能为空' }

    const isPreset = this.readDefaults().some(
      (d) => d.cardCode === code && d.kind === kind && d.title === title
    )
    if (isPreset) {
      return { success: false, error: `「${title}」是内置经典条目，请换一个标题` }
    }

    const lib = this.readLibrary()
    const key = String(code)
    const list = Array.isArray(lib.notes[key]) ? [...lib.notes[key]] : []

    const origin = (originalTitle || '').trim()
    const dupIdx = list.findIndex((c) => c.kind === kind && c.title === title)
    if (origin) {
      const idx = list.findIndex((c) => c.kind === kind && c.title === origin)
      if (idx < 0) {
        return { success: false, error: `原条目「${origin}」不存在，可能已被删除` }
      }
      if (dupIdx >= 0 && dupIdx !== idx) {
        return { success: false, error: `已存在「${title}」，请换一个标题` }
      }
      list.splice(idx, 1)
    } else if (dupIdx >= 0) {
      return { success: false, error: `已存在「${title}」，请换一个标题` }
    }

    const entry: CardNote = { cardCode: code, kind, title, text }
    if (note.source && note.source.trim()) entry.source = note.source.trim()
    if (note.user && note.user.trim()) entry.user = note.user.trim()
    list.unshift(entry)

    lib.notes[key] = list
    return this.writeLibrary(lib)
  }

  public reorderNotes(
    cardCode: number,
    kind: CardNoteKind,
    titles: string[]
  ): { success: boolean; error?: string } {
    const code = this.normalizeCode(cardCode)
    if (!Number.isFinite(code) || code <= 0) return { success: false, error: '卡密无效' }
    const k: CardNoteKind = kind === 'note' ? 'note' : 'chant'

    const lib = this.readLibrary()
    const key = String(code)
    const list = lib.notes[key] ?? []
    const target = list.filter((c) => c.kind === k)
    if (target.length === 0) return { success: false, error: '没有可排序的条目' }

    const rank = new Map<string, number>()
    titles.forEach((title, i) => rank.set(`${k}::${title}`, i))
    const known = target.filter((c) => rank.has(`${c.kind}::${c.title}`))
    const rest = target.filter((c) => !rank.has(`${c.kind}::${c.title}`))
    if (known.length === 0) return { success: false, error: '没有可排序的条目' }

    known.sort(
      (a, b) => (rank.get(`${a.kind}::${a.title}`) ?? 0) - (rank.get(`${b.kind}::${b.title}`) ?? 0)
    )

    lib.notes[key] = [...known, ...rest, ...list.filter((c) => c.kind !== k)]
    return this.writeLibrary(lib)
  }

  public deleteNote(
    cardCode: number,
    kind: CardNoteKind,
    title: string
  ): { success: boolean; error?: string } {
    const root = this.normalizeCode(cardCode)

    if (
      this.readDefaults().some((d) => d.cardCode === root && d.kind === kind && d.title === title)
    ) {
      return { success: false, error: '这是内置的经典条目，不可删除' }
    }

    const lib = this.readLibrary()
    const key = String(root)
    const list = lib.notes[key]
    if (!Array.isArray(list)) return { success: true }

    const next = title
      ? list.filter((c) => !(c.kind === kind && c.title === title))
      : list.filter((c) => c.kind !== kind)
    if (next.length === 0) delete lib.notes[key]
    else lib.notes[key] = next
    return this.writeLibrary(lib)
  }

  public async exportLibrary(): Promise<{
    success: boolean
    filePath?: string
    error?: string
  }> {
    try {
      const res = await dialog.showSaveDialog(BrowserWindow.getFocusedWindow()!, {
        title: '导出卡牌图鉴',
        defaultPath: join(app.getPath('documents'), 'card_notes.json'),
        filters: [{ name: 'JSON', extensions: ['json'] }]
      })
      if (res.canceled || !res.filePath) return { success: false }
      writeFileSync(res.filePath, JSON.stringify(this.readLibrary(), null, 2), 'utf-8')
      return { success: true, filePath: res.filePath }
    } catch (err) {
      console.error('[CardNoteService] 导出失败:', err)
      return { success: false, error: err instanceof Error ? err.message : '导出失败' }
    }
  }

  public async importLibrary(): Promise<{
    success: boolean
    imported?: number
    error?: string
  }> {
    let raw: Record<string, unknown>
    try {
      const res = await dialog.showOpenDialog(BrowserWindow.getFocusedWindow()!, {
        title: '导入卡牌图鉴',
        defaultPath: app.getPath('documents'),
        filters: [{ name: 'JSON', extensions: ['json'] }]
      })
      if (res.canceled || res.filePaths.length === 0) return { success: false }
      raw = this.readFile(res.filePaths[0]) ?? {}
    } catch (err) {
      console.error('[CardNoteService] 导入失败:', err)
      return { success: false, error: err instanceof Error ? err.message : '导入失败' }
    }

    const parsed = raw as Partial<CardNoteLibrary>
    if (!parsed.notes || typeof parsed.notes !== 'object') {
      return { success: false, error: '文件格式不正确' }
    }
    const incoming: CardNote[] = []
    for (const list of Object.values(parsed.notes)) {
      incoming.push(...this.normalizeEntries(list))
    }

    if (incoming.length === 0) {
      return { success: false, error: '文件里没有可导入的条目' }
    }

    const lib = this.readLibrary()
    for (const note of incoming) {
      const code = this.normalizeCode(note.cardCode)
      const key = String(code)
      const list = Array.isArray(lib.notes[key]) ? [...lib.notes[key]] : []
      const idx = list.findIndex((c) => c.kind === note.kind && c.title === note.title)
      const entry: CardNote = { ...note, cardCode: code }
      if (idx >= 0) list.splice(idx, 1)
      list.unshift(entry)
      lib.notes[key] = list
    }
    const written = this.writeLibrary(lib)
    if (!written.success) return written
    return { success: true, imported: incoming.length }
  }

  public openWindow(): void {
    if (this.window && !this.window.isDestroyed()) {
      if (this.window.isMinimized()) this.window.restore()
      this.window.show()
      this.window.focus()
      return
    }

    this.window = new BrowserWindow({
      width: 1080,
      height: 760,
      minWidth: 760,
      minHeight: 520,
      show: false,
      autoHideMenuBar: true,
      frame: false,
      title: '卡牌图鉴 - YGO Duel Editor',
      icon,
      webPreferences: {
        preload: join(__dirname, '../preload/index.js'),
        sandbox: false
      }
    })

    this.window.on('ready-to-show', () => {
      this.window?.show()
    })

    this.window.on('closed', () => {
      this.window = null
    })

    this.window.webContents.setWindowOpenHandler((details) => {
      shell.openExternal(details.url)
      return { action: 'deny' }
    })

    if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
      this.window.loadURL(`${process.env['ELECTRON_RENDERER_URL']}#card-notes`)
    } else {
      this.window.loadFile(join(__dirname, '../renderer/index.html'), {
        hash: 'card-notes'
      })
    }
  }
}

export const cardNoteService = new CardNoteService()
