import { dialog, BrowserWindow } from 'electron'
import { readFileSync, writeFileSync } from 'fs'
import {
  DuelPuzzleState,
  generateScreenplayMarkdown,
  EngineSessionDoc,
  EngineSessionFileResult,
  EngineSessionLoadResult,
  parseEngineSessionDoc
} from '@shared/index'
import { sanitizeFileName, sanitizeProjectFileName } from '../utils/fileName'
import { toErrorMessageOr } from '../utils/errors'

export class SessionDocFileService {
  public async exportScreenplayFile(
    state: DuelPuzzleState,
    window?: BrowserWindow
  ): Promise<{ success: boolean; filePath?: string; error?: string }> {
    try {
      const defaultName = `${sanitizeFileName(state.title) || 'duel_screenplay'}.md`
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
      return { success: false, error: toErrorMessageOr(err, '导出台本失败') }
    }
  }

  public async exportSessionDocFile(
    doc: EngineSessionDoc,
    window?: BrowserWindow
  ): Promise<EngineSessionFileResult> {
    try {
      const title = sanitizeProjectFileName(doc.initParams.puzzleState?.title || '对局剧本')
      const res = await dialog.showSaveDialog(window || BrowserWindow.getFocusedWindow()!, {
        title: '导出对局剧本',
        defaultPath: `${title}.ygoscene.json`,
        filters: [
          { name: 'YGO 对局剧本', extensions: ['json'] },
          { name: 'All Files', extensions: ['*'] }
        ]
      })
      if (res.canceled || !res.filePath) {
        return { success: false, canceled: true }
      }
      writeFileSync(res.filePath, JSON.stringify(doc, null, 2), 'utf-8')
      return { success: true, filePath: res.filePath }
    } catch (err) {
      console.error('[FileService] exportSessionDocFile failed:', err)
      return { success: false, error: toErrorMessageOr(err, '导出对局剧本失败') }
    }
  }

  public async loadSessionDocFile(window?: BrowserWindow): Promise<EngineSessionLoadResult> {
    try {
      const res = await dialog.showOpenDialog(window || BrowserWindow.getFocusedWindow()!, {
        title: '载入对局剧本',
        filters: [
          { name: 'YGO 对局剧本', extensions: ['json'] },
          { name: 'All Files', extensions: ['*'] }
        ],
        properties: ['openFile']
      })
      if (res.canceled || res.filePaths.length === 0) {
        return { success: false, canceled: true }
      }
      const filePath = res.filePaths[0]
      const doc = parseEngineSessionDoc(JSON.parse(readFileSync(filePath, 'utf-8')))
      return { success: true, doc, filePath }
    } catch (err) {
      console.error('[FileService] loadSessionDocFile failed:', err)
      return { success: false, error: toErrorMessageOr(err, '读取对局剧本失败') }
    }
  }
}

export const sessionDocFileService = new SessionDocFileService()
