import { useState } from 'react'
import { DuelPuzzleState } from '@shared/index'
import { alertDialog } from '../stores/useDialogStore'

export function useScreenplayExport(state: DuelPuzzleState): {
  savedToArchive: boolean
  handleExportMarkdown: () => Promise<void>
  handleSaveToArchive: () => Promise<void>
} {
  const [savedToArchive, setSavedToArchive] = useState<boolean>(false)

  const handleExportMarkdown = async (): Promise<void> => {
    if (!window.api?.exportScreenplayFile) return
    const res = await window.api.exportScreenplayFile(state)
    if (res.success && res.filePath) {
      void alertDialog(`决斗剧本台本已成功导出：\n${res.filePath}`)
    } else if (res.error) {
      void alertDialog(`导出失败: ${res.error}`)
    }
  }

  const handleSaveToArchive = async (): Promise<void> => {
    if (!window.api?.saveProjectToLibrary) return
    if ((state.steps || []).length === 0) {
      void alertDialog('还没有任何步骤，先编排或让 AI 转写后再存入档案。')
      return
    }
    const res = await window.api.saveProjectToLibrary(state)
    if (res.success && res.filePath) {
      setSavedToArchive(true)
      setTimeout(() => setSavedToArchive(false), 2500)
    } else {
      void alertDialog(`存入档案失败: ${res.error || '未知错误'}`)
    }
  }

  return { savedToArchive, handleExportMarkdown, handleSaveToArchive }
}
