import { BrowserWindow, dialog } from 'electron'
import { writeFileSync } from 'fs'
import { DuelPuzzleState, generateScreenplayMarkdown } from '@shared/index'
import { configService } from './configService'
import { sanitizeFileName } from '../utils/fileName'
import { toErrorMessageOr } from '../utils/errors'

export class ScreenplayMarkdownService {
  public async exportScreenplayFile(
    state: DuelPuzzleState,
    window?: BrowserWindow
  ): Promise<{ success: boolean; filePath?: string; error?: string }> {
    try {
      const defaultName = `${sanitizeFileName(state.title) || 'duel_screenplay'}.md`
      const result = await dialog.showSaveDialog(window || BrowserWindow.getFocusedWindow()!, {
        title: '导出同人决斗剧本台本 Markdown 文档',
        defaultPath: defaultName,
        filters: [
          { name: 'Markdown Document', extensions: ['md'] },
          { name: 'All Files', extensions: ['*'] }
        ]
      })

      if (result.canceled || !result.filePath) {
        return { success: false }
      }

      writeFileSync(
        result.filePath,
        generateScreenplayMarkdown(state, {
          cardNameWrapper: configService.get().cardNameWrapper
        }),
        'utf-8'
      )
      return { success: true, filePath: result.filePath }
    } catch (err) {
      console.error('[ScreenplayMarkdownService] exportScreenplayFile failed:', err)
      return { success: false, error: toErrorMessageOr(err, '导出台本失败') }
    }
  }
}

export const screenplayMarkdownService = new ScreenplayMarkdownService()
