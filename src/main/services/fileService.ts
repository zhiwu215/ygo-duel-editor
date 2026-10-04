import { dialog, BrowserWindow } from 'electron'
import { readFileSync, writeFileSync } from 'fs'
import {
  DuelPuzzleState,
  generateLuaScript,
  parseLuaScript,
  generateScreenplayMarkdown
} from '@shared/index'
import { cdbService } from '../db/cdbService'

export class FileService {
  /**
   * 打开选择 cards.cdb 文件对话框
   */
  public async selectCdbFile(window?: BrowserWindow): Promise<string | null> {
    const res = await dialog.showOpenDialog(window || BrowserWindow.getFocusedWindow()!, {
      title: '选择游戏王 cards.cdb 数据库文件',
      filters: [
        { name: 'YGOPro Database', extensions: ['cdb'] },
        { name: 'All Files', extensions: ['*'] }
      ],
      properties: ['openFile']
    })

    if (res.canceled || res.filePaths.length === 0) {
      return null
    }

    return res.filePaths[0]
  }

  /**
   * 选择游戏根目录 (如 EDOPro / MDPro3)
   */
  public async selectGameDirectory(window?: BrowserWindow): Promise<string | null> {
    const res = await dialog.showOpenDialog(window || BrowserWindow.getFocusedWindow()!, {
      title: '选择游戏客户端安装根目录 (如 EDOPro / MDPro3)',
      properties: ['openDirectory']
    })

    if (res.canceled || res.filePaths.length === 0) {
      return null
    }

    return res.filePaths[0]
  }

  /**
   * 导出 Lua 脚本文件
   */
  public async exportLuaFile(
    state: DuelPuzzleState,
    targetPath?: string,
    window?: BrowserWindow
  ): Promise<{ success: boolean; filePath?: string; error?: string }> {
    try {
      let finalPath = targetPath

      if (!finalPath) {
        const defaultName = `${state.title.replace(/[\\/:*?"<>|]/g, '_') || 'custom_puzzle'}.lua`
        const res = await dialog.showSaveDialog(window || BrowserWindow.getFocusedWindow()!, {
          title: '导出游戏王残局 Lua 脚本',
          defaultPath: defaultName,
          filters: [
            { name: 'Lua Script', extensions: ['lua'] },
            { name: 'All Files', extensions: ['*'] }
          ]
        })

        if (res.canceled || !res.filePath) {
          return { success: false }
        }
        finalPath = res.filePath
      }

      // 如果缺少 card 属性，尝试补全
      const missingCardCodes = state.cards.filter((c) => !c.card).map((c) => c.code)
      if (missingCardCodes.length > 0 && cdbService.isReady()) {
        const cardMap = cdbService.getCardsByIds(missingCardCodes)
        for (const c of state.cards) {
          if (!c.card && cardMap[c.code]) {
            c.card = cardMap[c.code]
          }
        }
      }

      const luaContent = generateLuaScript(state)
      writeFileSync(finalPath, luaContent, 'utf-8')
      console.log(`[FileService] Exported lua to ${finalPath}`)
      return { success: true, filePath: finalPath }
    } catch (err) {
      console.error('[FileService] Export lua failed:', err)
      const errorMsg = err instanceof Error ? err.message : String(err)
      return { success: false, error: errorMsg }
    }
  }

