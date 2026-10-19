import { dialog, BrowserWindow } from 'electron'
import { readFileSync } from 'fs'
import { toErrorMessageOr } from '../utils/errors'

export interface YrpFileLoadResult {
  success: boolean
  canceled?: boolean
  filePath?: string
  fileName?: string
  bytes?: Uint8Array
  error?: string
}

export class YrpReplayFileService {
  public async loadYrpFile(window?: BrowserWindow): Promise<YrpFileLoadResult> {
    try {
      const res = await dialog.showOpenDialog(window || BrowserWindow.getFocusedWindow()!, {
        title: '导入 YRP 回放',
        filters: [
          { name: 'YGOPro 回放', extensions: ['yrp', 'yrp3d'] },
          { name: 'All Files', extensions: ['*'] }
        ],
        properties: ['openFile']
      })
      if (res.canceled || res.filePaths.length === 0) {
        return { success: false, canceled: true }
      }
      const filePath = res.filePaths[0]
      const bytes = new Uint8Array(readFileSync(filePath))
      const fileName = filePath.split(/[\\/]/).pop() ?? filePath
      return { success: true, filePath, fileName, bytes }
    } catch (err) {
      console.error('[YrpReplayFileService] loadYrpFile failed:', err)
      return { success: false, error: toErrorMessageOr(err, '读取 YRP 录像失败') }
    }
  }
}

export const yrpReplayFileService = new YrpReplayFileService()
