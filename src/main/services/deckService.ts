import { app, BrowserWindow, dialog, shell } from 'electron'
import { join } from 'path'
import { existsSync, readFileSync, writeFileSync } from 'fs'
import { randomUUID } from 'crypto'
import { is } from '@electron-toolkit/utils'
import {
  DeckData,
  DeckLibrary,
  parseYdk,
  generateYdk,
  groupChildPath,
  groupLeafName,
  groupParentPath,
  groupAncestorPaths,
  isGroupDescendant
} from '@shared/index'
import icon from '../../../resources/icon.png?asset'
import { configService } from './configService'

const LEGACY_PRESET_DECK_IDS = new Set([
  'deck_preset_story_darkness',
  'deck_preset_combo_standard',
  'deck_preset_puzzle_breakthrough'
])

export class DeckService {
  private deckWindow: BrowserWindow | null = null
  private libraryFilePath: string

  constructor() {
    this.libraryFilePath = join(app.getPath('userData'), 'ygo_duel_editor_decks.json')
  }

  /**
   * 读取完整卡组库（分组 + 卡组），并清除旧版本注入的示例卡组
   *
   * 分组是独立实体：允许存在「一个卡组都没有」的分组，用户才能预建分类。
   */
  public getLibrary(): DeckLibrary {
    try {
      if (!existsSync(this.libraryFilePath)) return { groups: [], decks: [] }

      const raw = readFileSync(this.libraryFilePath, 'utf-8')
      const parsed = JSON.parse(raw) as DeckLibrary | DeckData[]

      // 分组成为独立实体后，文件结构从 DeckData[] 变成 DeckLibrary。
      // 这里做一次性就地升级而不是让用户丢卡组：旧结构是纯数组，
      // 包一层并把已有的 group 字段回填进分组列表即可。
      if (Array.isArray(parsed)) {
        const groups = Array.from(
          new Set(parsed.map((d) => d.group?.trim()).filter((g): g is string => Boolean(g)))
        )
        const migrated: DeckLibrary = { groups, decks: parsed }
        this.writeLibrary(migrated)
        const cleaned = migrated.decks.filter(
          (deck) => !deck.id || !LEGACY_PRESET_DECK_IDS.has(deck.id)
        )
        if (cleaned.length !== migrated.decks.length) {
          this.writeLibrary({ groups, decks: cleaned })
        }
        return { groups, decks: cleaned }
      }

      const groups = Array.isArray(parsed?.groups) ? parsed.groups : []
      const allDecks = Array.isArray(parsed?.decks) ? parsed.decks : []
      const userDecks = allDecks.filter((deck) => !deck.id || !LEGACY_PRESET_DECK_IDS.has(deck.id))
      if (userDecks.length !== allDecks.length) {
        this.writeLibrary({ groups, decks: userDecks })
      }
      return { groups, decks: userDecks }
    } catch (err) {
      console.error('[DeckService] getLibrary error:', err)
    }
    return { groups: [], decks: [] }
  }

  /** 覆写整个卡组库文件 */
  private writeLibrary(library: DeckLibrary): void {
    writeFileSync(this.libraryFilePath, JSON.stringify(library, null, 2), 'utf-8')
  }

  /**
   * 读取所有已保存的卡组列表（不含分组）
   */
  public getDeckList(): DeckData[] {
    return this.getLibrary().decks
  }

  public createGroup(name: string, parent?: string | null): boolean {
    const trimmed = name.trim()
    if (!trimmed) return false
    const library = this.getLibrary()
    const parentPath = parent?.trim() || null
    if (parentPath && !library.groups.includes(parentPath)) return false
    const path = groupChildPath(parentPath, trimmed)
    if (library.groups.includes(path)) return false
    library.groups.push(path)
    this.writeLibrary(library)
    return true
  }

  public renameGroup(oldPath: string, newName: string): boolean {
    const trimmed = newName.trim()
    if (!trimmed || trimmed === groupLeafName(oldPath)) return false
    const library = this.getLibrary()
    const index = library.groups.indexOf(oldPath)
    if (index < 0) return false
    const newPath = groupChildPath(groupParentPath(oldPath), trimmed)
    if (newPath === oldPath) return false
    if (library.groups.includes(newPath)) return false

    const remap = (path: string | undefined): string | undefined => {
      if (!path) return path
      if (path === oldPath) return newPath
      return isGroupDescendant(path, oldPath) ? newPath + path.slice(oldPath.length) : path
    }

    library.groups = library.groups.map((g) => remap(g) as string)
    library.decks = library.decks.map((d) => ({ ...d, group: remap(d.group) }))
    this.writeLibrary(library)
    return true
  }

