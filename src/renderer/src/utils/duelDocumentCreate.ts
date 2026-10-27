import { DuelDocumentWriteResult } from '@shared/index'
import { useDuelStore } from '../stores/useDuelStore'
import { buildDuelDocument } from './duelDocumentBuild'
import { getDuelDocumentRevision, notifyDuelDocumentSaved } from './duelDocumentAutosave'
import { nextAvailableDocumentTitle } from './duelDocumentTree'

const DEFAULT_TITLE = '未命名对局'

async function createDocument(): Promise<DuelDocumentWriteResult> {
  const current = useDuelStore.getState()
  if (current.currentProjectPath) {
    return { success: true, filePath: current.currentProjectPath }
  }
  const treeResult = await window.api.getDuelDocumentTree()
  const tree = treeResult.success && treeResult.tree ? treeResult.tree : null
  const title = nextAvailableDocumentTitle(tree, '', current.state.title?.trim() || DEFAULT_TITLE)
  const document = await buildDuelDocument()
  document.state = { ...document.state, title }
  useDuelStore.getState().setTitle(title)
  const revision = getDuelDocumentRevision()
  const result = await window.api.createDuelDocument('', document)
  if (!result.success || !result.filePath) {
    return { success: false, error: result.error ?? '自动保存台本失败' }
  }
  if (useDuelStore.getState().currentProjectPath) return result
  useDuelStore.getState().setCurrentProjectPath(result.filePath)
  notifyDuelDocumentSaved(revision)
  return result
}

let pendingCreation: Promise<DuelDocumentWriteResult> | null = null

export function createDuelDocumentForCurrentDuel(): Promise<DuelDocumentWriteResult> {
  if (pendingCreation) return pendingCreation
  pendingCreation = createDocument().finally(() => {
    pendingCreation = null
  })
  return pendingCreation
}
