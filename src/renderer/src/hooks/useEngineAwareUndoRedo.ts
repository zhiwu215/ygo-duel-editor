import { useCallback, useMemo } from 'react'
import { useStore } from 'zustand'
import { useDuelStore } from '../stores/useDuelStore'
import { useDuelEngineStore } from '../stores/useDuelEngineStore'

interface EngineAwareUndoRedo {
  canUndo: boolean
  canRedo: boolean
  undo: () => void
  redo: () => void
}

export function useEngineAwareUndoRedo(): EngineAwareUndoRedo {
  const { undo, redo, pastStates, futureStates } = useStore(useDuelStore.temporal)
  const isEngineActive = useDuelEngineStore((s) => s.isInitialized)
  const currentStepId = useDuelEngineStore((s) => s.currentStepId)
  const timelineLength = useDuelEngineStore((s) => s.timeline.length)

  const engineCanUndo = useMemo(() => {
    if (!currentStepId || timelineLength <= 1) return false
    const tl = useDuelEngineStore.getState().timeline
    const idx = tl.findIndex((n) => n.id === currentStepId)
    return idx > 0
  }, [currentStepId, timelineLength])

  const engineCanRedo = useMemo(() => {
    if (!currentStepId || timelineLength === 0) return false
    const tl = useDuelEngineStore.getState().timeline
    const idx = tl.findIndex((n) => n.id === currentStepId)
    return idx >= 0 && idx < timelineLength - 1
  }, [currentStepId, timelineLength])

  const runUndo = useCallback((): void => {
    if (useDuelEngineStore.getState().isInitialized) {
      void useDuelEngineStore.getState().undo()
    } else {
      undo()
    }
  }, [undo])

  const runRedo = useCallback((): void => {
    if (useDuelEngineStore.getState().isInitialized) {
      void useDuelEngineStore.getState().redo()
    } else {
      redo()
    }
  }, [redo])

  return {
    canUndo: isEngineActive ? engineCanUndo : pastStates.length > 0,
    canRedo: isEngineActive ? engineCanRedo : futureStates.length > 0,
    undo: runUndo,
    redo: runRedo
  }
}
