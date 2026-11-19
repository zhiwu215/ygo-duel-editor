import { useCallback } from 'react'
import { useStore } from 'zustand'
import { useDuelStore } from '../stores/useDuelStore'
import { useDuelEngineStore } from '../stores/useDuelEngineStore'
import { useEngineHistoryTargets } from './useEngineHistoryTargets'

interface EngineAwareUndoRedo {
  canUndo: boolean
  canRedo: boolean
  undo: () => void
  redo: () => void
}

export function useEngineAwareUndoRedo(): EngineAwareUndoRedo {
  const { undo, redo, pastStates, futureStates } = useStore(useDuelStore.temporal)
  const isEngineActive = useDuelEngineStore((s) => s.isInitialized)
  const { previous, next } = useEngineHistoryTargets()

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
    canUndo: isEngineActive ? previous !== undefined : pastStates.length > 0,
    canRedo: isEngineActive ? next !== undefined : futureStates.length > 0,
    undo: runUndo,
    redo: runRedo
  }
}
