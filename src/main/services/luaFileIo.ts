import { dialog, BrowserWindow } from 'electron'
import { readFileSync, writeFileSync } from 'fs'
import { DuelPuzzleState, generateLuaScript, parseLuaScript } from '@shared/index'
import { sanitizeFileName } from '../utils/fileName'
import { toErrorMessage } from '../utils/errors'
import { completeCardDetails } from './completeCardDetails'

export class LuaFileIo {
  public async exportLuaFile(
    state: DuelPuzzleState,
    targetPath?: string,
    window?: BrowserWindow
  ): Promise<{ success: boolean; filePath?: string; error?: string }> {
    try {
      let finalPath = targetPath

      if (!finalPath) {
        const defaultName = `${sanitizeFileName(state.title) || 'custom_puzzle'}.lua`
        const res = await dialog.showSaveDialog(window || BrowserWindow.getFocusedWindow()!, {
          title: '导出游戏王残局脚本',
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

      completeCardDetails(state)

      const luaContent = generateLuaScript(state)
      writeFileSync(finalPath, luaContent, 'utf-8')
      console.log(`[FileService] Exported lua to ${finalPath}`)
      return { success: true, filePath: finalPath }
    } catch (err) {
      console.error('[FileService] Export lua failed:', err)
      return { success: false, error: toErrorMessage(err) }
    }
  }

  public async importLuaFile(
    window?: BrowserWindow
  ): Promise<{ success: boolean; state?: DuelPuzzleState; error?: string }> {
    try {
      const res = await dialog.showOpenDialog(window || BrowserWindow.getFocusedWindow()!, {
        title: '导入已有游戏王残局脚本',
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

      const fileName = filePath
        .split(/[\\/]/)
        .pop()
        ?.replace(/\.lua$/i, '')
      if (fileName) {
        state.title = fileName
      }

      completeCardDetails(state)

      return { success: true, state }
    } catch (err) {
      console.error('[FileService] Import lua failed:', err)
      return { success: false, error: toErrorMessage(err) }
    }
  }
}

export const luaFileIo = new LuaFileIo()
