import { app, BrowserWindow, dialog, shell } from 'electron'
import { join } from 'path'
import { existsSync, readFileSync, writeFileSync } from 'fs'
import { randomUUID } from 'crypto'
import { is } from '@electron-toolkit/utils'
import { DeckData, parseYdk, generateYdk } from '@shared/index'
import icon from '../../../resources/icon.png?asset'
import { configService } from './configService'

const PRESET_DECKS: DeckData[] = [
  {
    id: 'deck_preset_story_darkness',
    name: '【同人剧情】主角暗黑神力觉醒·20额外真红眼',
    description:
      '同人剧场版剧情终章决斗：主角在绝境关头突破极限，决斗盘涌现暗黑神力，获得统御 20 张超模额外卡组的同人专属特权！',
    coverCard: 74677422,
    tags: ['同人剧情', '主角神力', '20张额外'],
    main: [
      74677422, 74677422, 74677422, 93717133, 93717133, 93717133, 44887817, 44887817, 44887817,
      36261276, 36261276, 14558127, 14558127, 14558127, 24224830, 24224830, 24224830, 72302403,
      72302403, 72302403, 12580477, 12580477, 66362965, 66362965, 66362965, 41426818, 41426818,
      27551, 27551, 55144522, 55144522, 9411399, 9411399, 18144506, 18144506, 18144506, 23434538,
      23434538, 70368879, 70368879
    ],
    extra: [
      88241506, 45349196, 66970002, 90660762, 85289965, 21250202, 60800381, 74997493, 2403771,
      38342335, 41999284, 88177324, 73580471, 99267150, 4280258, 65305468, 2857636, 86066372,
      38814408, 14812471
    ],
    side: [14558127, 44887817, 93717133, 72302403, 70368879],
    updatedAt: 1728000000000
  },
  {
    id: 'deck_preset_combo_standard',
    name: '【Combo教学】百夫长骑士·单卡标准做场演示',
    description:
      'Combo 展开讲解与做场推演：特异特勒单卡动，检索石像，做场赤霄+鲜花+重骑士加速同调压制教学。',
    coverCard: 66970002,
    tags: ['Combo教学', '做场演示', '展开教学'],
    main: [
      14558127, 14558127, 14558127, 24224830, 24224830, 24224830, 72302403, 72302403, 72302403,
      12580477, 12580477, 12580477, 66362965, 66362965, 41426818, 41426818, 55144522, 55144522,
      9411399, 9411399, 18144506, 18144506, 18144506, 23434538, 23434538, 70368879, 70368879,
      36261276, 36261276, 93717133, 93717133, 93717133, 44887817, 44887817, 44887817, 74677422,
      74677422, 74677422, 27551, 27551
    ],
    extra: [
      66970002, 90660762, 85289965, 21250202, 60800381, 74997493, 2403771, 38342335, 41999284,
      88177324, 73580471, 99267150, 4280258, 65305468, 2857636
    ],
    side: [14558127, 44887817, 93717133],
    updatedAt: 1728000000000
  },
  {
    id: 'deck_preset_puzzle_breakthrough',
    name: '【残局特化】突破神之阵·绝境逆转解场特化',
    description:
      '残局推演专用：对局终盘仅剩 100 生命值，针对高打点全抗场面，利用特异魔陷与墓地触发连锁完成不可思议的逆转。',
    coverCard: 88241506,
    tags: ['残局特化', '解场推演', '绝境逆转'],
    main: [
      14558127, 14558127, 24224830, 24224830, 72302403, 72302403, 12580477, 12580477, 66362965,
      66362965, 41426818, 41426818, 55144522, 55144522, 9411399, 9411399, 18144506, 18144506,
      23434538, 23434538, 70368879, 70368879, 36261276, 36261276, 93717133, 93717133, 44887817,
      44887817, 74677422, 74677422, 27551, 27551, 88241506, 45349196, 66970002, 90660762, 85289965,
      21250202, 60800381, 74997493
    ],
    extra: [
      88241506, 45349196, 66970002, 90660762, 85289965, 21250202, 60800381, 74997493, 2403771,
      38342335, 41999284, 88177324
    ],
    side: [14558127, 44887817],
    updatedAt: 1728000000000
  }
]

export class DeckService {
  private deckWindow: BrowserWindow | null = null
  private libraryFilePath: string

  constructor() {
    this.libraryFilePath = join(app.getPath('userData'), 'ygo_duel_editor_decks.json')
    this.ensureLibraryFile()
  }

  /**
   * 初始化卡组资产库文件 (若不存在则注入示例卡组)
   */
  private ensureLibraryFile(): void {
    try {
      if (!existsSync(this.libraryFilePath)) {
        writeFileSync(this.libraryFilePath, JSON.stringify(PRESET_DECKS, null, 2), 'utf-8')
      }
    } catch (err) {
      console.error('[DeckService] Failed to initialize library file:', err)
    }
  }

  /**
   * 读取所有已保存的卡组列表
   */
  public getDeckList(): DeckData[] {
    try {
      this.ensureLibraryFile()
      if (existsSync(this.libraryFilePath)) {
        const raw = readFileSync(this.libraryFilePath, 'utf-8')
        const list = JSON.parse(raw) as DeckData[]
        return Array.isArray(list) ? list : []
      }
    } catch (err) {
      console.error('[DeckService] getDeckList error:', err)
    }
    return []
  }

  /**
   * 保存或更新卡组到本地卡组库
   */
  public saveDeckToLibrary(deck: DeckData): { success: boolean; deck: DeckData } {
    try {
      const list = this.getDeckList()
      const targetDeck: DeckData = {
        ...deck,
        id: deck.id || `deck_${randomUUID().replace(/-/g, '')}`,
        updatedAt: Date.now()
      }

      const existingIndex = list.findIndex((d) => d.id === targetDeck.id)
      if (existingIndex >= 0) {
        list[existingIndex] = targetDeck
      } else {
        list.unshift(targetDeck)
      }

      writeFileSync(this.libraryFilePath, JSON.stringify(list, null, 2), 'utf-8')
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
      const list = this.getDeckList()
      const nextList = list.filter((d) => d.id !== id)
      writeFileSync(this.libraryFilePath, JSON.stringify(nextList, null, 2), 'utf-8')
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
      const list = this.getDeckList()
      const target = list.find((d) => d.id === id)
      if (!target) return null

      const cloned: DeckData = {
        ...target,
        id: `deck_${randomUUID().replace(/-/g, '')}`,
        name: `${target.name} (副本)`,
        updatedAt: Date.now()
      }

      list.unshift(cloned)
      writeFileSync(this.libraryFilePath, JSON.stringify(list, null, 2), 'utf-8')
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
      width: 1360,
      height: 880,
      minWidth: 1080,
      minHeight: 700,
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