  public deleteGroup(path: string): boolean {
    const library = this.getLibrary()
    const index = library.groups.indexOf(path)
    if (index < 0) return false

    const parent = groupParentPath(path) || ''
    const removed = library.groups.filter((g) => g === path || isGroupDescendant(g, path))
    library.groups = library.groups.filter((g) => !removed.includes(g))
    library.decks = library.decks.map((d) =>
      d.group && removed.includes(d.group) ? { ...d, group: parent } : d
    )
    this.writeLibrary(library)
    return true
  }

  /**
   * 把卡组移动到指定分组（传空串表示移回未分组）
   */
  public assignDeckToGroup(deckId: string, group: string): boolean {
    const library = this.getLibrary()
    const index = library.decks.findIndex((d) => d.id === deckId)
    if (index < 0) return false
    library.decks[index] = { ...library.decks[index], group, updatedAt: Date.now() }
    this.writeLibrary(library)
    return true
  }

  public saveDeckToLibrary(deck: DeckData): { success: boolean; deck: DeckData } {
    try {
      const library = this.getLibrary()
      const targetDeck: DeckData = {
        ...deck,
        id: deck.id || `deck_${randomUUID().replace(/-/g, '')}`,
        updatedAt: Date.now()
      }

      const existingIndex = library.decks.findIndex((d) => d.id === targetDeck.id)
      if (existingIndex >= 0) {
        library.decks[existingIndex] = targetDeck
      } else {
        library.decks.unshift(targetDeck)
      }

      const group = targetDeck.group?.trim()
      if (group) {
        for (const ancestor of groupAncestorPaths(group)) {
          if (!library.groups.includes(ancestor)) library.groups.push(ancestor)
        }
      }

      this.writeLibrary(library)
      return { success: true, deck: targetDeck }
    } catch (err) {
      console.error('[DeckService] saveDeckToLibrary error:', err)
      return { success: false, deck }
    }
  }

  /**
   * 从本地卡组库删除卡组
   */
  public deleteDeckFromLibrary(id: string): boolean {
    try {
      const library = this.getLibrary()
      library.decks = library.decks.filter((d) => d.id !== id)
      this.writeLibrary(library)
      return true
    } catch (err) {
      console.error('[DeckService] deleteDeckFromLibrary error:', err)
      return false
    }
  }

  /**
   * 克隆已有卡组为副本并入库
   */
  public duplicateDeckInLibrary(id: string): DeckData | null {
    try {
      const library = this.getLibrary()
      const target = library.decks.find((d) => d.id === id)
      if (!target) return null

      const cloned: DeckData = {
        ...target,
        id: `deck_${randomUUID().replace(/-/g, '')}`,
        name: `${target.name} (副本)`,
        updatedAt: Date.now()
      }

      library.decks.unshift(cloned)
      this.writeLibrary(library)
      return cloned
    } catch (err) {
      console.error('[DeckService] duplicateDeckInLibrary error:', err)
      return null
    }
  }

