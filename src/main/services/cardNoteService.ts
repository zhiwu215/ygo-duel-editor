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
import icon from '../../../resources/icon.png?asset'

const LIBRARY_FILE = 'card_notes.json'
const LIBRARY_VERSION = '1.0.0'

const LEGACY_FILE = 'summon_chants.json'

const DEFAULT_FILE = 'card_default.json'

export class CardNoteService {
  private filePath: string
  private window: BrowserWindow | null = null

  constructor() {
    this.filePath = join(app.getPath('userData'), LIBRARY_FILE)
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
    return { notes: {}, updatedAt: 0, version: LIBRARY_VERSION }
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

        return parsed
          .filter((e) => e && Number.isFinite(e.cardCode) && e.cardCode > 0)
          .map((e): CardNote => ({
            cardCode: this.normalizeCode(e.cardCode),
            kind: e.kind === 'note' ? 'note' : 'chant',
            label: (e.label || '').trim(),
            text: (e.text || '').trim(),
            user: e.user,
            source: e.source,
            readonly: true,
            updatedAt: 0
          }))
          .filter((e) => e.label && e.text)
      } catch (err) {
        console.error('[CardNoteService] 读取预置图鉴失败:', path, err)
      }
    }
    console.warn('[CardNoteService] 未找到 card_default.json，仅显示用户自录条目')
    return []
  }

  private readLibrary(): CardNoteLibrary {
    const raw = this.readFile(this.filePath)
    if (raw) {
      const parsed = raw as Partial<CardNoteLibrary> & {
        chants?: Record<string, Omit<CardNote, 'kind'>[]>
      }
      if (parsed.notes && typeof parsed.notes === 'object') {
        return {
          notes: parsed.notes,
          updatedAt: parsed.updatedAt || 0,
          version: parsed.version || LIBRARY_VERSION
        }
      }

      if (parsed.chants && typeof parsed.chants === 'object') {
        return this.migrateLegacy({ chants: parsed.chants } as never, parsed.updatedAt || 0)
      }
    }

    const legacyRaw = this.readFile(join(app.getPath('userData'), LEGACY_FILE))
    if (legacyRaw) {
      const legacy = legacyRaw as {
        chants?: Record<string, Omit<CardNote, 'kind'>[]>
        updatedAt?: number
      }
      if (legacy.chants && Object.keys(legacy.chants).length > 0) {
        const migrated = this.migrateLegacy(legacy, legacy.updatedAt || 0)
        this.writeLibrary(migrated)
        console.log(
          `[CardNoteService] 已从 ${LEGACY_FILE} 迁移 ${Object.keys(migrated.notes).length} 张卡的召唤词`
        )
        return migrated
      }
    }
    return this.emptyLibrary()
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

  private migrateLegacy(
    legacy: { chants?: Record<string, Omit<CardNote, 'kind'>[]> },
    updatedAt: number
  ): CardNoteLibrary {
    const src = legacy as { chants?: Record<string, Omit<CardNote, 'kind'>[]> }
    const notes: Record<string, CardNote[]> = {}
    for (const [key, list] of Object.entries(src.chants ?? {})) {
      if (!Array.isArray(list) || list.length === 0) continue
      notes[key] = list.map((c) => ({ ...c, kind: 'chant' as CardNoteKind }))
    }
    return { notes, updatedAt, version: LIBRARY_VERSION }
  }

  private writeLibrary(lib: CardNoteLibrary): { success: boolean; error?: string } {
    try {
      const dir = join(app.getPath('userData'))
      if (!existsSync(dir)) mkdirSync(dir, { recursive: true })
      writeFileSync(
        this.filePath,
        JSON.stringify({ ...lib, updatedAt: Date.now(), version: LIBRARY_VERSION }, null, 2),
        'utf-8'
      )
      return { success: true }
    } catch (err) {
      console.error('[CardNoteService] 写入手记库失败:', err)
      return { success: false, error: err instanceof Error ? err.message : '写入失败' }
    }
  }

  public getNotes(cardCode: number, kind?: CardNoteKind | 'all'): CardNote[] {
    const lib = this.readLibrary()
    const root = this.normalizeCode(cardCode)
    const keys = new Set<string>([String(root), String(cardCode)])
    for (const v of this.variantCodesOf(root)) keys.add(String(v))

    const legacyKeys = new Set<string>()
    for (const key of keys) if (key !== String(root)) legacyKeys.add(key)
    const orderedKeys = [...legacyKeys, String(root)]

    const byKey = new Map<string, CardNote>()
    for (const key of orderedKeys) {
      const list = lib.notes[key]
      if (!Array.isArray(list)) continue
      for (const c of list) {
        if (kind && kind !== 'all' && c.kind !== kind) continue
        byKey.set(`${c.kind}::${c.label}`, c)
      }
    }

    for (const d of this.readDefaults()) {
      if (d.cardCode !== root) continue
      if (kind && kind !== 'all' && d.kind !== kind) continue
      byKey.set(`${d.kind}::${d.label}`, d)
    }

    return Array.from(byKey.values()).sort((a, b) => a.label.localeCompare(b.label, 'zh-CN'))
  }

  public listAll(): CardNoteEntry[] {
    const lib = this.readLibrary()

    const legacy = new Map<number, CardNote[]>()
    const normal = new Map<number, CardNote[]>()
    for (const [key, list] of Object.entries(lib.notes)) {
      if (!Array.isArray(list) || list.length === 0) continue
      const raw = Number(key)
      if (!Number.isFinite(raw) || raw <= 0) continue
      const root = this.normalizeCode(raw)
      const bucket = raw === root ? normal : legacy
      bucket.set(root, [...(bucket.get(root) ?? []), ...list])
    }

    for (const d of this.readDefaults()) {
      normal.set(d.cardCode, [...(normal.get(d.cardCode) ?? []), d])
    }

    const roots = new Set([...normal.keys(), ...legacy.keys()])
    if (roots.size === 0) return []

    const codes = Array.from(roots)
    let nameMap: Record<number, CdbCard> = {}
    try {
      nameMap = cdbService.getCardsByIds(codes)
    } catch (err) {
      console.error('[CardNoteService] 批量取卡名失败，回退为显示卡密:', err)
    }

    return codes
      .map((code) => {
        const byKey = new Map<string, CardNote>()
        for (const c of [...(legacy.get(code) ?? []), ...(normal.get(code) ?? [])]) {
          byKey.set(`${c.kind}::${c.label}`, c)
        }
        const all = Array.from(byKey.values())
        if (all.length === 0) return null
        return {
          cardCode: code,
          cardName: nameMap[code]?.name || `卡密 ${code}`,
          variantCodes: this.variantCodesOf(code),
          chants: all
            .filter((c) => c.kind === 'chant')
            .sort((a, b) => a.label.localeCompare(b.label, 'zh-CN')),
          notes: all
            .filter((c) => c.kind === 'note')
            .sort((a, b) => a.label.localeCompare(b.label, 'zh-CN'))
        }
      })
      .filter((x): x is CardNoteEntry => x !== null)
      .sort((a, b) => a.cardName.localeCompare(b.cardName, 'zh-CN'))
  }

  public saveNote(note: CardNote): { success: boolean; error?: string } {
    const code = this.normalizeCode(note.cardCode)
    const kind: CardNoteKind = note.kind === 'note' ? 'note' : 'chant'
    const label = (note.label || '').trim()
    const text = (note.text || '').trim()
    if (!Number.isFinite(code) || code <= 0) return { success: false, error: '卡密无效' }
    if (!label) {
      return { success: false, error: kind === 'chant' ? '请填写版本名称' : '请填写条目标题' }
    }
    if (!text) return { success: false, error: '内容不能为空' }

    const isPreset = this.readDefaults().some(
      (d) => d.cardCode === code && d.kind === kind && d.label === label
    )
    if (isPreset) {
      return { success: false, error: '这是内置的经典条目，不可修改；可以复制后另存为新版本' }
    }

    const lib = this.readLibrary()
    const key = String(code)
    const list = Array.isArray(lib.notes[key]) ? [...lib.notes[key]] : []
    const idx = list.findIndex((c) => c.kind === kind && c.label === label)
    const entry: CardNote = { cardCode: code, kind, label, text, updatedAt: Date.now() }
    if (idx >= 0) list[idx] = entry
    else list.push(entry)

    lib.notes[key] = list
    return this.writeLibrary(lib)
  }

  public deleteNote(
    cardCode: number,
    kind: CardNoteKind,
    label: string
  ): { success: boolean; error?: string } {
    const root0 = this.normalizeCode(cardCode)

    if (
      this.readDefaults().some((d) => d.cardCode === root0 && d.kind === kind && d.label === label)
    ) {
      return { success: false, error: '这是内置的经典条目，不可删除' }
    }

    const lib = this.readLibrary()

    const root = this.normalizeCode(cardCode)
    const keys = new Set<string>([String(root), String(cardCode)])

    for (const key of keys) {
      const list = lib.notes[key]
      if (!Array.isArray(list)) continue
      const next = label
        ? list.filter((c) => !(c.kind === kind && c.label === label))
        : list.filter((c) => c.kind !== kind)
      if (next.length === 0) delete lib.notes[key]
      else lib.notes[key] = next
    }
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

    const parsed = raw as Partial<CardNoteLibrary> & {
      chants?: Record<string, Omit<CardNote, 'kind'>[]>
    }
    const incoming: CardNote[] = []
    const collect = (list: unknown, fallbackKind: CardNoteKind): void => {
      if (!Array.isArray(list)) return
      for (const item of list) {
        const c = item as Partial<CardNote>
        if (!c || !Number.isFinite(c.cardCode) || (c.cardCode as number) <= 0) continue
        if (!c.label?.trim() || !c.text?.trim()) continue
        incoming.push({
          cardCode: c.cardCode as number,
          kind: c.kind === 'note' ? 'note' : fallbackKind,
          label: c.label.trim(),
          text: c.text.trim(),
          user: c.user,
          source: c.source,
          updatedAt: c.updatedAt || Date.now()
        })
      }
    }
    if (parsed.notes && typeof parsed.notes === 'object') {
      for (const list of Object.values(parsed.notes)) collect(list, 'chant')
    } else if (parsed.chants && typeof parsed.chants === 'object') {
      for (const list of Object.values(parsed.chants)) collect(list, 'chant')
    } else if (Array.isArray(raw)) {
      collect(raw, 'chant')
    }

    if (incoming.length === 0) {
      return { success: false, error: '文件里没有可导入的条目' }
    }

    const lib = this.readLibrary()
    for (const note of incoming) {
      const code = this.normalizeCode(note.cardCode)
      const key = String(code)
      const list = Array.isArray(lib.notes[key]) ? [...lib.notes[key]] : []
      const idx = list.findIndex((c) => c.kind === note.kind && c.label === note.label)
      const entry: CardNote = { ...note, cardCode: code, updatedAt: Date.now() }
      if (idx >= 0) list[idx] = entry
      else list.push(entry)
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
