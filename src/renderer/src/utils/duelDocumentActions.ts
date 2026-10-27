import {
  boardFingerprintMatches,
  computeBoardFingerprint,
  duelPhaseFromMask,
  reversePileSequences,
  reverseStepBoards
} from '@shared/index'
import type {
  DuelDocumentWriteResult,
  DuelPuzzleState,
  DuelStep,
  EngineSessionDoc
} from '@shared/index'
import { useDuelStore } from '../stores/useDuelStore'
import { useDuelEngineStore } from '../stores/useDuelEngineStore'
import { buildDuelDocument } from './duelDocumentBuild'
import { clearDuelDocumentDraft } from './duelDocumentDraft'
import {
  commitDuelDocumentTitle,
  documentTitleFromPath,
  flushDuelDocumentTitle
} from './duelDocumentTitle'
import {
  flushDuelDocumentAutosave,
  getDuelDocumentRevision,
  hasUnsavedDuelDocument,
  notifyDuelDocumentSaved,
  resumeDuelDocumentAutosave,
  suspendDuelDocumentAutosave
} from './duelDocumentAutosave'

function findStepIndex(steps: DuelStep[], actId: string | null): number {
  if (!actId) return -1
  return steps.findIndex(
    (step) => step.actId === actId || step.startActId === actId || step.endActId === actId
  )
}

function selectOpenedStep(engineRestored: boolean, suspendedDoc: EngineSessionDoc | null): void {
  const opened = useDuelStore.getState()
  const steps = opened.state.steps ?? []
  if (steps.length === 0) return
  const actId = engineRestored
    ? useDuelEngineStore.getState().currentStepId
    : (suspendedDoc?.currentStepId ?? null)
  if (engineRestored || suspendedDoc) {
    const found = findStepIndex(steps, actId)
    const index = found >= 0 ? found : steps.length - 1
    opened.setSelectedStepId(steps[index].id)
    opened.setCurrentStepIndex(index)
    return
  }
  opened.setSelectedStepId(steps[0].id)
  opened.setCurrentStepIndex(0)
  opened.previewStepBoard(0)
}

function documentMatchesFingerprint(doc: EngineSessionDoc, state: DuelPuzzleState): boolean {
  if (!doc.boardFingerprint) return true
  return boardFingerprintMatches(
    doc.boardFingerprint,
    computeBoardFingerprint(state, { enginePileOrder: true })
  )
}

function restoreEditingPileOrder(): void {
  useDuelStore.setState((prev) => ({
    ...prev,
    state: {
      ...prev.state,
      cards: reversePileSequences(prev.state.cards),
      steps: prev.state.steps ? reverseStepBoards(prev.state.steps) : prev.state.steps
    }
  }))
}

function markSessionSuspended(doc: EngineSessionDoc): EngineSessionDoc {
  return {
    ...doc,
    suspended: true,
    boardFingerprint: doc.boardFingerprint ?? computeBoardFingerprint(useDuelStore.getState().state)
  }
}

function syncHeaderToSuspendedSession(doc: EngineSessionDoc): void {
  const node = doc.timeline.find((item) => item.id === doc.currentStepId)
  if (!node) return
  useDuelStore.setState({
    currentTurn: node.boardState.turn,
    currentPhase: duelPhaseFromMask(node.boardState.phase),
    activeTurnPlayer: node.boardState.turnPlayer
  })
}

export async function openDuelDocument(
  filePath: string
): Promise<{ success: boolean; error?: string }> {
  const previousPath = useDuelStore.getState().currentProjectPath
  await flushDuelDocumentTitle()
  const currentPath = useDuelStore.getState().currentProjectPath
  const targetPath =
    previousPath && filePath === previousPath && currentPath ? currentPath : filePath
  if (useDuelStore.getState().sceneEditing) useDuelStore.getState().exitSceneMode()
  const flushed = await flushDuelDocumentAutosave()
  if (!flushed && hasUnsavedDuelDocument()) {
    return {
      success: false,
      error: '当前台本没有自动保存成功，已取消打开以免丢失修改。请先手动保存或退出预览后重试。'
    }
  }
  suspendDuelDocumentAutosave()
  try {
    const result = await window.api.readDuelDocument(targetPath)
    if (!result.success || !result.document) {
      return { success: false, error: result.error ?? '读取对局文档失败' }
    }
    let resolvedPath = targetPath
    const contentTitle = result.document.state.title?.trim()
    if (contentTitle && contentTitle !== documentTitleFromPath(targetPath)) {
      const renamed = await window.api
        .renameDuelDocument(targetPath, contentTitle)
        .catch(() => null)
      if (renamed?.success && renamed.filePath) {
        resolvedPath = renamed.filePath
        result.document.state.title = documentTitleFromPath(resolvedPath)
      }
    }
    const engineStore = useDuelEngineStore.getState()
    if (engineStore.isInitialized) {
      engineStore.stopEngine()
    }
    engineStore.setSuspendedDoc(null)
    const duelStore = useDuelStore.getState()
    duelStore.loadProjectAndStart(result.document.state)
    duelStore.setCurrentProjectPath(resolvedPath)
    let engineRestored = false
    let suspendedDoc: EngineSessionDoc | null = null
    const engineDoc = result.document.engine
    if (engineDoc) {
      const support = await window.api.getDuelEngineSupport()
      if (engineDoc.suspended) {
        suspendedDoc = engineDoc
        useDuelEngineStore.getState().setSuspendedDoc(engineDoc)
      } else if (!support.supported) {
        restoreEditingPileOrder()
        suspendedDoc = markSessionSuspended(engineDoc)
        useDuelEngineStore.getState().setSuspendedDoc(suspendedDoc)
      } else if (documentMatchesFingerprint(engineDoc, result.document.state)) {
        const restored = await useDuelEngineStore.getState().restoreSessionDoc(engineDoc)
        if (!restored) {
          return {
            success: false,
            error: useDuelEngineStore.getState().error ?? '恢复引擎会话失败'
          }
        }
        engineRestored = true
      } else {
        restoreEditingPileOrder()
      }
      if (suspendedDoc) syncHeaderToSuspendedSession(suspendedDoc)
    }
    selectOpenedStep(engineRestored, suspendedDoc)
    clearDuelDocumentDraft()
    return { success: true }
  } finally {
    resumeDuelDocumentAutosave()
  }
}

export async function saveDuelDocument(saveAs = false): Promise<DuelDocumentWriteResult> {
  if (useDuelStore.getState().sceneEditing) useDuelStore.getState().exitSceneMode()
  if (saveAs) {
    await flushDuelDocumentTitle()
  } else {
    await commitDuelDocumentTitle(useDuelStore.getState().state.title)
  }
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
      const fileName = result.filePath
        .split(/[/\\]/)
        .pop()
        ?.replace(/\.ygoduel$/i, '')
      useDuelStore.getState().setCurrentProjectPath(result.filePath)
      if (fileName) {
        useDuelStore.setState((prev) => ({
          ...prev,
          state: { ...prev.state, title: fileName }
        }))
      }
    }
    notifyDuelDocumentSaved(revision)
  }
  return result
}
