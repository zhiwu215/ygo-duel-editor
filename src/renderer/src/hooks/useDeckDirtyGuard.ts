import { useCallback, useEffect, useRef } from 'react'
import { confirmDialog } from '../stores/useDialogStore'
import { useDeckEditorStore } from '../stores/useDeckEditorStore'

export function useDeckDirtyGuard(deckId: string | undefined): {
  markDeckClean: () => void
  confirmDiscard: () => Promise<boolean>
} {
  const savedSnapshotRef = useRef<string>('')
  const markDeckClean = useCallback((): void => {
    savedSnapshotRef.current = JSON.stringify(useDeckEditorStore.getState().deck)
  }, [])
  useEffect(() => {
    markDeckClean()
  }, [deckId, markDeckClean])

  const confirmDiscard = useCallback(async (): Promise<boolean> => {
    const current = JSON.stringify(useDeckEditorStore.getState().deck)
    if (current === savedSnapshotRef.current) return true
    return confirmDialog({
      title: '放弃修改',
      description: '此操作将放弃对当前卡组的修改，是否继续？',
      confirmText: '继续'
    })
  }, [])

  return { markDeckClean, confirmDiscard }
}
