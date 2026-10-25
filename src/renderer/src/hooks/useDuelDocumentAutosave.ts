import { useEffect } from 'react'
import { useDuelStore } from '../stores/useDuelStore'
import { useDuelEngineStore } from '../stores/useDuelEngineStore'
import { confirmDialog } from '../stores/useDialogStore'
import {
  clearDuelDocumentDraft,
  readDuelDocumentDraft,
  writeDuelDocumentDraft
} from '../utils/duelDocumentDraft'
import {
  flushDuelDocumentAutosave,
  hasUnsavedDuelDocument,
  markDuelDocumentDirty
} from '../utils/duelDocumentAutosave'

let draftPrompted = false

function draftTime(timestamp: number): string {
  const date = new Date(timestamp)
  return `${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')} ${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`
}

function restoreDraft(): void {
  if (draftPrompted) return
  draftPrompted = true
  const draft = readDuelDocumentDraft()
  if (!draft) return
  const current = useDuelStore.getState()
  if (
    current.currentProjectPath ||
    current.state.cards.length > 0 ||
    (current.state.steps?.length ?? 0) > 0
  ) {
    clearDuelDocumentDraft()
    return
  }
  void confirmDialog({
    title: '发现上次未保存的编辑',
    description: `上次退出时有未保存到台本的修改（${draftTime(draft.savedAt)}，${draft.state.title?.trim() || '未命名台本'}），是否恢复？`,
    confirmText: '恢复',
    destructive: false,
    extraAction: { text: '丢弃', value: 'discard' }
  }).then((choice) => {
    if (choice === 'discard') {
      clearDuelDocumentDraft()
      return
    }
    if (choice !== true) return
    useDuelStore.getState().loadState(draft.state)
    if (draft.filePath) useDuelStore.getState().setCurrentProjectPath(draft.filePath)
    useDuelStore.setState({ duelStarted: draft.duelStarted })
    markDuelDocumentDirty()
  })
}

export function useDuelDocumentAutosave(): void {
  useEffect(() => {
    const unsubscribeDuel = useDuelStore.subscribe((next, prev) => {
      if (next.state === prev.state && next.duelStarted === prev.duelStarted) return
      if (next.previewReturn !== prev.previewReturn) {
        if (!next.previewReturn && hasUnsavedDuelDocument()) markDuelDocumentDirty()
        return
      }
      markDuelDocumentDirty()
    })
    const unsubscribeEngine = useDuelEngineStore.subscribe((next, prev) => {
      if (
        next.isInitialized === prev.isInitialized &&
        next.loading === prev.loading &&
        next.timeline === prev.timeline &&
        next.currentStepId === prev.currentStepId &&
        next.pendingRequest === prev.pendingRequest &&
        next.replayInfo === prev.replayInfo
      ) {
        return
      }
      markDuelDocumentDirty()
    })

    const flush = (): void => {
      if (!useDuelStore.getState().currentProjectPath || hasUnsavedDuelDocument()) {
        writeDuelDocumentDraft()
      } else {
        clearDuelDocumentDraft()
      }
      void flushDuelDocumentAutosave()
    }
    const persistBeforeClose = async (): Promise<void> => {
      try {
        const duel = useDuelStore.getState()
        if (duel.sceneEditing) duel.exitSceneMode()
        if (duel.previewReturn) duel.exitPreview()
        await flushDuelDocumentAutosave()
        const current = useDuelStore.getState()
        if (!current.currentProjectPath || hasUnsavedDuelDocument()) {
          writeDuelDocumentDraft()
        } else {
          clearDuelDocumentDraft()
        }
      } finally {
        window.api.confirmAppClose()
      }
    }
    const handleVisibilityChange = (): void => {
      if (document.visibilityState === 'hidden') flush()
    }

    const unsubscribeBeforeClose = window.api.onAppBeforeClose(() => {
      void persistBeforeClose()
    })

    restoreDraft()
    window.addEventListener('blur', flush)
    window.addEventListener('beforeunload', flush)
    document.addEventListener('visibilitychange', handleVisibilityChange)
    return () => {
      unsubscribeDuel()
      unsubscribeEngine()
      unsubscribeBeforeClose()
      window.removeEventListener('blur', flush)
      window.removeEventListener('beforeunload', flush)
      document.removeEventListener('visibilitychange', handleVisibilityChange)
    }
  }, [])
}