  /**
   * 打开或聚焦卡组编辑器独立窗口
   */
  public openDeckEditorWindow(): void {
    if (this.deckWindow && !this.deckWindow.isDestroyed()) {
      if (this.deckWindow.isMinimized()) {
        this.deckWindow.restore()
      }
      this.deckWindow.show()
      this.deckWindow.focus()
      return
    }

    this.deckWindow = new BrowserWindow({
      width: 1280,
      height: 800,
      minWidth: 960,
      minHeight: 560,
      show: false,
      autoHideMenuBar: true,
      // 与主窗口 / 设置窗一致：无边框，标题栏由渲染层自绘
      // (卡组库 header 与编辑台工具栏兼作标题栏，见 WindowControls.tsx)
      frame: false,
      title: '卡组编辑器 - YGO Duel Editor',
      icon,
      webPreferences: {
        preload: join(__dirname, '../preload/index.js'),
        sandbox: false
      }
    })

    this.deckWindow.on('ready-to-show', () => {
      this.deckWindow?.show()
    })

    this.deckWindow.on('closed', () => {
      this.deckWindow = null
    })

    this.deckWindow.webContents.setWindowOpenHandler((details) => {
      shell.openExternal(details.url)
      return { action: 'deny' }
    })

    if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
      this.deckWindow.loadURL(`${process.env['ELECTRON_RENDERER_URL']}#deck-editor`)
    } else {
      this.deckWindow.loadFile(join(__dirname, '../renderer/index.html'), {
        hash: 'deck-editor'
      })
    }
  }

  /**
   * 将编辑好的卡组推送应用到决斗主窗口
   */
  public applyDeckToDuel(params: { player: 0 | 1; deck: DeckData; drawCount?: number }): boolean {
    const windows = BrowserWindow.getAllWindows()
    let sent = false

    for (const win of windows) {
      // 发送给非卡组编辑器的窗口 (即主决斗盘窗口)
      if (win !== this.deckWindow && !win.isDestroyed()) {
        win.webContents.send('deck:applied-to-duel', params)
        sent = true
      }
    }

    return sent
  }

  /**
   * 保存卡组为标准 .ydk 格式
   */
  public async saveDeckFile(
    deck: DeckData,
    window?: BrowserWindow
  ): Promise<{ success: boolean; filePath?: string; error?: string }> {
    try {
      const defaultName = `${deck.name.replace(/[\\/:*?"<>|]/g, '_') || 'deck'}.ydk`
      const activeWin = window || this.deckWindow || BrowserWindow.getFocusedWindow()!
      const res = await dialog.showSaveDialog(activeWin, {
        title: '保存游戏王卡组 (.ydk)',
        defaultPath: defaultName,
        filters: [
          { name: 'YGOPro Deck (.ydk)', extensions: ['ydk'] },
          { name: 'All Files', extensions: ['*'] }
        ]
      })

      if (res.canceled || !res.filePath) {
        return { success: false }
      }

      const ydkText = generateYdk(deck)
      writeFileSync(res.filePath, ydkText, 'utf-8')

      return { success: true, filePath: res.filePath }
    } catch (err: unknown) {
      console.error('[DeckService] saveDeckFile error:', err)
      return { success: false, error: err instanceof Error ? err.message : '保存卡组失败' }
    }
  }

  /**
   * 选择并读取外部标准 .ydk 文件
   */
  public async loadDeckFile(
    window?: BrowserWindow
  ): Promise<{ success: boolean; deck?: DeckData; filePath?: string; error?: string }> {
    try {
      const activeWin = window || this.deckWindow || BrowserWindow.getFocusedWindow()!
      const res = await dialog.showOpenDialog(activeWin, {
        title: '导入游戏王卡组 (.ydk)',
        filters: [
          { name: 'YGOPro Deck (.ydk)', extensions: ['ydk'] },
          { name: 'All Files', extensions: ['*'] }
        ],
        properties: ['openFile']
      })

      if (res.canceled || res.filePaths.length === 0) {
        return { success: false }
      }

      const filePath = res.filePaths[0]
      const rawText = readFileSync(filePath, 'utf-8')
      const fileName =
        filePath
          .replace(/\\/g, '/')
          .split('/')
          .pop()
          ?.replace(/\.ydk$/i, '') || '导入卡组'
      const deck = parseYdk(rawText, fileName)

      return { success: true, deck, filePath }
    } catch (err: unknown) {
      console.error('[DeckService] loadDeckFile error:', err)
      return { success: false, error: err instanceof Error ? err.message : '读取卡组失败' }
    }
  }

  /**
   * 获取用户收藏夹卡密列表
   */
  public getFavorites(): number[] {
    const cfg = configService.get()
    return cfg.favorites || []
  }

  /**
   * 切换卡片收藏状态并向所有窗口广播
   */
  public toggleFavorite(code: number): { isFavorite: boolean; favorites: number[] } {
    const current = this.getFavorites()
    const set = new Set(current)
    let isFavorite: boolean

    if (set.has(code)) {
      set.delete(code)
      isFavorite = false
    } else {
      set.add(code)
      isFavorite = true
    }

    const nextFavorites = Array.from(set)
    configService.save({ favorites: nextFavorites })

    // 向所有窗口广播收藏变更事件
    const windows = BrowserWindow.getAllWindows()
    for (const win of windows) {
      if (!win.isDestroyed()) {
        win.webContents.send('favorites:changed', nextFavorites)
      }
    }

    return { isFavorite, favorites: nextFavorites }
  }
}

export const deckService = new DeckService()