  /**
   * 导入并解析已有的 Lua 脚本文件
   */
  public async importLuaFile(
    window?: BrowserWindow
  ): Promise<{ success: boolean; state?: DuelPuzzleState; error?: string }> {
    try {
      const res = await dialog.showOpenDialog(window || BrowserWindow.getFocusedWindow()!, {
        title: '导入已有游戏王残局 Lua 脚本',
        filters: [
          { name: 'Lua Script', extensions: ['lua'] },
          { name: 'All Files', extensions: ['*'] }
        ],
        properties: ['openFile']
      })

      if (res.canceled || res.filePaths.length === 0) {
        return { success: false }
      }

      const filePath = res.filePaths[0]
      const content = readFileSync(filePath, 'utf-8')
      const state = parseLuaScript(content)

      // 提取文件名作为默认标题
      const fileName = filePath
        .split(/[\\/]/)
        .pop()
        ?.replace(/\.lua$/i, '')
      if (fileName) {
        state.title = fileName
      }

      // 自动补齐已解析卡片的卡片详情
      const codes = state.cards.map((c) => c.code)
      if (codes.length > 0 && cdbService.isReady()) {
        const cardMap = cdbService.getCardsByIds(codes)
        for (const card of state.cards) {
          if (cardMap[card.code]) {
            card.card = cardMap[card.code]
          }
        }
      }

      return { success: true, state }
    } catch (err) {
      console.error('[FileService] Import lua failed:', err)
      const errorMsg = err instanceof Error ? err.message : String(err)
      return { success: false, error: errorMsg }
    }
  }

  /**
   * 保存编辑器专属工程 (.ygoduel JSON)
   */
  public async saveProjectFile(
    state: DuelPuzzleState,
    window?: BrowserWindow
  ): Promise<{ success: boolean; filePath?: string }> {
    try {
      const defaultName = `${state.title || 'project'}.ygoduel`
      const res = await dialog.showSaveDialog(window || BrowserWindow.getFocusedWindow()!, {
        title: '保存决斗编辑器工程文件',
        defaultPath: defaultName,
        filters: [
          { name: 'YGO Duel Project', extensions: ['ygoduel', 'json'] },
          { name: 'All Files', extensions: ['*'] }
        ]
      })

      if (res.canceled || !res.filePath) {
        return { success: false }
      }

      writeFileSync(res.filePath, JSON.stringify(state, null, 2), 'utf-8')
      return { success: true, filePath: res.filePath }
    } catch (err) {
      console.error('[FileService] Save project failed:', err)
      return { success: false }
    }
  }

  /**
   * 打开编辑器专属工程 (.ygoduel JSON)
   */
  public async loadProjectFile(
    window?: BrowserWindow
  ): Promise<{ success: boolean; state?: DuelPuzzleState }> {
    try {
      const res = await dialog.showOpenDialog(window || BrowserWindow.getFocusedWindow()!, {
        title: '打开决斗编辑器工程文件',
        filters: [
          { name: 'YGO Duel Project', extensions: ['ygoduel', 'json'] },
          { name: 'All Files', extensions: ['*'] }
        ],
        properties: ['openFile']
      })

      if (res.canceled || res.filePaths.length === 0) {
        return { success: false }
      }

      const content = readFileSync(res.filePaths[0], 'utf-8')
      const state = JSON.parse(content) as DuelPuzzleState
      return { success: true, state }
    } catch (err) {
      console.error('[FileService] Load project failed:', err)
      return { success: false }
    }
  }

  /**
   * 导出同人决斗台本 Markdown 文档 (.md)
   */
  public async exportScreenplayFile(
    state: DuelPuzzleState,
    window?: BrowserWindow
  ): Promise<{ success: boolean; filePath?: string; error?: string }> {
    try {
      const defaultName = `${state.title.replace(/[\\/:*?"<>|]/g, '_') || 'duel_screenplay'}.md`
      const res = await dialog.showSaveDialog(window || BrowserWindow.getFocusedWindow()!, {
        title: '导出同人决斗剧本台本 Markdown 文档',
        defaultPath: defaultName,
        filters: [
          { name: 'Markdown Document', extensions: ['md'] },
          { name: 'All Files', extensions: ['*'] }
        ]
      })

      if (res.canceled || !res.filePath) {
        return { success: false }
      }

      const mdContent = generateScreenplayMarkdown(state)
      writeFileSync(res.filePath, mdContent, 'utf-8')

      return { success: true, filePath: res.filePath }
    } catch (err: unknown) {
      console.error('[FileService] exportScreenplayFile error:', err)
      return { success: false, error: err instanceof Error ? err.message : '导出台本失败' }
    }
  }
}

export const fileService = new FileService()
