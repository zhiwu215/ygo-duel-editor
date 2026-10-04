import { BrowserWindow, dialog, shell } from 'electron'
import { join } from 'path'
import { readFileSync, writeFileSync } from 'fs'
import { is } from '@electron-toolkit/utils'
import { DeckData, parseYdk, generateYdk } from '@shared/index'
import icon from '../../../resources/icon.png?asset'
import { configService } from './configService'

export class DeckService {
  private deckWindow: BrowserWindow | null = null

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
      width: 1360,
      height: 880,
      minWidth: 1080,
      minHeight: 700,
      show: false,
      autoHideMenuBar: true,
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
