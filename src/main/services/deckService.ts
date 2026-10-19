import { BrowserWindow, dialog, shell } from 'electron'
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
import { dataDirService } from './dataDirService'
import { broadcastToWindows } from './broadcast'

const LIBRARY_FILE = 'ygo_duel_editor_decks.json'

const LEGACY_PRESET_DECK_IDS = new Set([
  'deck_preset_story_darkness',
  'deck_preset_combo_standard',
  'deck_preset_puzzle_breakthrough'
])

export class DeckService {
  private deckWindow: BrowserWindow | null = null
  private pendingEditDeck: DeckData | null = null

  private get libraryFilePath(): string {
    return dataDirService.resolve(LIBRARY_FILE)
  }
  public getLibrary(): DeckLibrary {
    try {
      if (!existsSync(this.libraryFilePath)) return { groups: [], decks: [] }

      const raw = readFileSync(this.libraryFilePath, 'utf-8')
      const parsed = JSON.parse(raw) as DeckLibrary | DeckData[]
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
  private writeLibrary(library: DeckLibrary): void {
    writeFileSync(this.libraryFilePath, JSON.stringify(library, null, 2), 'utf-8')
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
  public openDeckEditorWindow(deckId?: string): void {
    const deck = deckId ? (this.getLibrary().decks.find((d) => d.id === deckId) ?? null) : null

    if (this.deckWindow && !this.deckWindow.isDestroyed()) {
      if (this.deckWindow.isMinimized()) {
        this.deckWindow.restore()
      }
      this.deckWindow.show()
      this.deckWindow.focus()
      if (deck) this.deckWindow.webContents.send('deck:open-in-editor', deck)
      return
    }

    this.pendingEditDeck = deck

    this.deckWindow = new BrowserWindow({
      width: 1280,
      height: 800,
      minWidth: 960,
      minHeight: 560,
      show: false,
      autoHideMenuBar: true,
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
      this.pendingEditDeck = null
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
  public consumePendingDeckToEdit(): DeckData | null {
    const deck = this.pendingEditDeck
    this.pendingEditDeck = null
    return deck
  }
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
  public getFavorites(): number[] {
    const cfg = configService.get()
    return cfg.favorites || []
  }
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

    broadcastToWindows('favorites:changed', nextFavorites)

    return { isFavorite, favorites: nextFavorites }
  }
}

export const deckService = new DeckService()
