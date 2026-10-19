import { useCallback } from 'react'
import { alertDialog } from '../stores/useDialogStore'

interface DeckFileExportResult {
  success: boolean
  filePath?: string
  error?: string
}

export function useDeckFileExport(): (save: () => Promise<DeckFileExportResult>) => Promise<void> {
  return useCallback(async (save) => {
    const res = await save()
    if (res.success && res.filePath) {
      void alertDialog(`卡组已成功导出：\n${res.filePath}`)
    } else if (res.error) {
      void alertDialog(`导出失败: ${res.error}`)
    }
  }, [])
}
