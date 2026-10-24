import type { DuelDocumentWriteResult } from '@shared/index'
import { useDuelStore } from '../stores/useDuelStore'
import { useDuelEngineStore } from '../stores/useDuelEngineStore'
import { buildDuelDocument } from './duelDocumentBuild'
import { clearDuelDocumentDraft } from './duelDocumentDraft'
import {
  flushDuelDocumentAutosave,
  getDuelDocumentRevision,
  hasUnsavedDuelDocument,
  notifyDuelDocumentSaved,
  resumeDuelDocumentAutosave,
  suspendDuelDocumentAutosave
} from './duelDocumentAutosave'

function selectOpenedStep(engineRestored: boolean): void {
  const opened = useDuelStore.getState()
  const steps = opened.state.steps ?? []
  if (steps.length === 0) return
  if (!engineRestored) {
    opened.setSelectedStepId(steps[0].id)
    opened.setCurrentStepIndex(0)
    opened.previewStepBoard(0)
    return
  }
  const currentStepId = useDuelEngineStore.getState().currentStepId
  const found = currentStepId
    ? steps.findIndex(
        (step) =>
          step.actId === currentStepId ||
          step.startActId === currentStepId ||
          step.endActId === currentStepId
      )
    : -1
  const index = found >= 0 ? found : steps.length - 1
  opened.setSelectedStepId(steps[index].id)
  opened.setCurrentStepIndex(index)
}

export async function openDuelDocument(
  filePath: string
): Promise<{ success: boolean; error?: string }> {
  const flushed = await flushDuelDocumentAutosave()
  if (!flushed && hasUnsavedDuelDocument()) {
    return {
      success: false,
      error: '当前台本没有自动保存成功，已取消打开以免丢失修改。请先手动保存或退出预览后重试。'
    }
  }
  suspendDuelDocumentAutosave()
  try {
    const result = await window.api.readDuelDocument(filePath)
    if (!result.success || !result.document) {
      return { success: false, error: result.error ?? '读取对局文档失败' }
    }
    const engineStore = useDuelEngineStore.getState()
    if (engineStore.isInitialized) {
      engineStore.stopEngine()
    }
    const duelStore = useDuelStore.getState()
    duelStore.loadProjectAndStart(result.document.state)
    duelStore.setCurrentProjectPath(filePath)
    let engineRestored = false
    if (result.document.engine) {
      const support = await window.api.getDuelEngineSupport()
      if (support.supported) {
        const restored = await useDuelEngineStore
          .getState()
          .restoreSessionDoc(result.document.engine)
        if (!restored) {
          return {
            success: false,
            error: useDuelEngineStore.getState().error ?? '恢复引擎会话失败'
          }
        }
        engineRestored = true
      }
    }
    selectOpenedStep(engineRestored)
    clearDuelDocumentDraft()
    return { success: true }
  } finally {
    resumeDuelDocumentAutosave()
  }
}

export async function saveDuelDocument(saveAs = false): Promise<DuelDocumentWriteResult> {
  await flushDuelDocumentAutosave()
  const revision = getDuelDocumentRevision()
  const document = await buildDuelDocument()
  if (useDuelEngineStore.getState().isInitialized && !document.engine) {
    return { success: false, error: '引擎会话快照不可用，已取消保存以免丢失对局进度。' }
  }
  const currentPath = useDuelStore.getState().currentProjectPath
  if (!saveAs && currentPath) {
    const result = await window.api.saveDuelDocument(currentPath, document)
    if (result.success) {
      notifyDuelDocumentSaved(revision)
      return result
    }
  }
  const result = await window.api.saveDuelDocumentDialog(document)
  if (result.success) {
    if (result.filePath) {
      useDuelStore.getState().setCurrentProjectPath(result.filePath)
    }
    notifyDuelDocumentSaved(revision)
  }
  return result
}
