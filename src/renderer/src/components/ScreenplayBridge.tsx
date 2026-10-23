import { useEffect } from 'react'
import { useDuelStore } from '../stores/useDuelStore'
import { useDuelEngineStore } from '../stores/useDuelEngineStore'
import type { ScreenplayEdit } from '@shared/index'

export const ScreenplayBridge: React.FC = () => {
  useEffect(() => {
    const push = (): void => {
      const s = useDuelStore.getState()
      void window.api.pushScreenplaySnapshot({
        state: s.state,
        selectedStepId: s.selectedStepId,
        engineActive: useDuelEngineStore.getState().isInitialized
      })
    }

    const unsub = useDuelStore.subscribe((s, prev) => {
      if (s.state !== prev.state || s.selectedStepId !== prev.selectedStepId) push()
    })

    const unsubEngine = useDuelEngineStore.subscribe((s, prev) => {
      if (s.isInitialized !== prev.isInitialized) push()
    })

    const offRequest = window.api.onScreenplayStateRequested(() => push())

    const offEdit = window.api.onScreenplayEdit((edit: ScreenplayEdit) => {
      const s = useDuelStore.getState()
      if (edit.kind === 'updateStep') s.updateStep(edit.stepId, edit.patch)
      else if (edit.kind === 'deleteStep') s.deleteStep(edit.stepId)
    })

    const offPreview = window.api.onScreenplayPreview((stepId: string) => {
      const s = useDuelStore.getState()
      const idx = (s.state.steps || []).findIndex((st) => st.id === stepId)
      s.setSelectedStepId(stepId)
      s.previewStepBoard(idx >= 0 ? idx : null)
    })

    return () => {
      unsub()
      unsubEngine()
      offRequest()
      offEdit()
      offPreview()
    }
  }, [])

  return null
}
