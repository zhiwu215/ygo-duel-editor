import type { DuelDocumentReadResult } from '@shared/index'
import { confirmDialog } from '../stores/useDialogStore'
import { nextAvailableDocumentTitle } from './duelDocumentTree'
import { documentTitleFromPath } from './duelDocumentTitle'

export async function readDuelDocumentForEditing(
  targetPath: string
): Promise<DuelDocumentReadResult> {
  const result = await window.api.readDuelDocument(targetPath)
  if (!result.success && result.recoveryState) {
    const state = result.recoveryState
    const recover = await confirmDialog({
      title: '从盘面和台词恢复副本',
      description: result.error + '。副本将保存到台本库，原文件保留。',
      confirmText: '创建恢复副本'
    })
    if (!recover) return { success: false, error: '已取消恢复副本。' }
    const library = await window.api.getDuelDocumentTree()
    if (!library.tree) return { success: false, error: library.error }
    const title = nextAvailableDocumentTitle(
      library.tree,
      '',
      documentTitleFromPath(targetPath) + '_恢复'
    )
    const document = { state: { ...state, title } }
    const created = await window.api.createDuelDocument('', document)
    if (!created.success || !created.filePath) return { success: false, error: created.error }
    return { success: true, document, filePath: created.filePath }
  }
  return result
}
